"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";
import { ContentModeProvider } from "@/context/ContentModeContext";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider refetchOnWindowFocus={false}>
      <ContentModeProvider>
        {children}
      </ContentModeProvider>
    </SessionProvider>
  );
}
