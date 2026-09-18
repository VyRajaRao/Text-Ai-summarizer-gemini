import { db, auth, collection, addDoc, getDocs, query, where, serverTimestamp, handleFirestoreError, OperationType } from '../lib/firebase';
import { generateEmbedding, generateBatchEmbeddings } from './gemini';

/**
 * Simple SHA-256 hash for text caching
 */
async function getTextHash(text: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Embedding Service with Caching and Batching
 */
export class EmbeddingService {
  private static collectionName = 'embeddings';

  /**
   * Get embedding for a single text with caching
   */
  static async getEmbedding(text: string): Promise<number[]> {
    const textHash = await getTextHash(text);
    
    // Check cache
    const cached = await this.getFromCache(textHash);
    if (cached) return cached;

    // Generate new
    const vector = await generateEmbedding(text);
    
    // Save to cache
    await this.saveToCache(textHash, text, vector);
    
    return vector;
  }

  /**
   * Get embeddings for multiple texts with caching and batching
   */
  static async getBatchEmbeddings(texts: string[]): Promise<number[][]> {
    const results: number[][] = new Array(texts.length);
    const hashes = await Promise.all(texts.map(t => getTextHash(t)));
    const missingIndices: number[] = [];
    const missingTexts: string[] = [];

    // Check cache for all
    for (let i = 0; i < texts.length; i++) {
      const cached = await this.getFromCache(hashes[i]);
      if (cached) {
        results[i] = cached;
      } else {
        missingIndices.push(i);
        missingTexts.push(texts[i]);
      }
    }

    // Batch generate missing
    if (missingTexts.length > 0) {
      // Gemini batch limit is usually around 100, but let's assume it fits for now
      // or implement chunking if needed.
      const batchVectors = await generateBatchEmbeddings(missingTexts);
      
      for (let i = 0; i < missingTexts.length; i++) {
        const index = missingIndices[i];
        results[index] = batchVectors[i];
        // Save to cache (async, don't block)
        this.saveToCache(hashes[index], missingTexts[i], batchVectors[i]).catch(console.error);
      }
    }

    return results;
  }

  /**
   * Compute cosine similarity between two vectors
   */
  static cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Find most similar texts in a set
   */
  static async findMostSimilar(queryText: string, candidates: string[], limit: number = 5): Promise<{ text: string, score: number }[]> {
    const queryVector = await this.getEmbedding(queryText);
    const candidateVectors = await this.getBatchEmbeddings(candidates);

    const scores = candidates.map((text, i) => ({
      text,
      score: this.cosineSimilarity(queryVector, candidateVectors[i])
    }));

    return scores.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  private static async getFromCache(textHash: string): Promise<number[] | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('textHash', '==', textHash)
      );
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data().vector;
      }
    } catch (error) {
      console.error('Cache read error:', error);
      handleFirestoreError(error, OperationType.GET, this.collectionName);
    }
    return null;
  }

  private static async saveToCache(textHash: string, text: string, vector: number[]): Promise<void> {
    try {
      await addDoc(collection(db, this.collectionName), {
        textHash,
        text: text.substring(0, 1000), // Store snippet for reference
        vector,
        userId: auth.currentUser?.uid || 'anonymous',
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Cache write error:', error);
      handleFirestoreError(error, OperationType.CREATE, this.collectionName);
    }
  }
}
