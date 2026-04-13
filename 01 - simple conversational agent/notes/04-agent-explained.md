# Understanding agent.ts: The AI Brain

This file is the **core of the agent**. It connects the language model (Ollama), the prompt template, and the message history into a single function: `chat()`. Let's dissect every line.

---

## The Full Code

```typescript
import { ChatOllama } from "@langchain/ollama";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { config } from "./config";
import { conversationPrompt } from "./prompt";
import { getMessageHistory, closeRedis } from "./sessionStore";

const llm = new ChatOllama({
  baseUrl: config.ollama.baseUrl,
  model: config.ollama.model,
  temperature: 0.7,
});

const baseChain = conversationPrompt.pipe(llm);

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory,
  historyMessagesKey: "history",
  inputMessagesKey: "input",
});

export async function chat(
  userMessage: string,
  sessionId: string,
): Promise<string> {
  const response = await chainWithHistory.invoke(
    { input: userMessage },
    { configurable: { sessionId } },
  );

  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

export { closeRedis };
```

---

## Line-by-Line Breakdown

### Lines 1-5: Imports

```typescript
import { ChatOllama } from "@langchain/ollama";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { config } from "./config";
import { conversationPrompt } from "./prompt";
import { getMessageHistory, closeRedis } from "./sessionStore";
```

**`ChatOllama`**

- A LangChain class that talks to Ollama's API.
- It implements the `BaseChatModel` interface, so it works with all LangChain tools (chains, agents, etc.).
- When you call `llm.invoke(messages)`, it sends an HTTP POST to Ollama and returns the AI's response.

**`RunnableWithMessageHistory`**

- A wrapper that adds automatic history management to any LangChain "runnable" (chain, model, etc.).
- It handles: loading history → injecting it into the prompt → running the chain → saving new messages.
- This is the magic that makes context awareness work without us manually managing Redis.

**The rest**:

- `config`: Our environment variables (Ollama URL, model, etc.).
- `conversationPrompt`: The template we built in `prompt.ts`.
- `getMessageHistory`: The factory function that creates session-specific message stores.
- `closeRedis`: The cleanup function for shutting down the Redis connection.

---

### Lines 7-11: Creating the Language Model

```typescript
const llm = new ChatOllama({
  baseUrl: config.ollama.baseUrl,
  model: config.ollama.model,
  temperature: 0.7,
});
```

**What is this?** We're creating an instance of the Ollama chat model that our code will use to generate responses.

**Line by line**:

**`new ChatOllama({ ... })`**

- Creates a new Ollama client. LangChain will use this to send prompts and receive responses.

**`baseUrl: config.ollama.baseUrl`**

- Tells the client where Ollama is running (default: `http://localhost:11434`).
- When you call `llm.invoke()`, it makes an HTTP request to `http://localhost:11434/api/chat` (or similar).

**`model: config.ollama.model`**

- Which model to use (e.g., `llama3.2:3b`).
- Ollama can have multiple models installed (`ollama list`). This specifies which one to use for this agent.

**`temperature: 0.7`**

- **Temperature** controls randomness/creativity.
  - `0.0`: Deterministic (always picks the most likely next word) — good for factual tasks like "What's 2+2?"
  - `1.0`: Very random — good for creative writing.
  - `0.7`: Balanced — reliable but not robotic.

**Why 0.7?** For conversational agents, you want some personality without going off the rails. Too low (0.1) and the AI sounds repetitive ("Sure, I can help with that!"). Too high (1.5) and it hallucinates or goes off-topic.

**Can I change this?** Absolutely. Add `OLLAMA_TEMPERATURE=0.9` to `.env` and use `temperature: parseFloat(config.ollama.temperature)` to make it configurable.

---

### Line 13: Building the Base Chain

```typescript
const baseChain = conversationPrompt.pipe(llm);
```

**What is a "chain"?** In LangChain, a chain is a sequence of operations. Data flows from left to right like a Unix pipe.

