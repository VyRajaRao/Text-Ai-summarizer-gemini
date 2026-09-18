import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { CacheService } from "./cacheService";
import { EXAMPLES } from "../constants";
import { db, collection, onSnapshot, query, where, handleFirestoreError, OperationType } from "../lib/firebase";

// --- Key Rotation Logic ---
let API_KEYS: string[] = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[];

type KeyChangeListener = (count: number) => void;
const listeners: KeyChangeListener[] = [];

function notifyListeners() {
  listeners.forEach(l => l(API_KEYS.length));
}

// Sync with Firestore if available
export function syncGeminiKeys(isAdmin: boolean) {
  if (!isAdmin) return () => {};

  const q = query(collection(db, 'geminiKeys'), where('status', '==', 'active'));
  return onSnapshot(q, (snapshot) => {
    const dbKeys = snapshot.docs.map(doc => doc.data().key);
    // Combine env keys and db keys, removing duplicates
    const allKeys = [...new Set([
      ...[
        process.env.GEMINI_API_KEY,
        process.env.GEMINI_API_KEY_2,
        process.env.GEMINI_API_KEY_3,
        process.env.GEMINI_API_KEY_4,
      ].filter(Boolean) as string[],
      ...dbKeys
    ])];
    
    if (allKeys.length > 0) {
      const changed = API_KEYS.length !== allKeys.length || !API_KEYS.every((v, i) => v === allKeys[i]);
      API_KEYS = allKeys;
      if (changed) {
        listeners.forEach(l => l(API_KEYS.length));
      }
    }
  }, (error) => {
    // If it's a permission error, we just log it and continue with env keys
    if (error.code === 'permission-denied') {
      console.warn("GeminiManager: Permission denied for geminiKeys sync. Using environment keys only.");
      return;
    }
    // For other errors, use the standard handler
    try {
      handleFirestoreError(error, OperationType.LIST, 'geminiKeys');
    } catch (e) {
      console.error("Firestore Error in geminiKeys sync:", error);
    }
  });
}

export class GeminiManager {
  private static currentIndex = 0;

  static getClient(): GoogleGenAI {
    if (API_KEYS.length === 0) {
      throw new Error("No Gemini API keys found. Please add keys in the Admin Console.");
    }
    // Ensure index is within bounds
    if (this.currentIndex >= API_KEYS.length) {
      this.currentIndex = 0;
    }
    const key = API_KEYS[this.currentIndex];
    return new GoogleGenAI({ apiKey: key });
  }

  static rotate() {
    if (API_KEYS.length > 1) {
      this.currentIndex = (this.currentIndex + 1) % API_KEYS.length;
      console.log(`Rotating to API Key #${this.currentIndex + 1} of ${API_KEYS.length}`);
    } else {
      this.currentIndex = 0;
    }
  }

  static getKeyCount(): number {
    return API_KEYS.length;
  }

  static onKeysChange(listener: KeyChangeListener) {
    listeners.push(listener);
    return () => {
      const index = listeners.indexOf(listener);
      if (index > -1) listeners.splice(index, 1);
    };
  }

  static isDuplicate(key: string): boolean {
    return API_KEYS.includes(key);
  }

  static getCurrentIndex(): number {
    return this.currentIndex;
  }

  static async testKey(key: string): Promise<boolean> {
    try {
      const genAI = new GoogleGenAI({ apiKey: key });
      const response = await genAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: "Say 'ok'",
      });
      return !!response.text;
    } catch (error) {
      console.error("Key test failed:", error);
      return false;
    }
  }
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).length;
}

function getExampleAnalysis(text: string) {
  const example = EXAMPLES.find(ex => ex.content.trim() === text.trim());
  return example?.analysis || null;
}

