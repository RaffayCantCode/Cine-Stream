import { neon } from "@neondatabase/serverless";
import { drizzle, NeonHttpDatabase } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Support both DATABASE_URL and POSTGRES_URL
let dbInstance: NeonHttpDatabase<typeof schema> | null = null;
let isBuildTime = false;

export function isDbBuildTime(): boolean {
  return isBuildTime;
}

export function getDb(): NeonHttpDatabase<typeof schema> {
  if (dbInstance) return dbInstance;

  const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

  if (!connectionString) {
    if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NODE_ENV === "production") {
      isBuildTime = true;
      console.warn("[DB] Build phase - DATABASE_URL not set");
      return createBuildProxy();
    }
    throw new Error("Missing DATABASE_URL or POSTGRES_URL environment variable");
  }

  const sql = neon(connectionString);
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

function createBuildProxy(): NeonHttpDatabase<typeof schema> {
  const handler = {
    get: (_target: any, prop: string) => {
      if (prop === "query" || prop === "select" || prop === "insert" || prop === "update" || prop === "delete") {
        return () => { throw new Error("Database not available - DATABASE_URL not configured"); };
      }
      return createBuildProxy();
    },
    apply: () => { throw new Error("Database not available - DATABASE_URL not configured"); }
  };
  return new Proxy({} as NeonHttpDatabase<typeof schema>, handler);
}

export const db = getDb();