**What does `.pipe()` do?**

- It connects two "runnables" (a prompt template and an LLM).
- The output of `conversationPrompt` becomes the input to `llm`.

**How it works**:

1. You call `baseChain.invoke({ input: "Hello" })`.
2. `conversationPrompt` takes `{ input: "Hello" }` and formats it into messages:
   ```typescript
   [SystemMessage("You are a helpful AI..."), HumanMessage("Hello")];
   ```
3. Those messages are "piped" into `llm.invoke(messages)`.
4. Ollama generates a response: `AIMessage("Hi! How can I help you?")`.
5. The chain returns that `AIMessage`.

**Why is it called `baseChain`?** Because it's the core logic (prompt + LLM), but it doesn't handle history yet. We add history in the next step.

---

### Lines 15-20: Adding History Management

```typescript
const chainWithHistory = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory,
  historyMessagesKey: "history",
  inputMessagesKey: "input",
});
```

**What is this?** We're wrapping `baseChain` with automatic history loading/saving.

**Line by line**:

**`new RunnableWithMessageHistory({ ... })`**

- This is a LangChain utility that intercepts chain invocations and injects history from a store.

**`runnable: baseChain`**

- The chain to wrap. This is the `conversationPrompt.pipe(llm)` we just created.

**`getMessageHistory`**

- A function that returns a message history object for a given session ID.
- LangChain will call `getMessageHistory(sessionId)` on every invoke to load past messages.
- We defined this in `sessionStore.ts` — it returns a `RedisChatMessageHistory` bound to Redis.

**`historyMessagesKey: "history"`**

- Tells LangChain which variable in the prompt template is the history placeholder.
- In `prompt.ts`, we have `new MessagesPlaceholder("history")`, so the key is `"history"`.
- LangChain will inject the loaded messages into this placeholder.

**`inputMessagesKey: "input"`**

- Tells LangChain which variable is the current user input.
- In `prompt.ts`, we have `["human", "{input}"]`, so the key is `"input"`.

**How does this work end-to-end?**

When you call `chainWithHistory.invoke({ input: "Hi" }, { configurable: { sessionId: "abc123" } })`:

1. **Load history**: LangChain calls `getMessageHistory("abc123")`, which returns a `RedisChatMessageHistory` for session `abc123`.
2. **Fetch messages**: LangChain calls `getMessages()` on that history object, which queries Redis: `GET message:abc123:*` → returns `[HumanMessage("Hello"), AIMessage("Hi!")]`.
3. **Inject history**: LangChain replaces `{history}` in the prompt with those messages.
4. **Inject input**: LangChain replaces `{input}` with `"Hi"`.
5. **Run the chain**: The prompt is now complete:
   ```typescript
   [
     SystemMessage("You are a helpful AI..."),
     HumanMessage("Hello"), // from history
     AIMessage("Hi!"), // from history
     HumanMessage("Hi"), // current input
   ];
   ```
   This gets sent to `llm.invoke()`.
6. **Get response**: Ollama generates `AIMessage("Hello again! How can I assist you?")`.
7. **Save messages**: LangChain saves two new messages to Redis:
   - `HumanMessage("Hi")`
   - `AIMessage("Hello again! How can I assist you?")`
     Both are stored under session `abc123` with a 24-hour TTL.

**Why is this powerful?** All that history management (load → inject → save) happens automatically. We don't write any Redis code in `chat()` — it just works.

---

### Lines 22-34: The Public API

```typescript
export async function chat(
  userMessage: string,
  sessionId: string,
): Promise<string> {
  const response = await chainWithHistory.invoke(
    { input: userMessage },
    { configurable: { sessionId } },
  );

  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}
```

**What is this?** The main function other parts of our code call to chat with the AI.

**Line by line**:

**`export async function chat(userMessage: string, sessionId: string): Promise<string>`**

