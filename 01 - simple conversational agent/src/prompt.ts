import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

// ── Conversation prompt structure ──────────────────────────────────────────
//
//  [ system ]   → sets the AI's role / persona (never changes)
//  [ history ]  → MessagesPlaceholder injected by RunnableWithMessageHistory
//  [ human  ]   → the current user message
//
// RunnableWithMessageHistory will automatically fill in {history} before
// the chain runs, and persist the new messages after.

export const conversationPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    `You are a helpful, friendly AI assistant for doing conversations with user. 
You remember everything said earlier in this conversation and refer back to it naturally.
Keep your answers concise unless the user asks for detail.
Current date: ${new Date().toDateString()}.`,
  ],
  new MessagesPlaceholder("history"),
  ["human", "{input}"],
]);
