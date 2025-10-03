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
 * Results are ranked by a combined score of semantic similarity and recency
 * 
 * @param query - The query text
 * @param db - The memory database
 * @param k - Number of results to return (default: 3)
 * @returns Array of top K similar memory entries with their similarity scores
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

  // Current time for recency calculation
  const now = Date.now();

  // Calculate similarity with time-based attention for each memory
  const results = embeddedMemories
    .filter(memory => memory.embedding !== null)
    .map(memory => {
      const semanticSimilarity = cosineSimilarity(queryEmbedding, memory.embedding!);
      
      // Time penalty: 0.1 * hours_old
      // More recent images get a higher score
      const hoursOld = (now - memory.time) / (1000 * 60 * 60);
      const timePenalty = 0.01 * hoursOld;
      
      // Combined score: similarity minus time penalty
      const combinedScore = semanticSimilarity - timePenalty;
      
      return {
        memory,
        similarity: semanticSimilarity, // Keep original similarity for display
        combinedScore
      };
    });

  // Sort by combined score (similarity + recency) in descending order
  results.sort((a, b) => b.combinedScore - a.combinedScore);

  // Get top K results
  const topK = results.slice(0, k).map(({ memory, similarity }) => ({
    memory,
    similarity
  }));

  return topK;
}

