# Understanding sessionStore.ts: The File-Based Memory Manager

This file handles **conversation persistence**. Every message you exchange with the AI gets saved to a JSON file on disk so the AI can remember what you said earlier — even after you restart the program! Let's break down how it works, line by line.

---

## Overview: File-Based vs In-Memory vs Redis

This implementation uses **file-based storage** — a middle ground between pure in-memory (volatile) and Redis (requires external service):

| Approach       | Persistence          | Setup                | Multi-Server | Best For                |
| -------------- | -------------------- | -------------------- | ------------ | ----------------------- |
| **In-Memory**  | ❌ Lost on restart   | ✅ Zero setup        | ❌ No        | Quick prototypes        |
| **File-Based** | ✅ Survives restarts | ✅ Zero dependencies | ❌ No        | Solo projects, learning |
| **Redis**      | ✅ Durable           | ⚠️ Requires Redis    | ✅ Yes       | Production, scale       |

**Why files for this tutorial?** No Redis to install, sessions persist across restarts, simple to understand, and you can inspect the JSON files directly to see what's stored.

---

## How It Works (Big Picture)

1. **On first message**: Create `.sessions/abc123.json` with the session ID, timestamps, and an empty messages array.
2. **On each turn**: Append the human and AI messages to the array, update `lastAccessed` timestamp.
3. **On startup**: Scan `.sessions/` folder, delete any files where `lastAccessed` is older than 24 hours.
4. **On periodic cleanup**: Every hour, repeat the startup cleanup.
5. **On shutdown**: Stop the cleanup timer (files stay on disk).

---

## Session File Example

Each session is stored as a JSON file in `.sessions/`:

**`.sessions/8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c.json`**:

```json
{
  "sessionId": "8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
  "createdAt": 1744752000000,
  "lastAccessed": 1744752300000,
  "messages": [
    {
      "type": "human",
      "content": "Hello!"
    },
    {
      "type": "ai",
      "content": "Hi! How can I help you?"
    }
  ]
}
```

**Fields**:

- **`sessionId`**: UUID identifying this conversation
- **`createdAt`**: When the session was first created (Unix timestamp in milliseconds)
- **`lastAccessed`**: Last time a message was sent/received (updated on every interaction)
- **`messages`**: Array of serialized chat messages

**TTL Cleanup**: If `Date.now() - lastAccessed > 24 hours`, the file is deleted.

---

## Key Concepts

### The FileChatMessageHistory Class

This extends LangChain's `BaseChatMessageHistory` to store messages in JSON files instead of memory or Redis.

**Core methods**:

- **`getMessages()`**: Returns the messages array (loaded from file on construction)
- **`addMessage()`**: Appends a message and saves to file
- **`clear()`**: Empties the messages array and saves

**Lifecycle**:

1. **On construction**: Load existing session from file (if it exists)
2. **On `addMessage()`**: Append to in-memory array, then save entire array to file
3. **On `loadFromFile()`**: Read JSON, deserialize messages, update `lastAccessed`
4. **On `saveToFile()`**: Serialize messages, write JSON with pretty-printing

### Startup Cleanup

When the module loads (when `src/sessionStore.ts` is imported):

```typescript
cleanupExpiredSessions(); // Runs immediately
```

This scans `.sessions/` and deletes:

- Files where `lastAccessed` is older than TTL (24 hours default)
- Corrupted JSON files (parse errors)

**Why?** If the app was offline for days, expired sessions accumulate. Cleanup on startup prevents disk bloat.

### Periodic Cleanup

Every hour (configurable via `SESSION_CLEANUP_INTERVAL`):

```typescript
const cleanupInterval = setInterval(() => {
  cleanupExpiredSessions();
}, config.session.cleanupInterval);
```

This repeats the same cleanup logic as startup.

**Why hourly?** Balance between disk space management and performance (scanning files has overhead).

### File Safety

**Filename sanitization**:

```typescript
const safeName = sessionId.replace(/[^a-zA-Z0-9-_]/g, "");
```

Strips anything that's not alphanumeric, hyphen, or underscore. Prevents path traversal attacks.

**Directory creation**:

```typescript
fs.mkdirSync(config.session.storageDir, { recursive: true });
```

Ensures `.sessions/` exists before writing files (like `mkdir -p`).

---

## How It Integrates with the Agent

In `agent.ts`:

```typescript
import { getMessageHistory } from "./sessionStore";

const chainWithHistory = new RunnableWithMessageHistory({
  runnable: baseChain,
  getMessageHistory, // Factory function
  historyMessagesKey: "history",
  inputMessagesKey: "input",
});
```

**Flow for a single chat turn**:

1. User sends `"What's my name?"` with session ID `abc123`
2. `RunnableWithMessageHistory` calls `getMessageHistory("abc123")`
3. Returns a `FileChatMessageHistory` instance
4. Automatically loads messages from `.sessions/abc123.json`
5. LangChain calls `getMessages()` → returns `[HumanMessage("My name is Alice"), ...]`
6. Injects into prompt's `{history}` placeholder
7. AI generates response: `"Your name is Alice"`
8. LangChain calls `addMessage()` twice:
   - `HumanMessage("What's my name?")`
   - `AIMessage("Your name is Alice")`
9. Both are appended to `abc123.json` and saved

---

## Configuration

In `.env`:

```env
SESSION_TTL=86400000              # 24 hours in milliseconds
SESSION_CLEANUP_INTERVAL=3600000  # 1 hour in milliseconds
SESSION_STORAGE_DIR=.sessions     # Where to store files
```

**Customization**:

- **Shorter TTL**: `3600000` (1 hour) for demo/testing
- **Longer TTL**: `604800000` (1 week) for long-lived projects
- **Different folder**: `sessions/production` for multi-environment setups

---

## Exported Functions

**`getMessageHistory(sessionId)`**: Returns a history object for the session (creates if new, loads if existing)

**`clearSession(sessionId)`**: Deletes the session file

**`getSessionCount()`**: Returns number of active sessions

**`getAllSessionIds()`**: Returns array of all session IDs

**`closeStore()`**: Stops cleanup timer (graceful shutdown)

---

## Summary

**What this file does**:

1. Implements file-based message history using `.sessions/{sessionId}.json` files
2. Automatically cleans up expired sessions on startup and hourly
3. Tracks `createdAt` and `lastAccessed` timestamps for TTL management
4. Provides LangChain-compatible API (`getMessageHistory`)

**Benefits**:

- ✅ No external dependencies (no Redis)
- ✅ Persists across restarts
- ✅ Easy to inspect (human-readable JSON)
- ✅ Automatic expiration (TTL-based cleanup)

**Trade-offs**:

- ⚠️ Single-server only (files are local)
- ⚠️ Slower than Redis at scale
- ⚠️ No atomic operations (race conditions possible if accessed from multiple processes)

For a learning project or single-user agent, this is the sweet spot!
