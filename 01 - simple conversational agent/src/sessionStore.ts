import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

// Types

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

// Session State (Plain Variables)

export let sessionId: string = "";
export let createdAt: number = 0;
export let messages: Message[] = [];

// Session Management

/**
 * Initialize a new session
 */
export function initSession(id: string): void {
  sessionId = id;
  createdAt = Date.now();
  messages = [];
  console.log(`[SessionStore] Initialized session: ${sessionId}`);
}

/**
 * Add a message to the current session
 */
export function addMessage(role: Message["role"], content: string): void {
  messages.push({ role, content });
}

/**
 * Clear all messages in the current session
 */
export function clearMessages(): void {
  messages = [];
  console.log(`[SessionStore] Cleared all messages`);
}

// File Persistence

/**
 * Save current session to file
 */
export function saveSession(): void {
  if (!sessionId || messages.length === 0) {
    console.log("\n[SessionStore] No messages to save\n");
    return;
  }

  const storageDir = config.session.storageDir;

  // Ensure directory exists
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const session = {
    sessionId,
    createdAt,
    messages,
  };

  const filePath = path.join(storageDir, `${sessionId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
  console.log(
    `[SessionStore] Saved ${messages.length} messages to ${sessionId}.json`,
  );
}

/**
 * Clean up expired session files based on TTL
 */
export function cleanupExpiredSessions(): void {
  const storageDir = config.session.storageDir;

  if (!fs.existsSync(storageDir)) {
    return;
  }

  const files = fs.readdirSync(storageDir);
  const now = Date.now();
  const ttl = config.session.ttl;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(storageDir, file);

    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const session = JSON.parse(data);

      console.log(now - session.createdAt + "\n" + ttl);
      // Check if session has expired
      if (now - session.createdAt > ttl) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`[SessionStore] Error processing ${file}:`, error);
    }
  }
}

// Shutdown

/**
 * Save session and cleanup before shutdown
 */
export async function closeStore(): Promise<void> {
  console.log("\n\n[SessionStore] Saving session before shutdown...");
  saveSession();
  console.log("[SessionStore] Shutdown complete");
}
