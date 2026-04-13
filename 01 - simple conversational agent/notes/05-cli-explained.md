# Understanding index.ts: The Command-Line Interface

This file implements **Stage 1** — a terminal-based chat interface (REPL: Read-Eval-Print Loop). You type messages, the AI replies, and the conversation loops until you quit. Let's break it down line by line.

---

## The Full Code

```typescript
import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { chat, closeRedis } from "./agent";

let sessionId = uuidv4();

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

    if (!input) {
      rl.prompt();
      return;
    }

    if (input === "/exit") {
      console.log("\nBye!\n");
      rl.close();
      await closeRedis();
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

    try {
      process.stdout.write("AI:  ");
      const reply = await chat(input, sessionId);
      console.log(reply + "\n");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`\n[Error] ${message}\n`);
      console.error(
        "  Make sure Ollama is running: https://ollama.com\n" +
          `  And the model is pulled:    ollama pull ${process.env.OLLAMA_MODEL ?? "llama3.2:3b"}\n`,
      );
    }

    rl.prompt();
  });

  rl.on("close", async () => {
    await closeRedis();
  });
}

main();
```

---

## Line-by-Line Breakdown

### Lines 1-3: Imports

```typescript
import * as readline from "readline";
import { v4 as uuidv4 } from "uuid";
import { chat, closeRedis } from "./agent";
```

**`readline`**

- A built-in Node.js module for reading user input from the terminal line-by-line.
- It powers the interactive prompt (the `You: ` part where you type).

**`uuid`**

- A library for generating UUIDs (Universally Unique Identifiers).
- We use `v4` (random UUIDs) to create session IDs like `"8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c"`.
- **Why UUIDs?** They're globally unique with near-zero collision chance, so even if a million users start sessions simultaneously, each gets a different ID.

**`chat`, `closeRedis`**

- The main functions from `agent.ts`.
- `chat()`: Sends a message to the AI.
- `closeRedis()`: Gracefully shuts down the Redis connection.

---

### Line 5: The Session ID

```typescript
let sessionId = uuidv4();
```

**What is this?** Every time you start the CLI, a brand-new session ID is generated.

**Why `let` instead of `const`?** Because the `/clear` command changes the session ID mid-run (see line 55). `const` would prevent that.

**What does a session represent?** A single conversation. All messages you exchange in this terminal session get saved to Redis under this ID. If you restart the program, a new UUID is generated, so it's a fresh conversation (the old one is still in Redis but won't be loaded unless you manually use that UUID).

**What if I want to resume a session?** You'd need to pass the session ID as a command-line argument:

```typescript
const sessionId = process.argv[2] || uuidv4();
```

Then run: `npm run dev abc123` to resume session `abc123`.

---

### Lines 7-13: The Banner

```typescript
function printBanner(): void {
  console.log("\n╔══════════════════════════════════════════╗");
  console.log("║   Conversational Agent  (Stage 1 · CLI)  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log("  Commands:  /session  /clear  /exit /help\n");
  console.log(`  Session ID: ${sessionId}\n`);
}
```

**What is this?** A pretty welcome message printed when the program starts.

**Why?** User experience! Instead of just dropping into a blank prompt, we show:

- What the program is.
- What commands are available.
- The session ID (useful for debugging or sharing).

**The box-drawing characters** (`╔`, `═`, `╗`, etc.) are Unicode characters that create a nice border. Purely cosmetic.

---

### Lines 15-19: The Help Message

```typescript
function printHelp(): void {
  console.log("  /session  -> show current session ID");
  console.log("  /clear   -> start a brand-new session (wipes context)");
  console.log("  /exit    -> quit\n");
}
```

**What is this?** Explains what each command does. Called when the user types `/help`.

**Why separate from the banner?** The banner shows a summary; `/help` shows details. Keeps the banner concise.

---

### Lines 21-29: The Main Function Setup

```typescript
async function main(): Promise<void> {
  printBanner();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "You: ",
  });

  rl.prompt();
```

**`async function main(): Promise<void>`**

- The entry point of our program. Everything starts here.
- `async` because we'll call `chat()`, which is asynchronous.

**`printBanner();`**

- Show the welcome message first thing.

**`readline.createInterface({ ... })`**

- Creates a readline interface (the thing that listens for user input).

**`input: process.stdin`**

- Read from "standard input" (the terminal). This is where user keystrokes come from.

**`output: process.stdout`**

- Write to "standard output" (the terminal screen). This is where we print messages.

**`prompt: "You: "`**

