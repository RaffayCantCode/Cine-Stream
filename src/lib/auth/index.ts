import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { accounts, sessions, users, verificationTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Check if we're in build phase
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

// Lazy database getter - only initializes when actually used
function getDatabase() {
  if (isBuildPhase) {
    console.warn("[Auth] Build phase - skipping database initialization");
    return null;
  }
  try {
    return getDb();
  } catch (error) {
    console.warn("[Auth] Database not available:", error instanceof Error ? error.message : "Unknown error");
    return null;
  }
}

const db = getDatabase();

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  // Only use DrizzleAdapter if database is available (not during build)
  ...(db && !isBuildPhase && {
    adapter: DrizzleAdapter(db, {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
  }),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const validated = credentialsSchema.safeParse(credentials);
        if (!validated.success) return null;

        const { email, password } = validated.data;
        const emailNormalized = email.trim().toLowerCase();

        // Check if database is available
        const database = getDatabase();
        if (!database) {
          console.error("[Auth] Database not available for credentials login");
          return null;
        }

        const user = await database.query.users.findFirst({
          where: eq(users.email, emailNormalized),
        });

        if (!user || !user.password) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    session: ({ session, token }) => ({
      ...session,
      user: {
        ...session.user,
        id: token.sub,
      },
    }),
    jwt: ({ token, user }) => {
      if (user) token.sub = user.id;
      return token;
    },
  },
});
