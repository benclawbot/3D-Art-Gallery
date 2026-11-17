import { env } from "cloudflare:workers";
import { errorResponse, galleryId, imageIndex, manifestKey, photoKey, privateHeaders, type PublishedGallery } from "../../../../../lib/gallery-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const { id, index: raw } = await params;
  const index = imageIndex(raw);
  const bucket = env.BUCKET;
  if (!galleryId(id) || index === null || !bucket) return errorResponse("Photograph unavailable.", 404);
  const object = await bucket.get(manifestKey(id));
  if (!object) return errorResponse("Photograph unavailable.", 404);
  const { owner, photos } = await object.json<PublishedGallery>();
  const image = index < photos.length ? await bucket.get(photoKey(owner, id, index)) : null;
  if (!image) return errorResponse("Photograph unavailable.", 404);
  return new Response(image.body, {
    headers: {
      ...privateHeaders,
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": image.httpMetadata?.contentType || "image/webp",
      "x-content-type-options": "nosniff",
    },
  });
}
