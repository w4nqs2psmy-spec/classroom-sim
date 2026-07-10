import type Anthropic from "@anthropic-ai/sdk";
import type { ModelClient } from "./model-routing.ts";
import { teacherSystem } from "./prompts.ts";
import type { Phase, Task, TeacherEvaluation } from "./types.ts";

const TASK_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", description: "Short, catchy task title." },
    description: {
      type: "string",
      description:
        "The open-ended group task, 3-6 sentences: the scenario, the challenge, and what makes it open-ended. Addressed to the group.",
    },
    deliverable: {
      type: "string",
      description:
        "One concrete deliverable the group must produce by the end of the session (e.g. a go-to-market plan, a sales pitch structure, a campaign concept).",
    },
    themes: {
      type: "array",
      items: { type: "string" },
      description: "2-4 theme tags, e.g. entrepreneurship, sales, marketing, pricing.",
    },
  },
  required: ["title", "description", "deliverable", "themes"],
  additionalProperties: false,
};

const EVALUATION_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["accepted", "revise"] },
    score: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    feedback: {
      type: "string",
      description:
        "3-6 sentences addressed to the group: what is strong, what is weak, and — if verdict is revise — exactly what must improve.",
    },
  },
  required: ["verdict", "score", "feedback"],
  additionalProperties: false,
};

const THEME_ANGLES = [
  "a student startup idea for a real local problem",
  "reviving a struggling small business through better marketing",
  "designing a sales strategy for a product nobody asked for",
  "launching a new product on a shoestring marketing budget",
  "pricing and positioning a subscription service for young people",
  "turning a hobby into a viable business",
  "winning back customers a company has lost to a cheaper competitor",
  "marketing something sustainable without greenwashing",
];

export async function generateTask(
  client: ModelClient,
  staticWorld: string,
  mockResponse?: string,
): Promise<{ task: Task; costUSD: number; model: string }> {
  const angle = THEME_ANGLES[Math.floor(Math.random() * THEME_ANGLES.length)];
  const result = await client.call({
    kind: "teacher_task",
    system: teacherSystem(staticWorld),
    userMessage:
      `Create a new open-ended group task for this session. ` +
      `Angle to build on: ${angle}. ` +
      `It must be concrete enough that five students can produce a real solution in one session, ` +
      `and open-ended enough that ideation, critical evaluation, and synthesis are all genuinely needed.`,
    maxTokens: 1024,
    jsonSchema: TASK_SCHEMA,
    mockResponse,
  });

  const parsed = JSON.parse(result.text) as Omit<Task, "id" | "createdAt">;
  const task: Task = {
    id: `task-${Date.now()}`,
    createdAt: new Date().toISOString(),
    ...parsed,
  };
  return { task, costUSD: result.costUSD, model: result.model };
}

export async function phaseTransitionMessage(
  client: ModelClient,
  staticWorld: string,
  args: { from: Phase | null; to: Phase | "done"; workspaceJson: string; mockResponse?: string },
): Promise<{ text: string; costUSD: number; model: string }> {
  const instruction =
    args.from === null
      ? `Open the session: welcome the group briefly and tell them the IDEATION phase starts now.`
      : args.to === "done"
        ? `The synthesis phase just ended. Tell the group, in one or two sentences, that you will now review their solution.`
        : `The ${args.from.toUpperCase()} phase just ended. In one or two sentences, close it (you may name one thing you noticed in the workspace) and open the ${args.to.toUpperCase()} phase with a pointed instruction.`;

  const result = await client.call({
    kind: "teacher_transition",
    system: teacherSystem(staticWorld),
    userMessage: `${instruction}\n\nCurrent shared workspace:\n${args.workspaceJson}\n\nRespond with only the words you say to the group.`,
    maxTokens: 300,
    mockResponse: args.mockResponse,
  });
  return { text: result.text.trim(), costUSD: result.costUSD, model: result.model };
}

export async function evaluateSolution(
  client: ModelClient,
  staticWorld: string,
  args: { taskText: string; workspaceJson: string; mockResponse?: string },
): Promise<{ evaluation: TeacherEvaluation; costUSD: number; model: string }> {
  const result = await client.call({
    kind: "teacher_evaluation",
    system: teacherSystem(staticWorld),
    userMessage:
      `The group has finished. Evaluate their solution rigorously against the task and your evaluation criteria.\n\n` +
      `THE TASK:\n${args.taskText}\n\n` +
      `THE FULL SHARED WORKSPACE (their solution lives in the "synthesis" entries; ` +
      `check whether the "evaluations" criticisms were addressed):\n${args.workspaceJson}\n\n` +
      `Accept only if the synthesis genuinely answers the deliverable. Otherwise return it with precise feedback.`,
    maxTokens: 2048,
    jsonSchema: EVALUATION_SCHEMA,
    mockResponse: args.mockResponse,
  });

  const evaluation = JSON.parse(result.text) as TeacherEvaluation;
  return { evaluation, costUSD: result.costUSD, model: result.model };
}
