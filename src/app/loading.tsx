"use client";

import { LoadingScreen } from "@/components/LoadingScreen";

/**
 * Route-level loading fallback for slow route fetches.
 * Every navigation also runs the client-side `NavigationLoader`, so the
 * branded theme-aware animation plays consistently on all page switches.
 */
export default function Loading() {
  return <LoadingScreen />;
}
