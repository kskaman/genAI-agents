import * as fs from "fs";
import * as path from "path";
import {
  BaseMessage,
  StoredMessage,
  HumanMessage,
  AIMessage,
  mapStoredMessageToChatMessage,
  mapChatMessagesToStoredMessages,
} from "@langchain/core/messages";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";

import { config } from "./config";

// ── Session file structure ──────────────────────────────────────────────────
interface SessionFile {
  sessionId: string;
  createdAt: number;
  lastAccessed: number;
  messages: StoredMessage[]; // Serialized messages
}

// ── File-based Chat Message History ────────────────────────────────────────
class FileChatMessageHistory extends BaseChatMessageHistory {
  lc_namespace = ["langchain", "stores", "message", "file"];

  private sessionId: string;
  private filePath: string;
  private messages: BaseMessage[] = [];

  constructor(sessionId: string) {
    super();
    this.sessionId = sessionId;
    this.filePath = getSessionFilePath(sessionId);
    this.loadFromFile();
  }

  async getMessages(): Promise<BaseMessage[]> {
    return this.messages;
  }

  async addMessage(message: BaseMessage): Promise<void> {
    this.messages.push(message);
    await this.saveToFile();
  }

  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  async clear(): Promise<void> {
    this.messages = [];
    await this.saveToFile();
  }

  private loadFromFile(): void {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, "utf-8");
        const sessionFile: SessionFile = JSON.parse(data);

        // Deserialize messages
        this.messages = sessionFile.messages.map(mapStoredMessageToChatMessage);

        // Update last accessed time
        sessionFile.lastAccessed = Date.now();
        fs.writeFileSync(this.filePath, JSON.stringify(sessionFile, null, 2));
      } catch (error) {
        console.error(
          `[SessionStore] Error loading session ${this.sessionId}:`,
          error,
        );
        this.messages = [];
      }
    }
  }

  private async saveToFile(): Promise<void> {
    const sessionFile: SessionFile = {
      sessionId: this.sessionId,
      createdAt: this.getCreatedAt(),
      lastAccessed: Date.now(),
      messages: mapChatMessagesToStoredMessages(this.messages),
    };

    try {
      // Ensure directory exists
      ensureSessionDirExists();

      fs.writeFileSync(this.filePath, JSON.stringify(sessionFile, null, 2));
    } catch (error) {
      console.error(
        `[SessionStore] Error saving session ${this.sessionId}:`,
        error,
      );
    }
  }

  private getCreatedAt(): number {
    if (fs.existsSync(this.filePath)) {
      try {
        const data = fs.readFileSync(this.filePath, "utf-8");
        const sessionFile: SessionFile = JSON.parse(data);
        return sessionFile.createdAt;
      } catch {
        return Date.now();
      }
    }
    return Date.now();
  }
}

// ── Helper functions ────────────────────────────────────────────────────────
function ensureSessionDirExists(): void {
  if (!fs.existsSync(config.session.storageDir)) {
    fs.mkdirSync(config.session.storageDir, { recursive: true });
  }
}

function getSessionFilePath(sessionId: string): string {
  // Sanitize session ID to ensure it's safe for filenames
  const safeName = sessionId.replace(/[^a-zA-Z0-9-_]/g, "");
  return path.join(config.session.storageDir, `${safeName}.json`);
}

// ── Startup cleanup ─────────────────────────────────────────────────────────
// Clean up expired sessions on startup
function cleanupExpiredSessions(): void {
  if (!fs.existsSync(config.session.storageDir)) {
    return; // No sessions directory yet
  }

  const now = Date.now();
  const files = fs.readdirSync(config.session.storageDir);
  let deletedCount = 0;

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    const filePath = path.join(config.session.storageDir, file);
    try {
      const data = fs.readFileSync(filePath, "utf-8");
      const sessionFile: SessionFile = JSON.parse(data);

      // Check if TTL has expired
      if (now - sessionFile.lastAccessed > config.session.ttl) {
        fs.unlinkSync(filePath);
        deletedCount++;
        console.log(
          `[SessionStore] Deleted expired session: ${sessionFile.sessionId}`,
        );
      }
    } catch (error) {
      // If file is corrupted, delete it
      console.error(
        `[SessionStore] Corrupted session file ${file}, deleting...`,
      );
      fs.unlinkSync(filePath);
      deletedCount++;
    }
  }

  if (deletedCount > 0) {
    console.log(
      `[SessionStore] Cleaned up ${deletedCount} expired session(s) on startup`,
    );
  }
}

// Run cleanup on module load (startup)
cleanupExpiredSessions();

// ── Periodic cleanup ────────────────────────────────────────────────────────
// Automatically runs every hour to remove stale sessions
const cleanupInterval = setInterval(() => {
  cleanupExpiredSessions();
}, config.session.cleanupInterval);

// Don't keep Node.js process alive just for cleanup
cleanupInterval.unref();

// ── Session history factory ─────────────────────────────────────────────────
// Returns a FileChatMessageHistory bound to a specific sessionId.
// RunnableWithMessageHistory calls this function on every invoke(),
// so the same session across multiple turns always uses the same file.
export function getMessageHistory(sessionId: string): BaseChatMessageHistory {
  return new FileChatMessageHistory(sessionId);
}

// ── Session management utilities ────────────────────────────────────────────
export function clearSession(sessionId: string): boolean {
  const filePath = getSessionFilePath(sessionId);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

export function getSessionCount(): number {
  if (!fs.existsSync(config.session.storageDir)) {
    return 0;
  }
  const files = fs.readdirSync(config.session.storageDir);
  return files.filter((f) => f.endsWith(".json")).length;
}

export function getAllSessionIds(): string[] {
  if (!fs.existsSync(config.session.storageDir)) {
    return [];
  }

  const files = fs.readdirSync(config.session.storageDir);
  const sessionIds: string[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;

    try {
      const filePath = path.join(config.session.storageDir, file);
      const data = fs.readFileSync(filePath, "utf-8");
      const sessionFile: SessionFile = JSON.parse(data);
      sessionIds.push(sessionFile.sessionId);
    } catch (error) {
      // Skip corrupted files
    }
  }

  return sessionIds;
}

// ── Graceful shutdown ───────────────────────────────────────────────────────
export async function closeStore(): Promise<void> {
  clearInterval(cleanupInterval);
  console.log("[SessionStore] Shutdown complete (sessions preserved in files)");
}
