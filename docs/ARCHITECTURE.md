# Architecture Overview

## Clean Architecture with Background Embedding Queue

This application has been refactored to use a clean, efficient architecture for handling screenshots, embeddings, and RAG (Retrieval Augmented Generation).

## Key Components

### 1. Database (`src/database.ts`)
- **Purpose**: Persistent JSON-based storage for memories
- **Features**:
  - Stores memories with embedding status (`pending`, `processing`, `completed`, `failed`)
  - Atomic file operations with debounced saves
  - Query methods for embedded and pending memories
  - Statistics tracking

### 2. Embedding Queue (`src/embeddingQueue.ts`)
- **Purpose**: Background thread that processes embeddings sequentially
- **Features**:
  - Processes embeddings one by one to avoid overwhelming the embedding service
  - Runs continuously in background
  - Configurable processing delay
  - Automatic error handling and retry logic

### 3. Embeddings Module (`src/embeddings.ts`)
- **Purpose**: Handles embedding generation and similarity search
- **Features**:
  - Generates embeddings using Ollama
  - Cosine similarity calculation
  - RAG retrieval from database (only searches embedded memories)

## How It Works

### Screenshot Capture Flow
1. Screenshots are captured continuously
2. Duplicate detection using SSIM
3. AI generates description of screenshot
4. Memory is saved to database with `pending` status
5. Embedding queue picks it up for processing

### Embedding Processing Flow
1. Queue continuously monitors for pending memories
2. Picks oldest pending memory
3. Marks as `processing`
4. Generates embedding
5. Updates database with embedding and marks as `completed`
6. Moves to next pending memory

### RAG Query Flow
1. User asks a question
2. System checks for embedded memories
3. If none available, returns appropriate message
4. Otherwise, generates query embedding
5. Searches only embedded memories (not pending ones)
6. Returns top K most similar memories
7. Sends to AI with images for final answer

## Benefits of This Architecture

### 1. **Non-Blocking Operations**
- Screenshots continue capturing while embeddings process
- RAG works with available embeddings, doesn't wait for all
- No blocking operations in main thread

### 2. **Persistence**
- Memories survive application restarts
- JSON database is human-readable and debuggable
- No data loss on crash

### 3. **Rate Limiting**
- Embeddings process one at a time
- Configurable delay between embeddings
- Prevents overwhelming Ollama service

### 4. **Clean Separation of Concerns**
- Database handles storage
- Queue handles background processing
- Embeddings module handles ML operations
- Main files handle UI and flow

### 5. **Progressive Enhancement**
- RAG works with partial data
- System is useful even before all embeddings complete
- Clear status messages about pending work

## File Structure

```
src/
├── database.ts          # JSON database for memories
├── embeddingQueue.ts    # Background embedding processor
├── embeddings.ts        # Embedding generation & retrieval
├── index.ts            # CLI application
├── electron-main.ts    # Desktop application
├── model.ts            # AI model interactions
├── prompts.ts          # Prompt templates
└── renderer.ts         # UI frontend

data/
└── memories.json       # Persistent database (auto-generated)
```

## Configuration

Key parameters can be adjusted:

- **Processing Delay**: `new EmbeddingQueue(db, 1000)` - delay in ms between embeddings
- **Database Path**: `path.join(__dirname, 'data', 'memories.json')`
- **Top K Results**: `await retrieveTopK(question, db, 3)` - number of results

## Status Tracking

The database tracks memory status:
- `pending` - Waiting for embedding
- `processing` - Currently generating embedding
- `completed` - Embedding ready, memory searchable
- `failed` - Embedding generation failed

Statistics are available via `db.getStats()`:
- `total` - Total memories
- `embedded` - Completed embeddings
- `pending` - Waiting for processing
- `processing` - Currently being processed
- `failed` - Failed embeddings

