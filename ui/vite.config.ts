import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { AnthropicModelClient } from "../src/model-routing.ts";
import { agentSystem, buildStaticWorld } from "../src/prompts.ts";
import type { Character, TeacherProfile } from "../src/types.ts";

const uiRoot = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(uiRoot, "..");
const logsDir = path.resolve(projectRoot, "logs");
const workspaceFile = path.resolve(projectRoot, "workspace.json");

// Session file names are the only browser-controlled input this middleware
// accepts; anything not matching this is rejected outright, and the resolved
// path is additionally checked to stay inside logsDir. Without both checks
// this read-only convenience endpoint would be an arbitrary-file-read
// primitive (e.g. a path to ../.env, which holds the real Anthropic key).
const SESSION_FILE_RE = /^session-[\w-]+\.jsonl$/;

function sendJson(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

/**
 * Dev-only, read-only bridge from Stage 1's on-disk session output
 * (classroom-sim/logs/*.jsonl, classroom-sim/workspace.json) to the Stage 3
 * UI. Strictly readFileSync/readdirSync over those two locations — never
 * imports model-routing.ts/agent.ts/teacher.ts/loop.ts, never reads
 * process.env, and never grows into a "run a session" endpoint.
 */
function sessionApiPlugin(): Plugin {
  return {
    name: "session-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith("/api/")) return next();
        const url = new URL(req.url, "http://localhost");

        if (url.pathname === "/api/sessions") {
          if (!existsSync(logsDir)) return sendJson(res, 200, []);
          const files = readdirSync(logsDir)
            .filter((f) => SESSION_FILE_RE.test(f))
            .map((file) => {
              const full = path.join(logsDir, file);
              const stat = statSync(full);
              const raw = readFileSync(full, "utf8");
              const isComplete = raw
                .trimEnd()
                .split("\n")
                .some((line) => {
                  try {
                    return JSON.parse(line).type === "session_end";
                  } catch {
                    return false;
                  }
                });
              return { file, size: stat.size, mtime: stat.mtime.toISOString(), isComplete };
            })
            .sort((a, b) => b.mtime.localeCompare(a.mtime));
          return sendJson(res, 200, files);
        }

        const sessionMatch = url.pathname.match(/^\/api\/sessions\/(.+)$/);
        if (sessionMatch) {
          const file = decodeURIComponent(sessionMatch[1]);
          if (!SESSION_FILE_RE.test(file)) return sendJson(res, 400, { error: "invalid session file name" });
          const full = path.resolve(logsDir, file);
          if (!full.startsWith(logsDir + path.sep) || !existsSync(full)) {
            return sendJson(res, 404, { error: "not found" });
          }

          const raw = readFileSync(full, "utf8");
          const lines = raw.split("\n").filter((l) => l.trim().length > 0);
          const entries: unknown[] = [];
          let isComplete = false;
          for (let i = 0; i < lines.length; i++) {
            try {
              const entry = JSON.parse(lines[i]);
              entries.push(entry);
              if (entry.type === "session_end") isComplete = true;
            } catch {
              // Only the last line can legitimately be mid-write (loop.ts
              // appends synchronously, line by line); drop it silently. A
              // malformed line anywhere else means something is genuinely
              // wrong with the file.
              if (i !== lines.length - 1) {
                return sendJson(res, 500, { error: `malformed log line ${i} in ${file}` });
              }
            }
          }
          return sendJson(res, 200, { entries, isComplete });
        }

        if (url.pathname === "/api/workspace") {
          if (!existsSync(workspaceFile)) return sendJson(res, 404, { error: "no workspace.json" });
          res.setHeader("Content-Type", "application/json");
          res.end(readFileSync(workspaceFile, "utf8"));
          return;
        }

        next();
      });
    },
  };
}

// ---------------------------------------------------------------------------
// Live agent reply — the ONE endpoint that deliberately runs a model call.
//
// Unlike sessionApiPlugin above (read-only, never touches model/agent code or
// the key), this plugin exists specifically to let a human interjection get a
// real, in-character reply from one agent. It is dev-server-only (never in the
// production bundle), the API key stays server-side (loaded from ../.env and
// read only by the Anthropic SDK — never sent to the browser), and Stage 1's
// code (agentSystem/buildStaticWorld/AnthropicModelClient) is REUSED, not
// modified. Input is validated and the reply is bounded (Haiku, ~200 tokens).
// ---------------------------------------------------------------------------

