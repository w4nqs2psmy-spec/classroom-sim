import Anthropic from "@anthropic-ai/sdk";
import type { Usage } from "./types.ts";

// ---------------------------------------------------------------------------
// Routing: cheap Haiku for routine turns, Opus only for the teacher's
// evaluation / synthesis-quality moments.
// ---------------------------------------------------------------------------

export type CallKind =
  | "agent_turn"
  | "teacher_task"
  | "teacher_transition"
  | "teacher_evaluation";

const ROUTINE_MODEL = "claude-haiku-4-5";
const STRONG_MODEL = "claude-opus-4-8";

export const MODEL_FOR: Record<CallKind, string> = {
  agent_turn: ROUTINE_MODEL,
  teacher_task: ROUTINE_MODEL,
  teacher_transition: ROUTINE_MODEL,
  teacher_evaluation: STRONG_MODEL,
};

// USD per million tokens (cache write = 1.25x input, cache read = 0.1x input)
const PRICES: Record<
  string,
  { input: number; output: number; cacheWrite: number; cacheRead: number }
> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheWrite: 1.25, cacheRead: 0.1 },
  "claude-opus-4-8": { input: 5.0, output: 25.0, cacheWrite: 6.25, cacheRead: 0.5 },
};

// ---------------------------------------------------------------------------
// Cost tracking
// ---------------------------------------------------------------------------

export class CostTracker {
  private perModel = new Map<string, Usage>();
  private calls = 0;

  record(model: string, usage: Usage): number {
    this.calls++;
    const acc = this.perModel.get(model) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    acc.inputTokens += usage.inputTokens;
    acc.outputTokens += usage.outputTokens;
    acc.cacheWriteTokens += usage.cacheWriteTokens;
    acc.cacheReadTokens += usage.cacheReadTokens;
    this.perModel.set(model, acc);
    return this.costOf(model, usage);
  }

  costOf(model: string, usage: Usage): number {
    const p = PRICES[model];
    if (!p) return 0;
    return (
      (usage.inputTokens * p.input +
        usage.outputTokens * p.output +
        usage.cacheWriteTokens * p.cacheWrite +
        usage.cacheReadTokens * p.cacheRead) /
      1_000_000
    );
  }

  total(): number {
    let sum = 0;
    for (const [model, usage] of this.perModel) sum += this.costOf(model, usage);
    return sum;
  }

  summary(): string {
    const lines: string[] = [`--- Session cost summary (${this.calls} API calls) ---`];
    for (const [model, u] of this.perModel) {
      lines.push(
        `${model}: in=${u.inputTokens} out=${u.outputTokens} ` +
          `cacheWrite=${u.cacheWriteTokens} cacheRead=${u.cacheReadTokens} ` +
          `→ $${this.costOf(model, u).toFixed(4)}`,
      );
    }
    lines.push(`TOTAL estimated cost: $${this.total().toFixed(4)}`);
    return lines.join("\n");
  }
}

// ---------------------------------------------------------------------------
// Model client (real + dry-run mock)
// ---------------------------------------------------------------------------

export interface CallOptions {
  kind: CallKind;
  system: Anthropic.TextBlockParam[];
  userMessage: string;
  maxTokens: number;
  jsonSchema?: Record<string, unknown>;
  mockResponse?: string; // used only in dry-run mode
}

export interface CallResult {
  text: string;
  model: string;
  usage: Usage;
  costUSD: number;
}

export interface ModelClient {
  call(opts: CallOptions): Promise<CallResult>;
  readonly costs: CostTracker;
}

export class AnthropicModelClient implements ModelClient {
  readonly costs = new CostTracker();
  private client = new Anthropic();

  async call(opts: CallOptions): Promise<CallResult> {
    const model = MODEL_FOR[opts.kind];
    const params: Anthropic.MessageCreateParamsNonStreaming = {
      model,
      max_tokens: opts.maxTokens,
      system: opts.system,
      messages: [{ role: "user", content: opts.userMessage }],
    };
    if (opts.jsonSchema) {
      (params as Record<string, unknown>).output_config = {
        format: { type: "json_schema", schema: opts.jsonSchema },
      };
    }
    const response = await this.client.messages.create(params);

    if (response.stop_reason === "refusal") {
      throw new Error(`Model refused the request (kind=${opts.kind})`);
    }
    if (response.stop_reason === "max_tokens") {
      console.warn(`⚠ Output truncated at max_tokens (kind=${opts.kind})`);
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const usage: Usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
    };
    const costUSD = this.costs.record(model, usage);
    return { text: textBlock?.text ?? "", model, usage, costUSD };
  }
}

/** Offline mock for `--dry-run`: verifies the whole loop without API calls. */
export class MockModelClient implements ModelClient {
  readonly costs = new CostTracker();

  async call(opts: CallOptions): Promise<CallResult> {
    const usage: Usage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
    };
    return {
      text: opts.mockResponse ?? "[dry-run response]",
      model: `mock(${MODEL_FOR[opts.kind]})`,
      usage,
      costUSD: 0,
    };
  }
}