- The text displayed before the cursor when waiting for input.
- Example: `You: Hello` ← the `You: ` part is the prompt.

**`rl.prompt();`**

- Shows the prompt immediately. Without this, you'd see the banner but no `You: ` line — the user wouldn't know they can type yet.

---

### Lines 31-64: The Main Event Loop

```typescript
rl.on("line", async (line: string) => {
  const input = line.trim();

  if (!input) {
    rl.prompt();
    return;
  }
  // ... command handlers ...
});
```

**`rl.on("line", async (line: string) => { ... })`**

- This is an event listener. Every time the user presses Enter, the `"line"` event fires, and this function runs.
- The `line` parameter is whatever the user typed (including leading/trailing spaces).

**`const input = line.trim();`**

- Remove whitespace from both ends.
- Example: `"  hello  "` becomes `"hello"`.

**`if (!input) { rl.prompt(); return; }`**

- If the user pressed Enter without typing anything (blank line), just show the prompt again.
- Without this, pressing Enter would send an empty message to the AI, which is pointless.

---

### Lines 38-43: The `/exit` Command

```typescript
if (input === "/exit") {
  console.log("\nBye!\n");
  rl.close();
  await closeRedis();
  process.exit(0);
}
```

**What does this do?** Quits the program gracefully.

**Line by line**:

**`console.log("\nBye!\n");`**

- Print a farewell message. The `\n` adds blank lines for spacing.

**`rl.close();`**

- Closes the readline interface (stops listening for input).
- This also emits the `"close"` event (see line 83), which triggers another cleanup handler.

**`await closeRedis();`**

- Closes the Redis connection cleanly.
- Without this, the connection would time out after 10-30 seconds (wasteful).

**`process.exit(0);`**

- Terminates the Node.js process.
- `0` is the exit code (0 = success, non-zero = error).
- **Why is this needed?** Even after `rl.close()`, Node.js might keep running if there are pending background tasks. `process.exit(0)` forcefully stops everything.

---

### Lines 45-50: The `/session` Command

```typescript
if (input === "/session") {
  console.log(`\n  Session ID: ${sessionId}\n`);
  rl.prompt();
  return;
}
```

**What does this do?** Prints the current session ID.

**Why is this useful?**

- Debugging: If messages aren't persisting, you can check if the session ID changed unexpectedly.
- Sharing: You could tell someone "use session ID xyz123 to see our conversation" (if you implement session loading).

**`rl.prompt();`**

- Show the `You: ` prompt again so the user can type another message.

**`return;`**

- Exit this iteration of the event handler (don't try to send `/session` to the AI).

---

### Lines 52-57: The `/clear` Command

```typescript
if (input === "/clear") {
  sessionId = uuidv4();
  console.log(`\n  New session started: ${sessionId}\n`);
  rl.prompt();
  return;
}
```

**What does this do?** Starts a brand-new conversation.

**How it works**:

- Generate a new UUID and store it in `sessionId`.
- From this point forward, all messages are saved to a different Redis key.
- The old session's messages are still in Redis (they'll expire after 24 hours), but we're not loading them anymore.

**Why is this better than restarting the program?** Faster! You don't have to kill the process and run `npm run dev` again.

**Example use case**: You finished one conversation ("Help me write a poem") and want to start a fresh topic ("Explain quantum physics") without the AI confusing the two contexts.

---

### Lines 59-63: The `/help` Command

```typescript
if (input === "/help") {
  printHelp();
  rl.prompt();
  return;
}
```

**What does this do?** Calls the `printHelp()` function to show command details.

Straightforward — no magic here.

---

### Lines 65-79: Sending Messages to the AI

```typescript
try {
  process.stdout.write("AI:  ");
  const reply = await chat(input, sessionId);
  console.log(reply + "\n");
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n[Error] ${message}\n`);
  console.error(
    "  Make sure Ollama is running: https://ollama.com\n" +
      `  And the model is pulled:    ollama pull ${process.env.OLLAMA_MODEL ?? "llama3.2:3b"}\n`,
  );
}

