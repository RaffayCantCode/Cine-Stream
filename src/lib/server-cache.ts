/**
 * Shared In-Memory Server & Edge Cache Store
 * 
 * Used across API routes and Admin endpoints for sub-millisecond
 * memory hits, automatic LRU eviction, and synchronized cache invalidation.
 */

// 1. Streaming Sources Cache
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

let cachedSources: CacheEntry<any> | null = null;
export function getCachedStreamingSources(): any | null {
  if (cachedSources && cachedSources.expiresAt > Date.now()) {
    return cachedSources.data;
  }
  return null;
}
export function setCachedStreamingSources(data: any, ttlMs: number = 5 * 60 * 1000): void {
  cachedSources = { data, expiresAt: Date.now() + ttlMs };
}
export function invalidateStreamingSourcesCache(): void {
  cachedSources = null;
}

// 2. Custom Home Sections Cache
let cachedSections: CacheEntry<any[]> | null = null;
export function getCachedHomeSections(): any[] | null {
  if (cachedSections && cachedSections.expiresAt > Date.now()) {
    return cachedSections.data;
  }
  return null;
}
export function setCachedHomeSections(data: any[], ttlMs: number = 5 * 60 * 1000): void {
  cachedSections = { data, expiresAt: Date.now() + ttlMs };
}
export function invalidateHomeSectionsCache(): void {
  cachedSections = null;
}

// 3. Site Spotlight Banner Cache
let cachedSpotlight: CacheEntry<any> | null = null;
export function getCachedSpotlight(): any | null {
  if (cachedSpotlight && cachedSpotlight.expiresAt > Date.now()) {
    return cachedSpotlight.data;
  }
  return null;
}
export function setCachedSpotlight(data: any, ttlMs: number = 5 * 60 * 1000): void {
  cachedSpotlight = { data, expiresAt: Date.now() + ttlMs };
}
export function invalidateSpotlightCache(): void {
  cachedSpotlight = null;
}

// 4. Custom Themes Cache
let cachedThemes: CacheEntry<any[]> | null = null;
export function getCachedThemes(): any[] | null {
  if (cachedThemes && cachedThemes.expiresAt > Date.now()) {
    return cachedThemes.data;
  }
  return null;
}
export function setCachedThemes(data: any[], ttlMs: number = 10 * 60 * 1000): void {
  cachedThemes = { data, expiresAt: Date.now() + ttlMs };
}
export function invalidateThemesCache(): void {
  cachedThemes = null;
}

// 5. Franchise Collections Cache (Map bounded to 100 items)
const collectionCache = new Map<string, CacheEntry<any>>();
export function getCachedCollection(id: string): any | null {
  const entry = collectionCache.get(id);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}
export function setCachedCollection(id: string, data: any, ttlMs: number = 24 * 60 * 60 * 1000): void {
  if (collectionCache.size > 100) {
    const oldestKey = collectionCache.keys().next().value;
    if (oldestKey) collectionCache.delete(oldestKey);
  }
  collectionCache.set(id, { data, expiresAt: Date.now() + ttlMs });
}
export function invalidateCollectionCache(): void {
  collectionCache.clear();
}

// 6. Similar People Cache (Map bounded to 200 items)
const similarPeopleCache = new Map<string, CacheEntry<any[]>>();
export function getCachedSimilarPeople(id: string): any[] | null {
  const entry = similarPeopleCache.get(id);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data;
  }
  return null;
}
export function setCachedSimilarPeople(id: string, data: any[], ttlMs: number = 24 * 60 * 60 * 1000): void {
  if (similarPeopleCache.size > 200) {
    const oldestKey = similarPeopleCache.keys().next().value;
    if (oldestKey) similarPeopleCache.delete(oldestKey);
  }
  similarPeopleCache.set(id, { data, expiresAt: Date.now() + ttlMs });
}
export function invalidateSimilarPeopleCache(): void {
  similarPeopleCache.clear();
}

// 7. Collections List Cache
let cachedCollectionsList: CacheEntry<any[]> | null = null;
export function getCachedCollectionsList(): any[] | null {
  if (cachedCollectionsList && cachedCollectionsList.expiresAt > Date.now()) {
    return cachedCollectionsList.data;
  }
  return null;
}
export function setCachedCollectionsList(data: any[], ttlMs: number = 10 * 60 * 1000): void {
  cachedCollectionsList = { data, expiresAt: Date.now() + ttlMs };
}
export function invalidateCollectionsListCache(): void {
  cachedCollectionsList = null;
}
