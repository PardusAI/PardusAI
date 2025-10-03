import fs from 'fs/promises';
import path from 'path';

export interface MemoryRecord {
  id: string;
  time: number;
  imageUrl: string;
  description: string;
  embedding: number[] | null;
  embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  embeddedAt: number | null;
}

export interface DatabaseState {
  memories: MemoryRecord[];
  version: string;
}

export class MemoryDatabase {
  private dbPath: string;
  private state: DatabaseState;
  private saveScheduled: boolean = false;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.state = {
      memories: [],
      version: '1.0.0'
    };
  }

  /**
   * Initialize database - load from file or create new
   */
  async initialize(): Promise<void> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      this.state = JSON.parse(data);
    } catch (error: any) {
      // If file doesn't exist, start with empty database
      if (error.code === 'ENOENT') {
        await this.save();
      } else {
        throw error;
      }
    }
  }

  /**
   * Save database to disk (debounced for performance)
   */
  private async save(): Promise<void> {
    if (this.saveScheduled) return;
    
    this.saveScheduled = true;
    
    // Debounce: wait 100ms before actually saving
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
      // Ensure directory exists
      const dir = path.dirname(this.dbPath);
      await fs.mkdir(dir, { recursive: true });
      
      // Write to temp file first, then rename (atomic operation)
      const tempPath = `${this.dbPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2), 'utf-8');
      await fs.rename(tempPath, this.dbPath);
    } finally {
      this.saveScheduled = false;
    }
  }

  /**
   * Add a new memory (without embedding initially)
   */
  async addMemory(imageUrl: string, description: string): Promise<string> {
    const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const record: MemoryRecord = {
      id,
      time: Date.now(),
      imageUrl,
      description,
      embedding: null,
      embeddingStatus: 'pending',
      createdAt: Date.now(),
      embeddedAt: null
    };
    
    this.state.memories.push(record);
    await this.save();
    
    return id;
  }

  /**
   * Update embedding for a memory
   */
  async updateEmbedding(id: string, embedding: number[]): Promise<void> {
    const memory = this.state.memories.find(m => m.id === id);
    
    if (!memory) {
      throw new Error(`Memory with id ${id} not found`);
    }
    
    memory.embedding = embedding;
    memory.embeddingStatus = 'completed';
    memory.embeddedAt = Date.now();
    
    await this.save();
  }

  /**
   * Mark embedding as failed
   */
  async markEmbeddingFailed(id: string): Promise<void> {
    const memory = this.state.memories.find(m => m.id === id);
    
    if (memory) {
      memory.embeddingStatus = 'failed';
      await this.save();
    }
  }

  /**
   * Mark embedding as processing
   */
  async markEmbeddingProcessing(id: string): Promise<void> {
    const memory = this.state.memories.find(m => m.id === id);
    
    if (memory) {
      memory.embeddingStatus = 'processing';
      await this.save();
    }
  }

  /**
   * Get all memories with completed embeddings
   */
  getEmbeddedMemories(): MemoryRecord[] {
    return this.state.memories.filter(
      m => m.embeddingStatus === 'completed' && m.embedding !== null
    );
  }

  /**
   * Get all memories pending embedding
   */
  getPendingMemories(): MemoryRecord[] {
    return this.state.memories.filter(
      m => m.embeddingStatus === 'pending'
    );
  }

  /**
   * Get memory by ID
   */
  getMemory(id: string): MemoryRecord | undefined {
    return this.state.memories.find(m => m.id === id);
  }

  /**
   * Get all memories (for debugging)
   */
  getAllMemories(): MemoryRecord[] {
    return [...this.state.memories];
  }

  /**
   * Get database statistics
   */
  getStats(): {
    total: number;
    embedded: number;
    pending: number;
    processing: number;
    failed: number;
  } {
    return {
      total: this.state.memories.length,
      embedded: this.state.memories.filter(m => m.embeddingStatus === 'completed').length,
      pending: this.state.memories.filter(m => m.embeddingStatus === 'pending').length,
      processing: this.state.memories.filter(m => m.embeddingStatus === 'processing').length,
      failed: this.state.memories.filter(m => m.embeddingStatus === 'failed').length
    };
  }
}

