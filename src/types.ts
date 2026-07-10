export type Phase = "ideation" | "evaluation" | "synthesis";

export interface Character {
  name: string;
  role: string;
  personality: string;
  speakingStyle: string;
  groupBehavior: string;
  typicalMoves: string[];
  talkativeness: number;
}

export interface TeacherProfile {
  name: string;
  role: string;
  persona: string;
  evaluationCriteria: string[];
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deliverable: string;
  themes: string[];
  createdAt: string;
}

export interface WorkspaceEntry {
  id: string;
  author: string;
  content: string;
  turn: number;
  phase: Phase;
}

export interface Workspace {
  task: Task | null;
  phase: Phase;
  status: "in_progress" | "accepted";
  ideas: WorkspaceEntry[];
  evaluations: WorkspaceEntry[];
  synthesis: WorkspaceEntry[];
  teacherFeedback: string[];
}

export type ContributionKind = "idea" | "evaluation" | "synthesis" | "none";

export interface AgentReply {
  say: string;
  reasoning: string;
  workspaceContribution: {
    kind: ContributionKind;
    content: string;
  };
}

export interface TeacherEvaluation {
  verdict: "accepted" | "revise";
  score: number;
  feedback: string;
}

export interface TranscriptLine {
  speaker: string;
  text: string;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
}
