export const runtime = 'edge';
export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/auth/admin";
import { invalidateMediaOverridesCache } from "@/lib/media-overrides";
import { invalidateAnimeDetailsCache, invalidateAnilistServerCache } from "@/lib/anime-fetch";
import {
  invalidateStreamingSourcesCache,
  invalidateHomeSectionsCache,
  invalidateSpotlightCache,
  invalidateThemesCache,
  invalidateCollectionCache,
  invalidateSimilarPeopleCache,
  invalidateCollectionsListCache,
  invalidateAnimeSectionsCache,
} from "@/lib/server-cache";

export async function POST() {
  const auth = await verifyAdminSession();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    invalidateAnimeDetailsCache();
    invalidateAnilistServerCache();
    invalidateAnimeSectionsCache();
    invalidateMediaOverridesCache();
    invalidateStreamingSourcesCache();
    invalidateHomeSectionsCache();
    invalidateSpotlightCache();
    invalidateThemesCache();
    invalidateCollectionCache();
    invalidateSimilarPeopleCache();
    invalidateCollectionsListCache();

    return NextResponse.json(
      {
        success: true,
        message: "All in-memory server and edge caches have been successfully purged.",
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          "CDN-Cache-Control": "no-store",
          "Cloudflare-CDN-Cache-Control": "no-store",
        },
      }
    );
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Failed to purge caches" },
      { status: 500 }
    );
  }
}
