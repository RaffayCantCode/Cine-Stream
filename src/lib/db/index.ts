import postgres from "postgres";
import { drizzle, PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Support both DATABASE_URL and POSTGRES_URL
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;
let isBuildTime = false;

export function isDbBuildTime(): boolean {
  return isBuildTime;
}

export function getDb(): PostgresJsDatabase<typeof schema> {
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

  const sql = postgres(connectionString, { prepare: false });
  dbInstance = drizzle(sql, { schema });
  return dbInstance;
}

function createBuildProxy(): PostgresJsDatabase<typeof schema> {
  const handler = {
    get: (_target: any, prop: string) => {
      if (prop === "query" || prop === "select" || prop === "insert" || prop === "update" || prop === "delete") {
        return () => { throw new Error("Database not available - DATABASE_URL not configured"); };
      }
      return createBuildProxy();
    },
    apply: () => { throw new Error("Database not available - DATABASE_URL not configured"); }
  };
  return new Proxy({} as PostgresJsDatabase<typeof schema>, handler);
}

export const db = getDb();
