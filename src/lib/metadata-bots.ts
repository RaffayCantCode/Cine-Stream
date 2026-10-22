import { headers } from "next/headers";

/**
 * Search engines and social/link-preview crawlers are the only requests where
 * blocking on TMDB for dynamic metadata is worth the latency. Real visitors get
 * static metadata immediately, so opening a title is never gated on the network.
 */
const METADATA_BOT_RE =
  /bot|crawler|spider|slurp|facebookexternalhit|twitterbot|slack|discord|whatsapp|telegram|linkedin|pinterest|embedly|preview/i;

export async function isMetadataBotRequest(): Promise<boolean> {
  try {
    const h = await headers();
    const ua = h.get("user-agent") || "";
    return METADATA_BOT_RE.test(ua);
  } catch {
    return false;
  }
}
