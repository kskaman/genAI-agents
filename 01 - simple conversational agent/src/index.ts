import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { chat, closeStore } from "./agent";
import {
  cleanupExpiredSessions,
  initSession,
  clearMessages,
  sessionId,
} from "./sessionStore";

/**
 *  CLI helpers
 */
function printBanner(): void {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Conversational Agent                   ║");
  console.log("╚══════════════════════════════════════════╝\n");
  console.log("  Commands:  /session  /clear  /exit /help\n");
  console.log(`  Session ID: ${sessionId}\n`);
}

function printHelp(): void {
  console.log("  /session  -> show current session ID");
  console.log("  /clear    -> clear conversation (keeps same session)");
  console.log("  /exit     -> quit and save session");
  console.log("  /help     -> show this help message\n");
}

/**
 * Main function to run the conversational agent CLI
 */
async function main(): Promise<void> {
  cleanupExpiredSessions(); // Clean up old sessions on startup
  initSession(uuidv4()); // Initialize new session
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: ",
  });

  rl.prompt();

  rl.on("line", async (line: string) => {
    const input = line.trim();

    // Built-in commands
    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit") {
      console.log("\nBye!\n");
      rl.close();
      process.exit(0);
    }

    if (input === "/session") {
      console.log(`\n  Session ID: ${sessionId}\n`);
      rl.prompt();
      return;
    }

    if (input === "/clear") {
      clearMessages();
      console.log(`\n  Conversation cleared\n`);
      rl.prompt();
      return;
    }

    if (input === "/help") {
      printHelp();
      rl.prompt();
      return;
    }

    // Send message to agent
    try {
      // Show loading indicator
      process.stdout.write("AI:  Thinking...");

      const reply = await chat(input);

      // Clear the "Thinking..." line and show response
      process.stdout.write("\r\x1b[K"); // Clear current line
      process.stdout.write("AI:  ");
      console.log(reply + "\n");
    } catch (err: unknown) {
      process.stdout.write("\r\x1b[K"); // Clear "Thinking..." line
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[Error] ${message}\n`);
      console.error(
        "  Make sure Ollama is running: https://ollama.com\n" +
          `  And the model is pulled:    ollama pull ${process.env.OLLAMA_MODEL ?? "llama3.2:3b"}\n` +
          "\n  Note: Sessions are persisted to .sessions/ folder on exit.\n",
      );
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await closeStore();
  });
}

main();
