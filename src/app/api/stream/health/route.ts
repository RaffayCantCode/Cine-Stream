import { checkSourceHealth } from "@/lib/streaming-fetch";

export async function GET() {
  try {
    const health = await checkSourceHealth();
    return Response.json({ success: true, data: health });
  } catch {
    return Response.json({ success: false, error: "Health check failed" }, { status: 500 });
  }
}
