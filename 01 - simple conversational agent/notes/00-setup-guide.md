# Setup Guide: Getting Everything Running

Welcome! This guide walks you through setting up the conversational agent from scratch. Don't worry if you've never done this before - we'll go step by step.

---

## What You Need (Prerequisites)

Before we start coding, we need **two** pieces of software installed on your computer:

### 1. **Node.js** (the JavaScript runtime)

Think of Node.js as the engine that runs TypeScript/JavaScript code outside of a web browser. Our agent is a command-line program, so we need Node.js to execute it.

- **Download**: Go to [nodejs.org](https://nodejs.org) and download the LTS version (the "recommended for most users" one)
- **Check it worked**: Open a terminal and type `node --version` - you should see something like `v20.11.0`

### 2. **Ollama** (the local AI brain)

Ollama is software that runs large language models (LLMs) on your own computer - no internet required, no API keys, 100% free. It's like having ChatGPT running locally.

- **Download**: Go to [ollama.com](https://ollama.com) and download the Windows installer
- **Install it** (just click next a bunch of times)
- **Pull a model**: Open a terminal and run:
  ```powershell
  ollama pull llama3.2:3b
  ```
  This downloads the Llama 3.2 model (3 billion parameters - small enough to run fast on most laptops). It's about 2GB, so it'll take a minute.

**Check it worked**:

```powershell
ollama list
```

You should see `llama3.2:3b` in the list.

**Why this model?** Llama 3.2 (3 billion parameter version) is fast and good at conversations. If you have a beefier computer (16GB+ RAM), you can use `mistral:7b` instead for smarter responses - just change it in the `.env` file later.

---

## Project Setup (The Actual Code)

Now that the infrastructure is ready, let's set up the project itself.

### Step 1: Install Project Dependencies

Open a terminal in the project folder:

```powershell
cd "k:\building-ai-agents\01 - simple conversational agent"
```

Install all the TypeScript libraries we need:

```powershell
npm install
```

This reads `package.json` and downloads everything: LangChain (the AI framework), ioredis (talks to Redis), Express (for the REST API in Stage 2), TypeScript, and helper libraries.

**What just happened?** You now have a `node_modules/` folder with ~500MB of code. This is normal - modern JavaScript projects bundle lots of tiny dependencies.

### Step 2: Create the Environment File

Our code needs to know where Ollama and Redis are running. We store this in a file called `.env` (environment variables).

**Copy the example file**:

```powershell
Copy-Item .env.example .env
```

**Open `.env` in a text editor** (VS Code, Notepad, whatever you use) and check the values:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:3b
REDIS_URL=redis://localhost:6379
SESSION_TTL=86400
PORT=3000
```

**What each line means**:

- `OLLAMA_BASE_URL`: Where Ollama is running. `localhost:11434` is the default - Ollama automatically starts a server on port 11434 when you install it.
- `OLLAMA_MODEL`: Which AI model to use. We pulled `llama3.2:3b` earlier - that's what goes here. If you pulled a different model (like `mistral:7b`), change this to match.

- `SESSION_TTL`: Time-to-live in milliseconds. `86400000` = 24 hours. After 24 hours of inactivity, the session file is automatically deleted to save disk space. You can make this bigger (`604800000` = 1 week) or smaller (`3600000` = 1 hour).

- `SESSION_CLEANUP_INTERVAL`: How often to run cleanup (in milliseconds). `3600000*24` = 24 hour. Every hour, the app scans `.sessions/` and deletes expired files.

- `SESSION_STORAGE_DIR`: Where session files are stored. Default: `.sessions/` (relative to project root). You can change this to `sessions/production` or any other folder.

- `PORT`: The port for the REST API server (Stage 2). We'll use port 3000 - that's where `http://localhost:3000/chat` will be.

**Don't commit `.env` to Git!** That's why we have `.gitignore` - it blocks `.env` and `.sessions/` from getting uploaded. The `.env.example` file is safe to share (no secrets, just the template).

**Where are sessions stored?** In `.sessions/` folder (created automatically). Each conversation gets its own JSON file like `.sessions/8f3a2b1c-4d5e-6f7a-8b9c-0d1e2f3a4b5c.json`. You can open these files to see the conversation history!

---

## Running the Agent

### Stage 1: CLI (Command-Line Interface)

This is the simplest version - you type in the terminal, the AI replies in the terminal.

**Start it**:

```powershell
npm run dev
```

You'll see:

```
╔══════════════════════════════════════════╗
║   Conversational Agent  (Stage 1 · CLI)  ║
╚══════════════════════════════════════════╝
  Commands:  /session  /clear  /exit /help

  Session ID: 8f3a2b1c-...

You:
```

**Try it out**:

```
You: Hello! What's your name?
AI:  Hi! I don't have a personal name, but you can call me your AI assistant. How can I help you today?

You: What did I just ask you?
AI:  You just asked me what my name is!
```

**Commands**:

- `/session` - Shows the current session ID (useful for debugging)
- `/clear` - Generates a new session ID and starts fresh (old conversation file stays on disk until TTL expires)
- `/exit` - Quit the program
- `/help` - Shows the command list

**To stop it**: Type `/exit` or press `Ctrl+C`.

**Want to see your conversation?** Open `.sessions/{your-session-id}.json` in a text editor - it's human-readable JSON!

---

## What If Something Breaks?

### Error: "Missing required env var"

-> You forgot to create the `.env` file. Copy `.env.example` to `.env`.

### Error: "connect ECONNREFUSED 127.0.0.1:6379"

-> Redis isn't running. Run `docker start redis` or restart Docker Desktop.

### Error: "connect ECONNREFUSED 127.0.0.1:11434"

-> Ollama isn't running. On Windows, Ollama auto-starts, but if you stopped it, open the Ollama app or run `ollama serve` in a terminal.

### Error: "model 'llama3.2:3b' not found"

-> You didn't pull the model. Run `ollama pull llama3.2:3b`.

### The AI's responses are slow

-> Normal for 3B models on CPU. Upgrade to a GPU if you want speed, or try a smaller model like `llama3.2:1b` (faster but dumber).

### The AI forgot what I said earlier

-> Check Redis is running: `docker ps`. If Redis crashed, old sessions are gone (it's in-memory only unless you configure persistence).

---

## What's Next?

Stage 1 is working! You now have a conversational agent that:

- Runs a local LLM (no cloud, no API costs)
- Stores conversation history in Redis
- Remembers context across multiple turns

**Stage 2** (the REST API) will let you call this agent from _any_ frontend - a web app, a mobile app, Postman, curl, whatever. The core `chat()` function stays the same; we're just wrapping it in an HTTP endpoint.

Read [01-config-explained.md](./01-config-explained.md) next to understand how the code actually works!
