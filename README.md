# Memory Bench - Screenshot Memory System with RAG

A beautiful Electron chat application that captures screenshots, generates descriptions using AI, creates embeddings, and allows you to query your visual history through a modern chat interface.

![Memory Bench](screenshot.png)

## ✨ Features

- 💬 **Modern Chat Interface**: Beautiful Electron app with real-time chat UI
- 🖼️ **Automatic Screenshot Capture**: Captures screenshots every 3s with duplicate detection
- 🤖 **AI-Powered Summaries**: Uses OpenRouter (Pixtral-12B) to generate descriptions of screenshots
- 🧠 **Semantic Embeddings**: Creates vector embeddings using Ollama's embeddinggemma model
- 🔍 **RAG-Based Retrieval**: Find relevant screenshots using natural language queries
- 📊 **Live Memory Counter**: See the number of captured memories update in real-time
- 🎛️ **System Tray Icon**: Menu bar icon with memory count and easy quit option
- ⌨️ **Keyboard Shortcuts**: ESC or ⌘Q/Ctrl+Q to quit instantly

## 🚀 Quick Start

### Prerequisites

1. **Ollama**: Install Ollama and pull the embedding model:
   ```bash
   # Install Ollama from https://ollama.ai
   ollama pull embeddinggemma:latest
   ```

2. **OpenRouter API Key**: Create a `.env` file in the project root:
   ```bash
   # Copy the template
   cp env.template .env
   
   # Then edit .env and add your actual API key
   OPENROUTER_API_KEY=your-actual-api-key-here
   ```
   
   Get your API key from [https://openrouter.ai/](https://openrouter.ai/)

3. **FFmpeg**: Required for image comparison:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt-get install ffmpeg
   ```

### Installation

```bash
npm install
```

### Usage

#### Start the Electron App (Recommended)

```bash
npm start
```

This will compile TypeScript and launch the Electron chat application with a modern UI.

#### Terminal Version (Alternative)

```bash
npm run terminal
```

This runs the original terminal-based version.

#### Using Docker

```bash
# Start with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f memory-bench

# Stop
docker-compose down
```

## 📖 How It Works

The system runs **two concurrent processes**:

### 1. Continuous Screenshot Capture (Background - Silent)

- **Non-blocking capture**: Takes screenshots every 3 seconds continuously
- Each screenshot immediately spawns a background processing thread
- **No waiting** - capture continues while AI processes images in parallel
- Compares with previous screenshot to avoid duplicates
- For each unique screenshot (processed in parallel):
  - Sends to OpenRouter for AI-generated description
  - Generates semantic embedding of the description
  - Stores in memory with timestamp, image path, description, and embedding
- Runs completely silently without logging
- **Result**: Maximum information capture with zero data loss

### 2. Interactive Q&A (Foreground)

- **Ask questions anytime** - no waiting required!
- Type your question and press Enter
- System retrieves the top 3 most relevant screenshots using cosine similarity
- **Sends actual images** to the vision model (not just descriptions)
- Model analyzes the real screenshots and answers based on what it sees
- Ask as many questions as you want, whenever you want

Both processes run simultaneously - screenshots are continuously captured in the background while you can freely ask questions at any time!

## 💡 Example Questions

- "What was I working on around 2pm?"
- "Show me when I was looking at documentation"
- "What code files did I have open?"
- "When was I browsing social media?"

## 📁 Project Structure

```
memory-bench/
├── src/                      # TypeScript source files
│   ├── electron-main.ts      # Electron main process
│   ├── preload.ts            # IPC bridge
│   ├── renderer.ts           # UI logic
│   ├── index.ts              # Terminal version
│   ├── model.ts              # OpenRouter integration
│   ├── embeddings.ts         # Ollama embeddings & RAG
│   ├── prompts.ts            # Centralized AI prompts
│   └── screenshot-desktop.d.ts # Type declarations
├── dist/                     # Compiled JavaScript (generated)
├── tmp/                      # Screenshot storage
├── index.html                # Chat UI
├── styles.css                # UI styling
├── config.yml                # Application configuration
├── docker-compose.yml        # Docker setup
├── .env                      # Environment variables (create this!)
├── env.template              # .env template
└── package.json              # Dependencies and scripts
```

## ⚙️ Configuration

Edit `config.yml` to customize:

- Screenshot capture interval
- AI models (vision and embedding)
- RAG settings (top_k, similarity threshold)
- UI behavior (window size, popup timing)
- Keyboard shortcuts
- Debug settings

## 🛠️ Available Commands

```bash
npm start         # Build and run Electron app
npm run build     # Just build TypeScript
npm run clean     # Remove dist/ folder
npm run terminal  # Run terminal version (no UI)
npm run dev       # Build and run in dev mode
```

## 🔧 Troubleshooting

### "Missing credentials" error

- Make sure you've created the `.env` file in the project root
- Make sure your API key is correctly set in `.env`
- The file should contain: `OPENROUTER_API_KEY=your-actual-key`

### Memory counter stuck at "0 memories"

1. Check console logs: Should see `💾 Memory saved! Total: X`
2. Wait a bit longer: First screenshot takes 5-10 seconds to process
3. Check Ollama is running: `ollama list`

### Build errors

```bash
npm run clean
npm run build
```

### Screenshot errors

- Make sure FFmpeg is installed: `ffmpeg -version`
- Check that the `tmp/` directory exists and is writable

### API Connection Errors

1. **Check Your API Key**: Verify `.env` has valid OpenRouter API key
2. **Network Connectivity**: Check internet connection
3. **Rate Limiting**: The app automatically handles rate limits with delays
4. **Model Availability**: Check OpenRouter status page

### No response when asking questions

1. Check console for detailed error messages
2. Verify API key is valid at https://openrouter.ai/
3. Ensure Ollama is running for embeddings
4. Check that memories are being captured (watch console logs)

## 🏗️ Technologies

- **Electron**: Cross-platform desktop application framework
- **TypeScript**: Type-safe development
- **OpenRouter**: AI chat and vision API (using Mistral Pixtral-12B)
- **Ollama**: Local embeddings (embeddinggemma model)
- **screenshot-desktop**: Cross-platform screenshot capture
- **FFmpeg**: Image comparison for duplicate detection

## 📊 Memory Entry Structure

```typescript
interface MemoryEntry {
  time: number;           // Unix timestamp
  imageUrl: string;       // Path to screenshot
  description: string;    // AI-generated summary
  embedding: number[];    // Vector embedding
}
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines and setup.

## 📝 License

ISC

---

**Ready to go!** Just run `npm start` and watch the magic happen! ✨