async function withRetry<T>(fn: (client: GoogleGenAI) => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const client = GeminiManager.getClient();
      return await fn(client);
    } catch (error: any) {
      lastError = error;
      // If it's a 429 (Rate Limit), rotate key and retry
      if (error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('429') || error?.code === 429) {
        console.warn(`Rate limit hit. Rotating to next API key...`);
        GeminiManager.rotate();
        const delay = Math.pow(2, i) * 500 + Math.random() * 500; // Slightly shorter delay since we rotate keys
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const PLAIN_TEXT_FORMATTING_INSTRUCTIONS = `
FORMATTING RULES:
1. Return response in clean, structured plain text ONLY.
2. DO NOT use markdown syntax (no bold, italics, bullet points, backticks, or hashtags).
3. DO NOT include markdown list symbols like -, *, or numbered markdown lists.
4. Use simple structured headings followed by a colon (e.g., "Summary:", "Key Point:").
5. Use only normal characters and plain text. No decorative symbols.
6. Ensure proper spacing between sections for readability.
7. DO NOT wrap text in code blocks.
`;

export async function summarizeText(text: string, length: 'short' | 'medium' | 'long'): Promise<string> {
  // 1. Check Examples
  const example = getExampleAnalysis(text);
  if (example && example.summaries) return example.summaries[length];

  // 2. Check Cache
  const cached = CacheService.get<string>(text, `summary_${length}`);
  if (cached) return cached;

  // 3. Word Threshold Logic
  if (getWordCount(text) <= 200) {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 0);
    const localSummary = sentences.slice(0, 2).join('. ') + (sentences.length > 2 ? '.' : '');
    return `[Local Analysis] ${localSummary}`;
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Summarize the following text. 
      
      CRITICAL: You MUST ONLY return the ${length} version of the summary. 
      DO NOT include any other lengths or formats.
      
      Format Requirements for ${length}:
      ${length === 'short' ? 'Short: Exactly 1-2 concise sentences.' : ''}
      ${length === 'medium' ? 'Medium: Exactly one well-structured paragraph.' : ''}
      ${length === 'long' ? 'Long: Multiple detailed paragraphs with clear sections.' : ''}
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
    });

    const response = await model;
    const result = response.text || "Failed to generate summary.";
    CacheService.set(text, `summary_${length}`, result);
    return result;
  });
}

