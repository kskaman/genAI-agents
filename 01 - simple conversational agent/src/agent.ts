import { ChatOllama } from "@langchain/ollama";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { config } from "./config";
import { conversationPrompt } from "./prompt";
import { getMessageHistory, closeStore } from "./sessionStore";

// ── Language model ─────────────────────────────────────────────────────────
const llm = new ChatOllama({
  baseUrl: config.ollama.baseUrl,
  model: config.ollama.model,
  // Keep responses focused; raise to 0.9 for more creative conversations
  temperature: 0.7,
});

// ── Base chain: prompt → LLM ───────────────────────────────────────────────
// Produces an AIMessage. The chain itself is stateless — history is injected
// from the outside by RunnableWithMessageHistory below.
const baseChain = conversationPrompt.pipe(llm);

// ── History-aware chain ────────────────────────────────────────────────────
// Wraps the base chain so that on every invoke():
//   1. It calls getMessageHistory(sessionId) to load past messages from Redis
//   2. Injects them into the {history} placeholder
//   3. Runs the chain
//   4. Appends [HumanMessage, AIMessage] back to Redis
const chainWithHistory = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory,
  // Must match the MessagesPlaceholder key in prompt.ts
  historyMessagesKey: "history",
  // Must match the human message key in prompt.ts
  inputMessagesKey: "input",
});

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send a message to the agent and get a reply.
 *
 * @param userMessage  The text the user typed
 * @param sessionId    UUID that identifies this conversation in Redis
 * @returns            The AI's response as a plain string
 */
export async function chat(
  userMessage: string,
  sessionId: string,
): Promise<string> {
  const response = await chainWithHistory.invoke(
    { input: userMessage },
    { configurable: { sessionId } },
  );

  // AIMessage content may be a string or a complex content array
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

export { closeStore };
