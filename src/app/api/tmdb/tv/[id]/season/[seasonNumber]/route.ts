export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { tmdbFetch } from "@/lib/tmdb";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
  "Pragma": "no-cache",
  "Expires": "0",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; seasonNumber: string }> }
) {
  const { id, seasonNumber } = await params;

  try {
    const data = await tmdbFetch(
      `/tv/${id}/season/${seasonNumber}`,
      { append_to_response: "videos" },
      { noCache: true }
    );
    return Response.json(data, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return Response.json(
      { error: "Failed to fetch season details" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
