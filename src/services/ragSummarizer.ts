import { GoogleGenAI, Type } from "@google/genai";
import { GeminiManager } from "./gemini";
import { EmbeddingService } from "./embeddingService";
import { CacheService } from "./cacheService";

export interface RAGSummaryOutput {
  executiveSummary: string;
  keyInsights: string[];
  importantFacts: string[];
  technicalConcepts: string[];
}

/**
 * Advanced Retrieval-Augmented Generation (RAG) Summarization Pipeline.
 * 
 * Flow:
 * PDF/Text Input -> Chunking -> embeddingService.ts -> Vector Store -> Retriever -> RAG Query Optimizer -> Gemini LLM -> Structured Summary -> cacheService.ts -> Frontend
 */
export class RAGSummarizerService {
  private static CACHE_TYPE = "rag_summarization_json";

  /**
   * Helper to chunk the text following the same boundary logic as the application
   */
  static splitIntoChunks(content: string): string[] {
    return content
      .split(/\n\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 20);
  }

  /**
   * Main RAG Summarization method
   * @param content Original text content
   * @param docId The ID/title of the document for caching/identification
   * @param queryIntent Optional custom prompt query to optimize the retrieval for specific focus
   */
  static async generateRAGSummary(
    content: string, 
    docId: string, 
    queryIntent: string = "executive summary, core themes, key insights, important facts, technical concepts, architectural details"
  ): Promise<RAGSummaryOutput> {
    
    // 1. Check LocalStorage via cacheService.ts
    const cacheKey = `${docId}_intent_${queryIntent.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
    const cached = CacheService.get<RAGSummaryOutput>(content, `${this.CACHE_TYPE}_${cacheKey}`);
    if (cached) {
      console.log("[RAGSummarizer] Cache HIT.");
      return cached;
    }

    console.log("[RAGSummarizer] Cache MISS. Commencing RAG Pipeline.");

    // 2. Step 1: Chunking (Do not modify chunk boundaries)
    const chunks = this.splitIntoChunks(content);
    if (chunks.length === 0) {
      return this.emptyResponse("Insufficient context available.");
    }

    // 3. Step 2 & 3: Generation & vector storage (done handled cleanly via EmbeddingService)
    // We get the embeddings for all chunks through the caching-backed batch embedding generator
    console.log(`[RAGSummarizer] Chunking complete. Total Chunks: ${chunks.length}. Preparing embeddings...`);
    const chunkVectors = await EmbeddingService.getBatchEmbeddings(chunks);

    // 4. Step 4: Retriever - Cosine similarity semantic search
    // We rank chunks based on similarity with the queryIntent to construct the RAG Context Store
    console.log(`[RAGSummarizer] Querying vector-space with intent: "${queryIntent}"`);
    const queryVector = await EmbeddingService.getEmbedding(queryIntent);
    
    const ratedChunks = chunks.map((chunk, index) => {
      const score = EmbeddingService.cosineSimilarity(queryVector, chunkVectors[index]);
      return { chunk, score, index };
    });

    // Sort by highest similarity confidence
    ratedChunks.sort((a, b) => b.score - a.score);

    // Filter or select top chunks. 
    // We prioritize higher-confidence content, but keep logical/chronological sequence for the RAG LLM.
    const topK = Math.min(12, Math.ceil(chunks.length * 0.7)); // Retrieve up to top 70% or max 12 chunks
    const retrievedItems = ratedChunks.slice(0, topK);

    // Restore logical/chronological order of chunks to maintain coherence
    retrievedItems.sort((a, b) => a.index - b.index);
    const retrievedChunks = retrievedItems.map(item => item.chunk);

    console.log(`[RAGSummarizer] Retrieved ${retrievedChunks.length} chunks of knowledge.`);

    // 5. Step 5: Hierarchical summarization if document collection is large
    let contextText = "";
    if (chunks.length > 15) {
      // Long Document Optimization: Map-Reduce Summarization
      console.log("[RAGSummarizer] Large document detected (>15 chunks). Executing Hierarchical summarization.");
      contextText = await this.performHierarchicalAggregation(retrievedChunks);
    } else {
      // Direct context aggregation
      contextText = retrievedChunks.join("\n\n---\n\n");
    }

    // 6. Step 6: RAG Query Optimizer & Structured JSON Generation via Gemini
    console.log("[RAGSummarizer] Optimizing query and prompting Gemini LLM...");
    const result = await this.generateStructuredSummaryFromContext(contextText, queryIntent);

    // 7. Step 7: Cache via cacheService.ts
    CacheService.set(content, `${this.CACHE_TYPE}_${cacheKey}`, result);
    return result;
  }

  /**
   * Helper to summarize sub-groups of chunks before merging (Map-Reduce)
   */
  private static async performHierarchicalAggregation(chunks: string[]): Promise<string> {
    const client = GeminiManager.getClient();
    const groupSize = 4;
    const miniSummaries: string[] = [];

    // Map Phase: Summarize smaller clusters of chunks
    for (let i = 0; i < chunks.length; i += groupSize) {
      const slice = chunks.slice(i, i + groupSize);
      const combinedSlice = slice.join("\n\n");
      
      console.log(`[RAGSummarizer] Summarizing chunk block ${Math.floor(i/groupSize) + 1}...`);
      
      try {
        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Analyze these retrieved document chunks. Generate a precise intermediate summary merging duplicate points, preserving factual terminology, technical details, code blocks, metrics, and conceptual relationships.\n\nDOCUMENT CHUNKS:\n${combinedSlice}`,
          config: {
            systemInstruction: "You are an intermediate summarization aggregator. Reduce redundancy. Ground strictly in the provided text."
          }
        });
        
        if (response.text) {
          miniSummaries.push(response.text.trim());
        }
      } catch (err) {
        console.error(`[RAGSummarizer] Intermediate chunk summary failed, using raw chunks. Error:`, err);
        miniSummaries.push(combinedSlice);
      }
    }

    // Reduce Phase: Merge intermediate summaries
    return miniSummaries.join("\n\n---\n\n");
  }

  /**
   * Structured JSON summarization grounded strictly in RAG context
   */
  private static async generateStructuredSummaryFromContext(context: string, queryIntent: string): Promise<RAGSummaryOutput> {
    const client = GeminiManager.getClient();

    try {
      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `You are an advanced RAG Summarization engine. Your task is to generate a highly accurate, structured summary strictly grounded in the retrieved chunks/intermediate context below.
        
        SYSTEM RULES:
        1. GROUNDING: Base all statements ONLY on info present in the context. Never assume or extrapolate. Never introduce facts not explicitly in target text.
        2. SUFFICIENCY: If there is no context or context is insufficient to derive keyInsights, importantFacts, or technicalConcepts, explicitly fill that field or list with "[Insufficient context available.]".
        3. REDUNDANCY: Merge duplicate points. Prioritize high-value facts. Maintain logical flow.
        4. TECHNICALS: Retain all names, key terminology, numbers, parameters, code snippets, and architecture configurations verbatim.
        
        CONTEXT FOR SUMMARIZATION:
        ${context}
        
        SUMMARIZATION QUERY INTENT FOCUS:
        ${queryIntent}`,
        
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { 
                type: Type.STRING, 
                description: "Executive high level summary of the document. Concise and fully grounded." 
              },
              keyInsights: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of core insights and themes discovered. Grounded strictly."
              },
              importantFacts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "List of absolute key facts, dates, names, metrics, and numerical data."
              },
              technicalConcepts: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Technical terminologies, architectural plans, configurations, or code structures discussed. If none, return '[Insufficient context available.]'."
              }
            },
            required: ["executiveSummary", "keyInsights", "importantFacts", "technicalConcepts"]
          }
        }
      });

      if (!response.text) {
        throw new Error("Empty response from LLM");
      }

      const decoded = JSON.parse(response.text.trim());
      
      // Clean lists from empty values or format them accurately
      return {
        executiveSummary: decoded.executiveSummary || "Insufficient context available.",
        keyInsights: Array.isArray(decoded.keyInsights) && decoded.keyInsights.length > 0 ? decoded.keyInsights : ["Insufficient context available."],
        importantFacts: Array.isArray(decoded.importantFacts) && decoded.importantFacts.length > 0 ? decoded.importantFacts : ["Insufficient context available."],
        technicalConcepts: Array.isArray(decoded.technicalConcepts) && decoded.technicalConcepts.length > 0 ? decoded.technicalConcepts : ["Insufficient context available."]
      };

    } catch (err) {
      console.error("[RAGSummarizer] Final JSON summarization generation failed. Error:", err);
      return this.emptyResponse("Failed to generate summary due to processing error.");
    }
  }

  private static emptyResponse(message: string): RAGSummaryOutput {
    return {
      executiveSummary: message,
      keyInsights: [message],
      importantFacts: [message],
      technicalConcepts: [message]
    };
  }
}
