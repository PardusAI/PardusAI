import { MemoryDatabase } from '../database/database.js';
import { generateEmbedding } from './embeddings.js';

/**
 * Embedding Queue - Processes embeddings one by one in background
 * 
 * This class manages a queue of memories that need embeddings.
 * It processes them sequentially to avoid overwhelming the embedding service.
 */
export class EmbeddingQueue {
  private db: MemoryDatabase;
  private isProcessing: boolean = false;
  private isRunning: boolean = false;
  private processingDelay: number;

  constructor(db: MemoryDatabase, processingDelay: number = 1000) {
    this.db = db;
    this.processingDelay = processingDelay;
  }

  /**
   * Start the background processing loop
   */
  start(): void {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    this.processLoop().catch(error => {
      console.error('Fatal error in embedding queue:', error);
    });
  }

  /**
   * Stop the background processing
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Main processing loop - runs continuously in background
   */
  private async processLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processNextBatch();
        
        // Wait before checking for next item
        await this.sleep(this.processingDelay);
      } catch (error) {
        console.error('Error in processing loop:', error);
        // Continue processing despite errors
        await this.sleep(this.processingDelay * 2);
      }
    }
  }

  /**
   * Process the next pending memory in the queue
   */
  private async processNextBatch(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    const pending = this.db.getPendingMemories();
    
    if (pending.length === 0) {
      return;
    }

    // Process the oldest pending memory
    const memory = pending[0];
    
    if (!memory) {
      return;
    }

    this.isProcessing = true;

    try {
      // Mark as processing
      await this.db.markEmbeddingProcessing(memory.id);
      
      // Generate embedding for the description
      const embedding = await generateEmbedding(memory.description);
      
      // Update database with embedding
      await this.db.updateEmbedding(memory.id, embedding);
      
    } catch (error) {
      console.error(`Failed to generate embedding for memory ${memory.id}:`, error);
      await this.db.markEmbeddingFailed(memory.id);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    isProcessing: boolean;
    isRunning: boolean;
    queueLength: number;
  } {
    return {
      isProcessing: this.isProcessing,
      isRunning: this.isRunning,
      queueLength: this.db.getPendingMemories().length
    };
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