rl.prompt();
```

**This is the core logic** — sending the user's message to the AI and displaying the response.

**Line by line**:

**`try { ... } catch (err: unknown) { ... }`**

- Wraps the AI call in error handling.
- If anything goes wrong (Ollama is down, Redis crashed, network error), we catch it and show a friendly message instead of crashing.

**`process.stdout.write("AI:  ");`**

- Print `AI:  ` (with two spaces) but _without_ a newline.
- **Why `write()` instead of `console.log()`?** Because `console.log()` adds a newline. We want the AI's response on the same line:
  ```
  AI:  Hello! How can I help?
  ```
  Instead of:
  ```
  AI:
  Hello! How can I help?
  ```

**`const reply = await chat(input, sessionId);`**

- Call the `chat()` function from `agent.ts`.
- Pass the user's message (`input`) and the session ID.
- `await` waits for the AI to generate a response (this can take 1-5 seconds).

**`console.log(reply + "\n");`**

- Print the AI's response.
- `+ "\n"` adds a blank line after for spacing.

**Catch block: `const message = err instanceof Error ? err.message : String(err);`**

- Extract the error message.
- Some errors are `Error` objects (`err.message`), others are strings or other types (`String(err)` converts them).

**`console.error(...)`**

- Print the error in red (in most terminals).
- Suggest solutions: "Make sure Ollama is running" and "Pull the model."

**`rl.prompt();`** (after try/catch)

- Show the `You: ` prompt again so the conversation can continue even after an error.

---

### Lines 81-83: Cleanup on Exit

```typescript
rl.on("close", async () => {
  await closeRedis();
});
```

**What is this?** A backup cleanup handler.

**When does `"close"` fire?**

- When you call `rl.close()` (e.g., in the `/exit` command).
- When you press `Ctrl+C` to kill the program.

**Why do we need this if `/exit` already calls `closeRedis()`?**

- If the user presses `Ctrl+C` instead of typing `/exit`, the `/exit` handler never runs.
- This ensures Redis gets closed no matter how the program exits.

**Why is it async?** Because `closeRedis()` is async (it waits for the Redis connection to close).

---

### Line 85: Starting the Program

```typescript
main();
```

**This runs the `main()` function**. Without this, the file would just define functions but not execute anything.

**Why not just write all the code at the top level?** Wrapping it in a function makes the code cleaner and allows us to use `await` (top-level `await` is only supported in ES modules, and we're using CommonJS).

---

## The User Experience Flow

Let's trace a full conversation:

**Terminal output when you start**:

```
╔══════════════════════════════════════════╗
║   Conversational Agent  (Stage 1 · CLI)  ║
╚══════════════════════════════════════════╝
  Commands:  /session  /clear  /exit /help

  Session ID: 8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c

You:
```

**User types**: `Hello!`

**Behind the scenes**:

1. The `"line"` event fires with `line = "Hello!"`.
2. `input = "Hello!"` (after trim).
3. No commands matched, so we fall through to the `try` block.
4. `chat("Hello!", "8f3a2b1c...")` is called.
5. The AI generates: `"Hi! How can I help you today?"`
6. We print:

   ```
   AI:  Hi! How can I help you today?

   You:
   ```

**User types**: `What did I just say?`

**Behind the scenes**:

1. `chat("What did I just say?", "8f3a2b1c...")` is called.
2. The AI loads history from Redis: `[HumanMessage("Hello!"), AIMessage("Hi! How can I help you today?")]`.
3. The AI generates: `"You said 'Hello!'"`
4. We print:

   ```
   AI:  You said 'Hello!'

   You:
   ```

**User types**: `/clear`

**Behind the scenes**:

1. `sessionId = uuidv4()` → new session ID generated.
2. We print:

   ```

     New session started: 1a2b3c4d-...

   You:
   ```

**User types**: `What did I say earlier?`

**Behind the scenes**:

1. `chat("What did I say earlier?", "1a2b3c4d...")` is called with the _new_ session ID.
2. The AI loads history from Redis: `[]` (empty — this is a fresh session).
3. The AI has no context, so it generates: `"I don't have any record of what you said earlier — this is the start of our conversation!"`

**User types**: `/exit`

**Behind the scenes**:

1. `console.log("\nBye!\n")` → prints farewell.
2. `rl.close()` → stops listening for input.
3. `closeRedis()` → closes Redis connection.
4. `process.exit(0)` → terminates the program.

---

## Summary

**What this file does**:

1. Creates a readline interface for terminal input.
2. Generates a session ID on startup.
3. Implements a REPL loop that:
   - Handles built-in commands (`/exit`, `/session`, `/clear`, `/help`).
   - Sends user messages to `chat()`.
   - Displays AI responses.
   - Handles errors gracefully.
4. Cleans up the Redis connection on exit.

**Why this is Stage 1**: It's the simplest possible interface — just you and the terminal. No web servers, no React, no complexity. You can verify the agent works before adding HTTP layers.

**Next (Stage 2)**: We'll wrap the `chat()` function in a REST API so any frontend (web, mobile, Postman) can use it.
