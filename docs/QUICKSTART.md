# Quick Start Guide

Welcome to Memory Bench! This guide will get you up and running in 5 minutes.

## 🚀 Start Here

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
# Copy the template
cp env.template .env

# Edit .env and add your OpenRouter API key
# Get one from: https://openrouter.ai/
```

Your `.env` should look like:
```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

### 3. Install Ollama & Model

```bash
# Install from: https://ollama.ai
# Then pull the embedding model:
ollama pull embeddinggemma:latest
```

### 4. Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

### 5. Run the App

```bash
npm start
```

## ✅ That's It!

The app will:
- 📸 Start capturing screenshots every 3 seconds
- 🤖 Process them with AI in the background
- 💬 Show a chat interface at the bottom of your screen
- 📊 Display a live memory counter in the top bar

## 💬 Using the App

1. **Wait 10-20 seconds** for the first few memories to be captured
2. **Type a question** in the input box
3. **Press Enter** to get an AI answer based on your screenshots
4. **Quit** by pressing `ESC` or `Cmd+Q` / `Ctrl+Q`

## 📖 Example Questions

Try asking:
- "What was I working on?"
- "Show me the code I was viewing"
- "What websites did I visit?"
- "What was on my screen at 2pm?"

## 🐳 Alternative: Docker

If you prefer Docker:

```bash
# Start everything (app + Ollama)
docker-compose up -d

# View logs
docker-compose logs -f memory-bench

# Stop
docker-compose down
```

## ⚙️ Configuration

Edit `config.yml` to customize:
- Screenshot capture interval
- AI models
- UI behavior
- Keyboard shortcuts

## 🆘 Troubleshooting

**Memory counter stuck at 0?**
- Check terminal for error messages
- Verify Ollama is running: `ollama list`
- Check API key is set: `cat .env`

**Build errors?**
```bash
npm run clean
npm run build
```

**Need more help?**
- Check [README.md](README.md) for detailed documentation
- See [CONTRIBUTING.md](CONTRIBUTING.md) for development info

## 📚 Project Files

- **README.md** - Full documentation
- **CONTRIBUTING.md** - Development guide
- **config.yml** - Application settings
- **docker-compose.yml** - Docker setup
- **src/prompts.ts** - Centralized AI prompts

---

Enjoy using Memory Bench! 🎉

