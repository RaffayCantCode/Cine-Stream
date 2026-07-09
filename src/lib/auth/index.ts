import { NextRequest } from "next/server";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcrypt-ts";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function getDatabase() {
  try {
    return getDb();
  } catch {
    return null;
  }
}

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

let _auth: ReturnType<typeof NextAuth> | null = null;

function getAuth() {
  if (!_auth) {
    _auth = NextAuth({
      secret: authSecret,
      trustHost: true,
      session: { strategy: "jwt" },
      pages: { signIn: "/login" },
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

            const database = getDatabase();
            if (!database) return null;

            const user = await database.query.users.findFirst({
              where: eq(users.email, emailNormalized),
            });

            if (!user || !user.password) return null;

            const isValid = await compare(password, user.password);
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
          user: { ...session.user, id: token.sub },
        }),
        jwt: ({ token, user }) => {
          if (user) token.sub = user.id;
          return token;
        },
      },
    });
  }
  return _auth;
}

export function auth() {
  return getAuth().auth();
}

export function signIn() {
  return getAuth().signIn();
}

export function signOut() {
  return getAuth().signOut();
}

export const GET = (req: NextRequest) => getAuth().handlers.GET(req);
export const POST = (req: NextRequest) => getAuth().handlers.POST(req);