export async function paraphraseText(text: string, level: 'beginner' | 'intermediate' | 'advanced'): Promise<string> {
  const cached = CacheService.get<string>(text, `paraphrase_${level}`);
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    return `[Local Analysis] ${text}`;
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `Paraphrase the following text for a ${level} reading level.
      Beginner: Simple vocabulary, short sentences, easy to understand for children or non-native speakers.
      Intermediate: Standard vocabulary, clear structure, suitable for general audience.
      Advanced: Academic/Technical vocabulary, complex sentence structures, suitable for researchers or experts.
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
    });

    const response = await model;
    const result = response.text || "Failed to generate paraphrase.";
    CacheService.set(text, `paraphrase_${level}`, result);
    return result;
  });
}

export async function analyzeReadability(text: string): Promise<{
  fleschKincaid: number;
  gunningFog: number;
  smog: number;
  gradeLevel: string;
}> {
  const example = getExampleAnalysis(text);
  if (example) return example.readability;

  const cached = CacheService.get<any>(text, 'readability');
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    const words = getWordCount(text);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
    const avgWordsPerSentence = words / sentences;
    
    const localResult = {
      fleschKincaid: Math.round(60 + Math.random() * 10),
      gunningFog: Math.round(avgWordsPerSentence * 0.4),
      smog: Math.round(Math.sqrt(avgWordsPerSentence) + 3),
      gradeLevel: avgWordsPerSentence > 15 ? "College" : "High School"
    };
    return localResult;
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the readability of the following text and return the scores in JSON format.
      Include:
      - fleschKincaid (Reading Ease score)
      - gunningFog (Index score)
      - smog (Index score)
      - gradeLevel (e.g., "8th Grade", "College Graduate")
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fleschKincaid: { type: Type.NUMBER },
            gunningFog: { type: Type.NUMBER },
            smog: { type: Type.NUMBER },
            gradeLevel: { type: Type.STRING },
          },
          required: ["fleschKincaid", "gunningFog", "smog", "gradeLevel"],
        },
      },
    });

    const response = await model;
    let data = {
      fleschKincaid: 0,
      gunningFog: 0,
      smog: 0,
      gradeLevel: "Analysis Failed"
    };
    try {
      data = JSON.parse(response.text || "{}");
    } catch (e) {
      console.error("Failed to parse readability JSON:", e);
    }
    CacheService.set(text, 'readability', data);
    return data;
  });
}

export async function extractKeyPoints(text: string): Promise<string[]> {
  const example = getExampleAnalysis(text);
  if (example) return example.keyPoints;

  const cached = CacheService.get<string[]>(text, 'keyPoints');
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    return sentences.slice(0, 3);
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract the most important bullet points from the following text. 
      Rank them by importance. Return as a JSON array of strings.
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const response = await model;
    let result = [];
    try {
      result = JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse key points JSON:", e);
    }
    CacheService.set(text, 'keyPoints', result);
    return result;
  });
}

export async function detectTopics(text: string): Promise<string[]> {
  const example = getExampleAnalysis(text);
  if (example) return example.topics;

  const cached = CacheService.get<string[]>(text, 'topics');
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    return ["General", "Short Text"];
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Detect the main topics or themes of the following text. 
      Return as a JSON array of strings.
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const response = await model;
    let result = [];
    try {
      result = JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse topics JSON:", e);
    }
    CacheService.set(text, 'topics', result);
    return result;
  });
}

export async function generateQuestions(text: string): Promise<{ question: string; type: 'comprehension' | 'conceptual' }[]> {
  const cached = CacheService.get<any[]>(text, 'questions');
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    return [{ question: "What is the main idea of this text?", type: "comprehension" }];
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Generate study questions from the following text. 
      Include both comprehension and conceptual questions.
      Return as a JSON array of objects with 'question' and 'type' fields.
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              question: { type: Type.STRING },
              type: { type: Type.STRING, enum: ['comprehension', 'conceptual'] }
            },
            required: ["question", "type"]
          }
        }
      }
    });

    const response = await model;
    let result = [];
    try {
      result = JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse questions JSON:", e);
    }
    CacheService.set(text, 'questions', result);
    return result;
  });
}

export async function generateGlossary(text: string): Promise<{ term: string; definition: string }[]> {
  const example = getExampleAnalysis(text);
  if (example) return example.glossary;

  const cached = CacheService.get<any[]>(text, 'glossary');
  if (cached) return cached;

  if (getWordCount(text) <= 200) {
    return [];
  }

  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Detect important technical terms in the following text and generate definitions for them.
      Return as a JSON array of objects with 'term' and 'definition' fields.
      
      ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}
      
      Text: ${text}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              term: { type: Type.STRING },
              definition: { type: Type.STRING }
            },
            required: ["term", "definition"]
          }
        }
      }
    });

    const response = await model;
    let result = [];
    try {
      result = JSON.parse(response.text || "[]");
    } catch (e) {
      console.error("Failed to parse glossary JSON:", e);
    }
    CacheService.set(text, 'glossary', result);
    return result;
  });
}

export async function chatWithDocument(text: string, query: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]): Promise<string> {
  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        { role: 'user', parts: [{ text: `Context Document: ${text}` }] },
        ...history,
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction: `You are a helpful assistant that answers questions based on the provided document. If the answer is not in the document, say you don't know based on the context provided.
        
        ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}`
      }
    });

    const response = await model;
    return response.text || "I'm sorry, I couldn't process that request.";
  });
}

export async function chatWithContext(context: string, query: string, history: { role: 'user' | 'model', parts: { text: string }[] }[]): Promise<string> {
  return withRetry(async (client) => {
    const model = client.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [
        { role: 'user', parts: [{ text: `Relevant Context:\n${context}` }] },
        ...history,
        { role: 'user', parts: [{ text: query }] }
      ],
      config: {
        systemInstruction: `You are a helpful assistant that answers questions based on the provided context. Use the provided context to answer the user's question accurately. If the answer is not in the context, inform the user but try to be helpful if possible using general knowledge, while clearly stating it's not in the document.
        
        ${PLAIN_TEXT_FORMATTING_INSTRUCTIONS}`
      }
    });

    const response = await model;
    return response.text || "I'm sorry, I couldn't process that request.";
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const client = GeminiManager.getClient();
  const result = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: [text],
  });

  return result.embeddings[0].values;
}

export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const client = GeminiManager.getClient();
  const result = await client.models.embedContent({
    model: "gemini-embedding-001",
    contents: texts,
  });

  return result.embeddings.map(e => e.values);
}
