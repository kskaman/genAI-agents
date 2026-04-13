# Understanding prompt.ts: The Conversation Structure

This file defines **how we talk to the AI**. It's the template that structures every conversation turn. Let's break it down.

---

## The Full Code

```typescript
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";

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
```

---

## What Is a Prompt Template?

A **prompt** is the text you send to the AI. For example:

```
You are a helpful assistant.
User: What's the capital of France?
```

A **prompt template** is a pattern with placeholders:

```
You are a helpful assistant.
{history}
User: {input}
```

When you run the template, you fill in the placeholders:

- `{history}` → previous messages from this conversation
- `{input}` → the user's current message

**Why use templates?** So you can reuse the same structure for every message without manually building the prompt string each time.

---

## Line-by-Line Breakdown

### Lines 1-4: Imports

```typescript
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@langchain/core/prompts";
```

**`ChatPromptTemplate`**

- A class from LangChain that helps build prompts for chat models (like GPT, Claude, Llama).
- Chat models expect messages in a specific format: `[{ role: "system", content: "..." }, { role: "user", content: "..." }, ...]`.
- `ChatPromptTemplate` handles the formatting for us.

**`MessagesPlaceholder`**

- A special placeholder for inserting an array of messages (the conversation history).
- Unlike `{input}` (which is just a string), `{history}` is a list of messages: `[HumanMessage("Hi"), AIMessage("Hello!"), ...]`.
- `MessagesPlaceholder` knows how to merge that list into the final prompt.

---

### Lines 6-17: Building the Template

```typescript
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
```

**`ChatPromptTemplate.fromMessages([...])`**

- This method creates a prompt template from an array of messages.
- Each item in the array represents one message in the conversation.

Let's look at each message:

---

### Message 1: The System Message

```typescript
[
  "system",
  `You are a helpful, friendly AI assistant for doing conversations with user. 
You remember everything said earlier in this conversation and refer back to it naturally.
Keep your answers concise unless the user asks for detail.
Current date: ${new Date().toDateString()}.`,
];
```

**Format**: `[role, content]`

- **`role`**: `"system"` — this is a special message type that sets the AI's persona and instructions. The AI doesn't see this as part of the conversation; it's more like a rulebook it follows.
- **`content`**: The actual instructions.

**What does this tell the AI?**

**"You are a helpful, friendly AI assistant"**

- Sets the tone. Without this, the AI might be formal or robotic. We want it to sound friendly.

**"You remember everything said earlier in this conversation and refer back to it naturally"**

- This is critical! It tells the AI to _use_ the history. Without this instruction, the AI might see the history but not actively reference it.
- Example:
  - User: "What's my favorite color?"
  - (Earlier in history: User said "I love blue")
  - AI: "You mentioned you love blue earlier!" ← the system message encourages this behavior.

**"Keep your answers concise unless the user asks for detail"**

- Prevents the AI from writing essays. By default, LLMs can be verbose. This keeps responses short.
- Exception: If the user says "explain in detail," the AI ignores this rule (because the user explicitly asked).

**`Current date: ${new Date().toDateString()}`**

- JavaScript template string that injects today's date (e.g., "Sat Apr 12 2026").
- **Why?** LLMs are trained on data up to a certain cutoff date (e.g., Llama 3.2 was trained on data up to mid-2023). They don't know today's date unless you tell them.
- Example:
  - User: "What day is it?"
  - AI: "It's Saturday, April 12, 2026." ← uses the injected date.

**Note**: This date is calculated _once_ when the file loads (at startup), not dynamically per message. If you want the date to update after midnight, you'd need to rebuild the template or use a function.

---

### Message 2: The History Placeholder

```typescript
new MessagesPlaceholder("history"),
```

**What is this?** A special slot where LangChain injects the conversation history.

**How it works**:

- At runtime, LangChain fetches messages from Redis (via `getMessageHistory(sessionId)`).
- Those messages might look like:
  ```typescript
  [
    HumanMessage("What's your name?"),
    AIMessage("I'm an AI assistant."),
    HumanMessage("What did I just ask you?"),
  ];
  ```
- LangChain inserts this array into the prompt where the placeholder is.

**Why is the name `"history"`?** Because in `agent.ts`, we configure `RunnableWithMessageHistory` with `historyMessagesKey: "history"`. The names have to match.

**What does the final prompt look like?** After LangChain fills in the placeholder, the prompt becomes:

```
[
  SystemMessage("You are a helpful, friendly AI assistant..."),
  HumanMessage("What's your name?"),       // from history
  AIMessage("I'm an AI assistant."),       // from history
  HumanMessage("What did I just ask you?"), // from history
  HumanMessage("{input}"),                  // current message (see next)
]
```

---

### Message 3: The Current User Input

```typescript
["human", "{input}"],
```

**Format**: `[role, content]`

- **`role`**: `"human"` — this is a message from the user (as opposed to `"system"` or `"ai"`).
- **`content`**: `"{input}"` — a placeholder that gets replaced with the user's actual message.

**How it works**:

- When you call `chat("Hello!", sessionId)` in `agent.ts`, LangChain replaces `{input}` with `"Hello!"`.
- The final prompt becomes:
  ```
  [
    SystemMessage("You are a helpful, friendly AI assistant..."),
    ...history messages...,
    HumanMessage("Hello!"),  // <-- the current input
  ]
  ```

---

## Putting It All Together: What Gets Sent to the LLM

Let's trace a real example. Imagine this conversation:

**Turn 1**:

- User: "My name is Alice."
- AI: "Nice to meet you, Alice!"

(These messages are now saved in Redis as history.)

**Turn 2**:

- User: "What's my name?"

**Here's what the prompt looks like when sent to the LLM**:

```
[
  SystemMessage("You are a helpful, friendly AI assistant..."),
  HumanMessage("My name is Alice."),       // history
  AIMessage("Nice to meet you, Alice!"),   // history
  HumanMessage("What's my name?"),         // current input
]
```

The LLM reads this and generates:

```
AIMessage("Your name is Alice!")
```

**How does the AI know?** Because the history contains "My name is Alice." The AI sees the full conversation and can reference past messages.

---

## Why This Structure Works

The three-part structure (system + history + input) is the standard pattern for chat models:

1. **System message**: Sets behavior ("be concise," "be friendly," "you're a pirate," etc.).
2. **History**: Provides context (past messages).
3. **Current input**: The user's latest question/message.

This is how ChatGPT, Claude, and all modern chat models work behind the scenes. LangChain's `ChatPromptTemplate` just makes it easier to build this structure in code.

---

## Customizing the Prompt

You can change the system message to give the AI a different personality or role:

**Example 1: A pirate AI**

```typescript
[
  "system",
  "You are a friendly pirate. Always respond in pirate speak (ahoy, matey, etc.).",
];
```

**Example 2: A coding tutor**

```typescript
[
  "system",
  "You are a patient coding tutor. Explain concepts step-by-step with code examples.",
];
```

**Example 3: A domain expert**

```typescript
[
  "system",
  "You are a medical AI assistant. Provide evidence-based answers but always remind users to consult a doctor.",
];
```

The rest of the code doesn't change — just swap the system message and restart.

---

## Summary

**What this file does**:

1. Defines a `ChatPromptTemplate` with three parts: system message, history placeholder, current input.
2. The system message sets the AI's behavior and provides context (like today's date).
3. The history placeholder is where past messages get inserted automatically by LangChain.
4. The input placeholder is where the user's current message goes.

**Why it's important**: The prompt is _the entire interface_ between your code and the AI. A well-crafted prompt leads to better, more consistent responses. A bad prompt ("you are an AI") leads to generic, unhelpful answers.