- An asynchronous function (because AI requests take time).
- **Inputs**:
  - `userMessage`: What the user typed (e.g., `"What's the weather?"`).
  - `sessionId`: A UUID identifying this conversation (e.g., `"8f3a2b1c-..."`).
- **Output**: The AI's response as a plain string.

**`const response = await chainWithHistory.invoke(...)`**

- Calls the history-wrapped chain.
- `await` waits for the AI to generate a response (this can take 1-5 seconds depending on model size and hardware).

**First argument: `{ input: userMessage }`**

- This is the data we're passing to the chain.
- The key `input` matches the `inputMessagesKey: "input"` we defined earlier.
- LangChain will inject `userMessage` into the `{input}` placeholder in the prompt.

**Second argument: `{ configurable: { sessionId } }`**

- This is metadata for the chain.
- The `sessionId` tells `RunnableWithMessageHistory` which session to load history from.
- LangChain passes this to `getMessageHistory(sessionId)`.

**Why the weird nested structure?** LangChain uses `configurable` for any runtime settings that aren't part of the main data flow (like session ID, user ID, etc.). It keeps the API clean.

**`return typeof response.content === "string" ? response.content : JSON.stringify(response.content);`**

- The AI returns an `AIMessage` object that looks like:
  ```typescript
  {
    content: "Hello! How can I help?",
    additional_kwargs: {},
    response_metadata: { ... },
  }
  ```
- We only care about `content` (the actual text of the response).
- **Why the type check?** Some models return `content` as a complex object (e.g., multimodal models that return images + text). Most of the time it's a string, but if it's not, we convert it to JSON for safety.

**What we return**: Just the text — `"Hello! How can I help?"` — not the entire message object.

---

### Line 36: Re-exporting the Cleanup Function

```typescript
export { closeRedis };
```

**Why?** Other files (like `index.ts` and `server.ts`) need to close the Redis connection when the app shuts down. Instead of importing from `sessionStore.ts`, they can import from `agent.ts` (the main module).

**This is a convenience re-export**. It doesn't add functionality, just makes imports cleaner.

---

## The Flow of a Single Chat Turn

Let's trace what happens when a user sends a message:

**User action**:

```typescript
chat("What's my name?", "session-abc123");
```

**Step 1**: `chainWithHistory.invoke()` is called.

**Step 2**: `RunnableWithMessageHistory` calls `getMessageHistory("session-abc123")`.

**Step 3**: `RedisChatMessageHistory` queries Redis: `GET message:session-abc123:*` → returns:

```typescript
[HumanMessage("My name is Bob."), AIMessage("Nice to meet you, Bob!")];
```

**Step 4**: LangChain injects those into the `{history}` placeholder and injects `"What's my name?"` into `{input}`.

**Step 5**: The final prompt sent to Ollama:

```typescript
[
  SystemMessage("You are a helpful AI..."),
  HumanMessage("My name is Bob."),
  AIMessage("Nice to meet you, Bob!"),
  HumanMessage("What's my name?"),
];
```

**Step 6**: Ollama processes this and generates:

```typescript
AIMessage("Your name is Bob!");
```

**Step 7**: LangChain saves two new messages to Redis:

```typescript
HumanMessage("What's my name?");
AIMessage("Your name is Bob!");
```

**Step 8**: `chat()` extracts the content: `"Your name is Bob!"` and returns it.

**User sees**: `"Your name is Bob!"`

---

## Summary

**What this file does**:

1. Creates an Ollama chat model (`ChatOllama`).
2. Builds a chain: `prompt → LLM`.
3. Wraps the chain with automatic history management (`RunnableWithMessageHistory`).
4. Exports a simple `chat(message, sessionId)` function that handles everything.

**Why it's powerful**: You call one function (`chat()`), and behind the scenes:

- History is loaded from Redis.
- The prompt is assembled.
- The AI generates a response.
- New messages are saved back to Redis.

All the complexity is hidden. This is the power of LangChain's abstractions.
