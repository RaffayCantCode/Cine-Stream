export const dynamic = 'force-dynamic';
export const runtime = 'edge';
import { checkSourceHealth } from "@/lib/streaming-fetch";

export async function GET() {
  try {
    const health = await checkSourceHealth();
    return Response.json(
      { success: true, data: health },
      {
        headers: {
          "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=86400",
          "CDN-Cache-Control": "public, max-age=600",
          "Surrogate-Control": "public, max-age=600",
        },
      }
    );
  } catch {
    return Response.json(
      { success: false, error: "Health check failed" },
      { status: 500 }
    );
  }
}