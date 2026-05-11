import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export async function fetchJson<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: unknown = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : res.statusText || `Request failed: ${res.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function formatRuntime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
  
// Adult content genre IDs to filter out (these are commonly adult-oriented genres)
const ADULT_GENRE_IDS = [
  1,   // Often used for adult/pornographic
  10770, // TV Movie (sometimes contains adult content)
];

// Keywords that suggest adult content
const ADULT_KEYWORDS = [
  'porn', 'adult', 'erotic', 'sex', 'nude', 'nudity', 'explicit',
  'hardcore', 'softcore', 'xxx', 'mature', 'nsfw'
];

export function filterReleasedSafeContent<T extends { 
  adult?: boolean; 
  release_date?: string; 
  first_air_date?: string;
  genre_ids?: number[];
  title?: string;
  name?: string;
  overview?: string;
}>(items: T[]): T[] {  
  const today = new Date();  
  today.setHours(0, 0, 0, 0);  
  return items.filter((item) => {  
    // Filter explicit adult flag
    if (item.adult === true) return false;
    
    // Filter by adult genre IDs
    if (item.genre_ids && item.genre_ids.some(id => ADULT_GENRE_IDS.includes(id))) {
      return false;
    }
    
    // Filter by keywords in title/name/overview
    const textToCheck = `${item.title || ''} ${item.name || ''} ${item.overview || ''}`.toLowerCase();
    if (ADULT_KEYWORDS.some(keyword => textToCheck.includes(keyword))) {
      return false;
    }
    
    // Filter unreleased content
    const releaseStr = item.release_date || item.first_air_date;  
    if (releaseStr) {  
      const releaseDate = new Date(releaseStr);  
      if (!isNaN(releaseDate.getTime()) && releaseDate > today) {  
        return false;  
      }  
    }  
    return true;  
  });  
} 
