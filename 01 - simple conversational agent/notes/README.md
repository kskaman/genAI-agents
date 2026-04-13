# Code Explanations Index

Welcome! This folder contains detailed, conversational explanations of every file in the project. Start with the setup guide, then read the code explanations in order.

---

## Reading Order

1. **[00-setup-guide.md](./00-setup-guide.md)** — How to install prerequisites (Node.js, Redis, Ollama) and get the project running.

2. **[01-config-explained.md](./01-config-explained.md)** — How `config.ts` loads environment variables and makes them available to the rest of the code.

3. **[02-sessionStore-explained.md](./02-sessionStore-explained.md)** — How `sessionStore.ts` manages Redis connections and creates session-specific message histories.

4. **[03-prompt-explained.md](./03-prompt-explained.md)** — How `prompt.ts` defines the conversation structure (system message + history + user input).

5. **[04-agent-explained.md](./04-agent-explained.md)** — How `agent.ts` connects the LLM, prompt, and history into a single `chat()` function.

6. **[05-cli-explained.md](./05-cli-explained.md)** — How `index.ts` implements the terminal-based chat interface (Stage 1).

---

## What Each File Does (Quick Reference)

| File              | Purpose                             | Key Exports                                          |
| ----------------- | ----------------------------------- | ---------------------------------------------------- |
| `config.ts`       | Load `.env` variables               | `config` object                                      |
| `sessionStore.ts` | Redis client + history factory      | `redisClient`, `getMessageHistory()`, `closeRedis()` |
| `prompt.ts`       | Conversation prompt template        | `conversationPrompt`                                 |
| `agent.ts`        | Core AI logic                       | `chat(message, sessionId)`                           |
| `index.ts`        | CLI REPL interface                  | (entry point, no exports)                            |
| `server.ts`       | REST API (Stage 2, not created yet) | Express app                                          |

---

## How to Use These Notes

**If you're new to this project**: Read the setup guide first, then follow the reading order above.

**If you're stuck on an error**: Jump to the relevant file's explanation and search for keywords (e.g., Ctrl+F "ECONNREFUSED" in the sessionStore explanation).

**If you want to modify the code**: Read the explanation for the file you're changing to understand how it fits into the system.

**If you want to understand AI agents in general**: The intro in `00-setup-guide.md` explains the agent concept, and `04-agent-explained.md` shows how it's implemented.

---

## What's Next?

After reading these notes, you'll understand:

- How environment variables control the app's behavior.
- How Redis stores conversation history with automatic expiration.
- How prompt templates structure AI interactions.
- How LangChain's `RunnableWithMessageHistory` automates context management.
- How the CLI provides an interactive interface.

**Stage 2** (the REST API) will build on this foundation by wrapping `chat()` in HTTP endpoints. The core logic stays the same — only the interface changes.
