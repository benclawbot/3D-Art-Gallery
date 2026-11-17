import { env } from "cloudflare:workers";
import { errorResponse, galleryId, manifestKey, privateHeaders, type PublishedGallery } from "../../../lib/gallery-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!galleryId(id)) return errorResponse("Gallery unavailable.", 404);
  if (!env.BUCKET) return errorResponse("Gallery storage is currently unavailable.", 503);
  const object = await env.BUCKET.get(manifestKey(id));
  if (!object) return errorResponse("Gallery unavailable.", 404);
  const { title, photos } = await object.json<PublishedGallery>();
  return Response.json({
    id,
    title,
    photos: photos.map((photo, index) => ({ ...photo, url: `/api/gallery/${id}/image/${index}` })),
  }, { headers: privateHeaders });
}
