import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type AppDatabase = DrizzleD1Database<typeof schema>;

let isBuildTime = false;

export function isDbBuildTime(): boolean {
  return isBuildTime;
}

export function getDb(): AppDatabase {
  let d1Binding: any = null;

  try {
    const cfContextSymbol = Symbol.for("__cloudflare-request-context__");
    const cfContext = (globalThis as any)[cfContextSymbol];
    if (cfContext?.env?.DB) {
      d1Binding = cfContext.env.DB;
    }
  } catch {}

  if (!d1Binding) {
    d1Binding = (process.env as any)?.DB || (globalThis as any)?.DB;
  }

  if (!d1Binding) {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "production") {
      isBuildTime = true;
      return createBuildProxy();
    }
    return createBuildProxy();
  }

  return drizzle(d1Binding, { schema });
}

function createBuildProxy(): AppDatabase {
  const handler: ProxyHandler<any> = {
    get: (_target: any, prop: string) => {
      if (prop === "query" || prop === "select" || prop === "insert" || prop === "update" || prop === "delete") {
        return () => { throw new Error("Database not available - Cloudflare D1 DB binding not configured"); };
      }
      return createBuildProxy();
    },
    apply: () => { throw new Error("Database not available - Cloudflare D1 DB binding not configured"); }
  };
  return new Proxy({} as any, handler);
}

export const db = new Proxy({} as AppDatabase, {
  get: (_target, prop) => {
    const realDb = getDb();
    return (realDb as any)[prop];
  }
});
