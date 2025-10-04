# Pardus AI

Your Personal AI Assistant

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
