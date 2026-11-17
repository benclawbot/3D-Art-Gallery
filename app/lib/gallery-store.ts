export const maxImageBytes = 8 * 1024 * 1024;
export const privateHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-robots-tag": "noindex, nofollow, noarchive",
};

export type PhotoMetadata = { width: number; height: number; name: string };
export type PublishedGallery = {
  id: string;
  title: string;
  owner: string;
  photos: PhotoMetadata[];
};

export function galleryId(id: string) {
  return /^[a-f0-9]{32}$/.test(id);
}

export function imageIndex(index: string) {
  return /^(?:[0-9]|[1-4][0-9])$/.test(index) ? Number(index) : null;
}

export async function ownerKey(userId: string) {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(userId));
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export const manifestKey = (id: string) => `galleries/${id}/manifest.json`;
export const photoKey = (owner: string, id: string, index: number) => `photos/${owner}/${id}/${index}`;

export const errorResponse = (error: string, status: number) =>
  Response.json({ error }, { status, headers: privateHeaders });

export async function readBoundedBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
