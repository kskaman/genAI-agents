import "dotenv/config";

function required(value: string | undefined, key: string): string {
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const config = {
  ollama: {
    baseUrl: required(process.env.OLLAMA_BASE_URL, "OLLAMA_BASE_URL"),
    model: required(process.env.OLLAMA_MODEL, "OLLAMA_MODEL"),
  },
  session: {
    // Time-to-live in milliseconds before file-based sessions are cleaned up
    ttl: parseInt(required(process.env.SESSION_TTL, "SESSION_TTL")), // 24 hours default
    // How often to run cleanup (in milliseconds)
    cleanupInterval: parseInt(
      required(
        process.env.SESSION_CLEANUP_INTERVAL,
        "SESSION_CLEANUP_INTERVAL",
      ),
    ), // 24 hour default
    // Directory where session files are stored
    storageDir: required(
      process.env.SESSION_STORAGE_DIR,
      "SESSION_STORAGE_DIR",
    ), // .sessions/ default
  },
  server: {
    port: parseInt(required(process.env.PORT, "PORT")), // 3000 default
  },
} as const;
