import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { chat, closeStore } from "./agent";

// ── Session ────────────────────────────────────────────────────────────────
// A new UUID is created each time the CLI starts.
// The session persists in Redis (survives restarts) until the TTL expires
// or the user runs /clear.
let sessionId = uuidv4();

// ── CLI helpers ────────────────────────────────────────────────────────────
function printBanner(): void {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Conversational Agent  (Stage 1 · CLI)  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("  Commands:  /session  /clear  /exit /help\n");
  console.log(`  Session ID: ${sessionId}\n`);
}

function printHelp(): void {
  console.log("  /session  -> show current session ID");
  console.log("  /clear   -> start a brand-new session (wipes context)");
  console.log("  /exit    -> quit\n");
}

// ── REPL loop ──────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: ",
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();

    // ── Built-in commands ──────────────────────────────────────────────────
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit") {
      console.log("\nBye!\n");
      rl.close();
      await closeStore();
      process.exit(0);
    }

    if (input === "/session") {
      console.log(`\n  Session ID: ${sessionId}\n`);
      rl.prompt();
      return;
    }

    if (input === "/clear") {
      sessionId = uuidv4();
      console.log(`\n  New session started: ${sessionId}\n`);
      rl.prompt();
      return;
    }

    if (input === "/help") {
      printHelp();
      rl.prompt();
      return;
    }

    // ── Send message to agent ──────────────────────────────────────────────
    try {
      // Pause prompt while waiting so output isn't interleaved
      process.stdout.write("AI:  ");
      const reply = await chat(input, sessionId);
      console.log(reply + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[Error] ${message}\n`);
      console.error(
        "  Make sure Ollama is running: https://ollama.com\n" +
          `  And the model is pulled:    ollama pull ${process.env.OLLAMA_MODEL ?? "llama3.2:3b"}\n` +
          "\n  Note: Sessions are persisted to .sessions/ folder and survive restarts.\n",
      );
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await closeStore();
  });
}

main();
