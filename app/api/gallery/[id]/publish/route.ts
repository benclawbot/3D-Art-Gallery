import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../../../chatgpt-auth";
import { errorResponse, galleryId, manifestKey, ownerKey, photoKey, privateHeaders, readBoundedBody, type PhotoMetadata, type PublishedGallery } from "../../../../lib/gallery-store";

export const runtime = "edge";
export const dynamic = "force-dynamic";

function validPhoto(photo: unknown): photo is PhotoMetadata {
  if (!photo || typeof photo !== "object") return false;
  const { width, height, name } = photo as PhotoMetadata;
  return Number.isInteger(width) && width > 0 && width <= 30000
    && Number.isInteger(height) && height > 0 && height <= 30000 && typeof name === "string";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return errorResponse("Open Stillroom directly to publish.", 403);
  const user = await getChatGPTUser();
  if (!user) return errorResponse("Sign in to publish your gallery.", 401);
  const { id } = await params;
  if (!galleryId(id)) return errorResponse("Invalid gallery.", 400);
  const bucket = env.BUCKET;
  if (!bucket) return errorResponse("Image storage is currently unavailable.", 503);
  let data;
  try {
    const bytes = await readBoundedBody(request, 48_000);
    if (!bytes) return errorResponse("Gallery details are too long.", 413);
    data = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return errorResponse("Gallery details were not readable.", 400);
  }
  if (!data || typeof data.title !== "string" || !data.title.trim() || data.title.length > 80
    || !Array.isArray(data.photos) || data.photos.length < 1 || data.photos.length > 50
    || !data.photos.every(validPhoto)) {
    return errorResponse("Add between 1 and 50 valid photographs and try again.", 400);
  }

  const owner = await ownerKey(user.userId);
  const current = await bucket.get(manifestKey(id));
  if (current) {
    const published = await current.json<PublishedGallery>();
    return published.owner === owner
      ? Response.json({ id }, { headers: privateHeaders })
      : errorResponse("This gallery has already been published.", 409);
  }
  const photos: PhotoMetadata[] = data.photos.map(({ width, height, name }: PhotoMetadata) => ({
    width, height, name: name.slice(0, 100),
  }));
  const prefix = photoKey(owner, id, 0).slice(0, -1);
  const { objects } = await bucket.list({ prefix, limit: 51 });
  const uploaded = new Set(objects.map(({ key }) => key));
  const missing = photos.findIndex((_, index) => !uploaded.has(photoKey(owner, id, index)));
  if (missing >= 0) return errorResponse(`Photograph ${missing + 1} is still missing.`, 409);

  const manifest: PublishedGallery = { id, title: data.title.trim(), owner, photos };
  const result = await bucket.put(manifestKey(id), JSON.stringify(manifest), {
    onlyIf: { etagDoesNotMatch: "*" },
    httpMetadata: { contentType: "application/json" },
  });
  if (!result) {
    const written = await bucket.get(manifestKey(id));
    if ((await written?.json<PublishedGallery>())?.owner !== owner) {
      return errorResponse("This gallery has already been published.", 409);
    }
  }
  return Response.json({ id }, { status: result ? 201 : 200, headers: privateHeaders });
}
