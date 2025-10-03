import { Ollama } from 'ollama';
import { MemoryDatabase } from './database.js';
import type { MemoryRecord } from './database.js';
import { config } from './config.js';

// Initialize Ollama client with config
const ollama = new Ollama({
  host: config.ai.ollama.base_url
});

/**
 * Generate embeddings for text using Ollama's embedding model
 * @param text - The text to embed
 * @returns The embedding vector
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await ollama.embeddings({
      model: config.ai.ollama.model,
      prompt: text,
    });
    
    return response.embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Calculate cosine similarity between two vectors
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) * (a[i] ?? 0);
    normB += (b[i] ?? 0) * (b[i] ?? 0);
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * Retrieve the top K most similar memory entries from the database
 * Only searches through memories that have completed embeddings
 * Results are sorted by timestamp (newest first) after retrieval
 * 
 * @param query - The query text
 * @param db - The memory database
 * @param k - Number of results to return (default: 3)
 * @returns Array of top K similar memory entries with their similarity scores, ordered by timestamp
 */
export async function retrieveTopK(
  query: string,
  db: MemoryDatabase,
  k: number = 3
): Promise<Array<{ memory: MemoryRecord; similarity: number }>> {
  // Get only memories with completed embeddings
  const embeddedMemories = db.getEmbeddedMemories();
  
  if (embeddedMemories.length === 0) {
    return [];
  }

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Calculate similarity for each memory
  const results = embeddedMemories
    .filter(memory => memory.embedding !== null)
    .map(memory => ({
      memory,
      similarity: cosineSimilarity(queryEmbedding, memory.embedding!)
    }));

  // Sort by similarity in descending order to get top K
  results.sort((a, b) => b.similarity - a.similarity);

  // Get top K results
  const topK = results.slice(0, k);
  
  // Sort the top K results by timestamp (newest first)
  topK.sort((a, b) => b.memory.time - a.memory.time);

  return topK;
}