const STUDENT_FILES: Record<string, string> = {
  Vilma: "vilma",
  Otto: "otto",
  Nea: "nea",
  Sami: "sami",
  Leo: "leo",
};
const MAX_HUMAN_TEXT = 800;
const MAX_TRANSCRIPT = 6000;

function replyDirective(lang: string, name: string): string {
  const base =
    `You are ${name}. Embody ${name} completely — personality, speaking style, and group behaviour as described above. ` +
    "A human participant in the room has just interjected mid-discussion and is speaking directly to you. " +
    "Reply to them out loud in 1-2 short spoken sentences, fully in character, reacting to what they actually said. " +
    "Output ONLY the words you say aloud — no private reasoning, no labels, no headings, no markdown, no JSON.";
  return lang === "fi" ? base + " TÄRKEÄÄ: vastaa tässä vuorossa kokonaan suomeksi." : base + " Reply in English.";
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > MAX_HUMAN_TEXT + MAX_TRANSCRIPT + 2000) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function agentReplyApiPlugin(): Plugin {
  // Built lazily on first request, then reused across calls.
  let staticWorld: string | null = null;
  let characters: Record<string, Character> | null = null;
  let client: AnthropicModelClient | null = null;

  const ensureReady = async () => {
    if (staticWorld && characters && client) return;
    const dotenv = await import("dotenv");
    dotenv.config({ path: path.resolve(projectRoot, ".env") });
    const load = <T,>(p: string) => JSON.parse(readFileSync(path.resolve(projectRoot, p), "utf8")) as T;
    const ordered = ["vilma", "otto", "nea", "sami", "leo"].map((n) => load<Character>(`characters/${n}.json`));
    const teacher = load<TeacherProfile>("teacher.json");
    staticWorld = buildStaticWorld(ordered, teacher);
    characters = Object.fromEntries(ordered.map((c) => [c.name, c]));
    client = new AnthropicModelClient();
  };

  return {
    name: "agent-reply-api",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/agent-reply") return next();
        (async () => {
          try {
            const body = JSON.parse(await readBody(req)) as {
              agentName?: string;
              humanText?: string;
              transcript?: string;
              taskText?: string;
              lang?: string;
            };
            const agentName = body.agentName ?? "";
            const humanText = (body.humanText ?? "").trim();
            if (!STUDENT_FILES[agentName]) return sendJson(res, 400, { error: "unknown agent" });
            if (!humanText) return sendJson(res, 400, { error: "empty humanText" });
            if (humanText.length > MAX_HUMAN_TEXT) return sendJson(res, 400, { error: "humanText too long" });

            await ensureReady();
            const character = characters![agentName];
            const lang = body.lang === "fi" ? "fi" : "en";
            // Reuse only the cached static-world block (persona detail lives
            // there); replace agentSystem's second block, which would tell the
            // model to also emit private reasoning + a workspace entry.
            const worldBlock = agentSystem(staticWorld!, character)[0];
            const system = [worldBlock, { type: "text" as const, text: replyDirective(lang, character.name) }];
            const userMessage = [
              `THE TASK:\n${(body.taskText ?? "").slice(0, 1000)}`,
              ``,
              `RECENT DISCUSSION:\n${(body.transcript ?? "").slice(0, MAX_TRANSCRIPT)}`,
              ``,
              `The human just said, directly to you (${character.name}):\n"${humanText}"`,
              ``,
              `Reply to them now, ${character.name}.`,
            ].join("\n");

            let result: { text: string; costUSD: number; refused?: boolean };
            try {
              const r = await client!.call({ kind: "agent_turn", system, userMessage, maxTokens: 200 });
              result = { text: r.text, costUSD: r.costUSD };
            } catch (err) {
              // Refusal (the SDK client throws on stop_reason "refusal") or any
              // model error → let the client fall back to a scripted line.
              return sendJson(res, 200, { refused: true, reason: (err as Error).message });
            }
            return sendJson(res, 200, { say: result.text.trim(), costUSD: result.costUSD });
          } catch (err) {
            return sendJson(res, 500, { error: (err as Error).message });
          }
        })();
      });
    },
  };
}

export default defineConfig({
  root: uiRoot,
  // Relative asset paths so the build works from a GitHub Pages subpath
  // (https://<user>.github.io/<repo>/) as well as from "/" in dev.
  base: "./",
  plugins: [react(), sessionApiPlugin(), agentReplyApiPlugin()],
  server: { port: 5173, strictPort: true },
});
