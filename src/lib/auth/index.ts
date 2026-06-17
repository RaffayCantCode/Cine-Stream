import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
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
      user: { ...session.user, id: token.sub },
    }),
    jwt: ({ token, user }) => {
      if (user) token.sub = user.id;
      return token;
    },
  },
});
