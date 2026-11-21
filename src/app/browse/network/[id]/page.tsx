"use client";
export const runtime = "edge";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { BrowseGridPage } from "@/components/BrowseGridPage";

function NetworkHubContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const networkId = String(params.id || "");
  const networkName = searchParams.get("name") || `Network #${networkId}`;

  return (
    <BrowseGridPage
      title={networkName}
      description={`Original & broadcast TV series from ${networkName}`}
      endpoint={`/api/tmdb/discover/tv?withNetworks=${encodeURIComponent(networkId)}`}
      mediaType="tv"
    />
  );
}

export default function NetworkHubPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <NetworkHubContent />
    </Suspense>
  );
}
