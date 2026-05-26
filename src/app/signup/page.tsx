"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Sidebar } from "@/components/Sidebar";
import { Input } from "@/components/ui/Input";
import { Github, Chrome, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to create account");
        setIsLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Account created but failed to sign in");
        setIsLoading(false);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Something went wrong");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar />

      <main className="md:pl-56 lg:pl-64">
      <div className="pt-12 px-6 md:px-12 max-w-screen-xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-md mx-auto"
        >
          <h1 className="text-3xl font-bold text-white mb-2 text-center">Create account</h1>
          <p className="text-white/50 text-center mb-8">Start your streaming journey today</p>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Name</label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 bg-white/[0.05] border-white/[0.1] text-white placeholder:text-white/30"
                placeholder="••••••••"
                minLength={6}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Account"}
            </button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-background text-white/40">Or sign up with</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => signIn("google", { callbackUrl: "/" })}
              className="flex items-center justify-center gap-2 h-12 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-lg text-white font-medium transition-colors"
            >
              <Chrome className="w-5 h-5" />
              Google
            </button>
            <button
              onClick={() => signIn("github", { callbackUrl: "/" })}
              className="flex items-center justify-center gap-2 h-12 bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.1] rounded-lg text-white font-medium transition-colors"
            >
              <Github className="w-5 h-5" />
              GitHub
            </button>
          </div>

          <p className="text-center mt-8 text-white/40 text-sm">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:text-primary/80 font-medium">
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
      </main>
    </div>
  );
}
