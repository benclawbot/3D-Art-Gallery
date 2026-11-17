import { env } from "cloudflare:workers";
import type { Metadata } from "next";
import ExhibitionView from "../../exhibition";
import { sampleExhibition } from "../../lib/exhibition";
import { galleryId, manifestKey, type PublishedGallery } from "../../lib/gallery-store";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "A Stillroom gallery",
  robots: { index: false, follow: false, noarchive: true },
  referrer: "no-referrer",
};

export default async function SharedGallery({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id === "demo") return <ExhibitionView gallery={sampleExhibition} />;
  const object = galleryId(id) ? await env.BUCKET?.get(manifestKey(id)) : null;
  if (!object) return <main className="missing-gallery"><h1>Gallery unavailable</h1><p>Check the exhibition link and try again.</p><a href="/">Return to Stillroom</a></main>;

  const { title, photos } = await object.json<PublishedGallery>();
  return <ExhibitionView gallery={{ id, title, photos: photos.map((photo, index) => ({ ...photo, url: `/api/gallery/${id}/image/${index}` })) }} />;
}
