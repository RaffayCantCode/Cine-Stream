import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// Load env vars from .env.local
dotenv.config({ path: ".env.local" });

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or POSTGRES_URL not set");
}

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
