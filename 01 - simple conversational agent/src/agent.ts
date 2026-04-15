import { ChatOllama } from "@langchain/ollama";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { config } from "./config";
import { messages, addMessage, closeStore } from "./sessionStore";

// Language model
const llm = new ChatOllama({
  baseUrl: config.ollama.baseUrl,
  model: config.ollama.model,
  temperature: 0.7,
});

// System prompt
const SYSTEM_PROMPT = `You are a helpful, friendly AI assistant for doing simple conversations with user. 
You remember everything said earlier in this conversation and refer back to it naturally.
Keep your answers concise unless the user asks for detail.`;

// Message conversion

/**
 * Convert simple messages to LangChain BaseMessage objects
 */
function convertToLangChainMessages() {
  return messages.map((msg) => {
    switch (msg.role) {
      case "user":
        return new HumanMessage(msg.content);
      case "assistant":
        return new AIMessage(msg.content);
      case "system":
        return new SystemMessage(msg.content);
      default:
        return new HumanMessage(msg.content);
    }
  });
}

// Public API

/**
 * Send a message to the agent and get a reply.
 * Agent directly accesses the messages array.
 */
export async function chat(userMessage: string): Promise<string> {
  // Add user message
  addMessage("user", userMessage);

  // Convert messages to LangChain format with system prompt
  const langchainMessages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...convertToLangChainMessages(),
  ];

  // Call LLM
  const response = await llm.invoke(langchainMessages);

  // Extract AI response
  const aiResponse =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  // Add AI response to messages
  addMessage("assistant", aiResponse);

  return aiResponse;
}

export { closeStore };
