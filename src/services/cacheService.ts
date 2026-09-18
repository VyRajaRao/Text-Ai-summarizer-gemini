
export class CacheService {
  private static CACHE_PREFIX = 'ai_text_cache_';

  private static hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  static get<T>(text: string, type: string): T | null {
    const key = `${this.CACHE_PREFIX}${type}_${this.hashText(text)}`;
    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached) as T;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  static set<T>(text: string, type: string, data: T): void {
    const key = `${this.CACHE_PREFIX}${type}_${this.hashText(text)}`;
    localStorage.setItem(key, JSON.stringify(data));
  }

  static clear(): void {
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(this.CACHE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  }
}
