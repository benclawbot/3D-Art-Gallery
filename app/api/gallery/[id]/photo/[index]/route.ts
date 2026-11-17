import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../../chatgpt-auth";
import { errorResponse, galleryId, imageIndex, manifestKey, maxImageBytes, ownerKey, photoKey, readBoundedBody } from "../../../../../lib/gallery-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function imageFormat(bytes: Uint8Array) {
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF"
    && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  return null;
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return errorResponse("Open Stillroom directly to publish.", 403);
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Sign in to publish your gallery.", 401);
  const { id, index: raw } = await params;
  const index = imageIndex(raw);
  if (!galleryId(id) || index === null) return errorResponse("Invalid photograph.", 400);
  const bucket = env.BUCKET;
  if (!bucket) return errorResponse("Image storage is currently unavailable.", 503);
  if (await bucket.head(manifestKey(id))) return errorResponse("This gallery has already been published.", 409);
  const bytes = await readBoundedBody(request, maxImageBytes);
  if (!bytes) return errorResponse("Each prepared image must be under 8 MB.", 413);
  const mime = imageFormat(bytes);
  if (bytes.length < 64 || !mime || request.headers.get("content-type") !== mime) {
    return errorResponse("Use a valid JPEG or WebP image.", 415);
  }
  const owner = await ownerKey(user.userId);
  await bucket.put(photoKey(owner, id, index), bytes, {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: mime },
  });
  return Response.json({ ok: true });
}
