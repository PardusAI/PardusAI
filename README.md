# Memory Bench

A desktop application that captures screenshots, generates AI-powered descriptions, and enables natural language search through visual history using RAG (Retrieval-Augmented Generation).

## Features

- Modern Electron-based chat interface
- Automatic screenshot capture with duplicate detection
- AI-powered image descriptions using OpenRouter (Pixtral-12B)
- Semantic embeddings via Ollama's embeddinggemma model
- Natural language query system for screenshot retrieval
- System tray integration with memory counter
- Keyboard shortcuts for quick access

## Prerequisites

1. **Ollama** - Install from https://ollama.ai and pull the embedding model:
   ```bash
   ollama pull embeddinggemma:latest
   ```

2. **OpenRouter API Key** - Create a `.env` file:
   ```bash
   cp env.template .env
   ```
   Edit `.env` and add your API key from https://openrouter.ai/

3. **FFmpeg** - Required for image comparison:
   ```bash
   # macOS
   brew install ffmpeg
   
   # Ubuntu/Debian
   sudo apt-get install ffmpeg
   ```

## Installation

```bash
npm install
```

## Usage

### Electron Application
```bash
npm start
```

### Terminal Version
```bash
npm run terminal
```

### Docker
```bash
docker-compose up -d
docker-compose logs -f memory-bench
docker-compose down
```

## How It Works

The system operates two concurrent processes:

### Screenshot Capture
- Captures screenshots every 3 seconds
- Compares with previous captures to detect duplicates
- Processes unique screenshots in parallel:
  - Sends to OpenRouter for AI description
  - Generates semantic embedding
  - Stores with timestamp, path, description, and embedding

### Query Interface
- Natural language questions retrieve the top 3 relevant screenshots
- Actual images are sent to the vision model for analysis
- Real-time answers based on visual content

## Configuration

Edit `config.yml` to customize:
- Screenshot capture interval
- AI models (vision and embedding)
- RAG settings (top_k, similarity threshold)
- UI behavior (window size, timing)
- Keyboard shortcuts
- Debug settings

## Project Structure

```
memory-bench/
├── src/                      # TypeScript source
│   ├── electron-main.ts      # Main process
│   ├── preload.js            # IPC bridge
│   ├── renderer.ts           # UI logic
│   ├── index.ts              # Terminal version
│   ├── model.ts              # OpenRouter integration
│   ├── embeddings.ts         # Embeddings & RAG
│   └── prompts.ts            # AI prompts
├── dist/                     # Compiled JavaScript
├── tmp/                      # Screenshot storage
├── index.html                # UI
├── styles.css                # Styling
├── config.yml                # Configuration
└── .env                      # Environment variables
```

## Available Commands

```bash
npm start         # Build and run Electron app
npm run build     # Compile TypeScript
npm run clean     # Remove dist/ folder
npm run terminal  # Run terminal version
npm run dev       # Build and run in dev mode
```

## Troubleshooting

### Missing credentials error
- Verify `.env` file exists in project root
- Confirm API key is correctly set: `OPENROUTER_API_KEY=your-key`

### Memory counter at zero
- Check console for memory save logs
- Allow 5-10 seconds for first screenshot processing
- Verify Ollama is running: `ollama list`

### Build errors
```bash
npm run clean
npm run build
```

### Screenshot errors
- Verify FFmpeg installation: `ffmpeg -version`
- Check `tmp/` directory exists and is writable

### API connection issues
- Validate API key in `.env`
- Check network connectivity
- Verify model availability at OpenRouter status page

## Technologies

- **Electron** - Desktop application framework
- **TypeScript** - Type-safe development
- **OpenRouter** - AI vision API (Mistral Pixtral-12B)
- **Ollama** - Local embeddings (embeddinggemma)
- **screenshot-desktop** - Cross-platform capture
- **FFmpeg** - Image comparison

## Memory Entry Structure

```typescript
interface MemoryEntry {
  time: number;           // Unix timestamp
  imageUrl: string;       // Screenshot path
  description: string;    // AI-generated summary
  embedding: number[];    // Vector embedding
}
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

Refer to LICENSE
