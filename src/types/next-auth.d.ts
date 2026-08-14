import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
    role?: string | null;
  }

  interface Session {
    user: {
      id?: string | null;
      role?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string | null;
  }
}
