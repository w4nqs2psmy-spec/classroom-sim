import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "./model-routing.ts";
import { agentSystem, agentUserMessage } from "./prompts.ts";
import type { AgentReply, Character, Phase } from "./types.ts";

const AGENT_REPLY_SCHEMA = {
  type: "object",
  properties: {
    say: {
      type: "string",
      description: "What you say aloud to the group, fully in character. 1-4 sentences.",
    },
    reasoning: {
      type: "string",
      description:
        "Your private internal reasoning: why you said this, what you noticed in the group dynamics, your strategy. 1-3 sentences. Not visible to the others.",
    },
    workspaceContribution: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["idea", "evaluation", "synthesis", "none"] },
        content: {
          type: "string",
          description:
            'The self-contained workspace entry. Empty string when kind is "none".',
        },
      },
      required: ["kind", "content"],
      additionalProperties: false,
    },
  },
  required: ["say", "reasoning", "workspaceContribution"],
  additionalProperties: false,
};

export interface AgentTurnContext {
  phase: Phase;
  phaseTurn: number;
  phaseTurns: number;
  taskText: string;
  workspaceJson: string;
  transcript: string;
  mockResponse?: string;
}

export async function runAgentTurn(
  client: ModelClient,
  staticWorld: string,
  character: Character,
  ctx: AgentTurnContext,
): Promise<{ reply: AgentReply; model: string; usage: import("./types.ts").Usage; costUSD: number }> {
  const system: Anthropic.TextBlockParam[] = agentSystem(staticWorld, character);
  const result = await client.call({
    kind: "agent_turn",
    system,
    userMessage: agentUserMessage({
      name: character.name,
      phase: ctx.phase,
      phaseTurn: ctx.phaseTurn,
      phaseTurns: ctx.phaseTurns,
      taskText: ctx.taskText,
      workspaceJson: ctx.workspaceJson,
      transcript: ctx.transcript,
    }),
    maxTokens: 1024,
    jsonSchema: AGENT_REPLY_SCHEMA,
    mockResponse: ctx.mockResponse,
  });

  let reply: AgentReply;
  try {
    reply = JSON.parse(result.text) as AgentReply;
  } catch {
    // Structured outputs should prevent this; fall back to a safe reply.
    reply = {
      say: result.text.slice(0, 300),
      reasoning: "(response was not valid JSON)",
      workspaceContribution: { kind: "none", content: "" },
    };
  }
  return { reply, model: result.model, usage: result.usage, costUSD: result.costUSD };
}
