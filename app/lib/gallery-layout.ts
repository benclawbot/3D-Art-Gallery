export type WallArtwork = { index: number; room: number; side: "left" | "right" | "end"; z: number; width: number; height: number };
export type GalleryLayout = { roomCount: number; roomForIndex: number[]; artworks: WallArtwork[] };

/** Stable room assignment and wall spacing for galleries of 1–50 photographs. */
export function createGalleryLayout(aspects: number[]): GalleryLayout {
  const count = Math.max(0, Math.min(50, aspects.length));
  const roomCount = Math.max(1, Math.ceil(count / 8));
  const roomForIndex: number[] = [];
  const artworks: WallArtwork[] = [];
  const base = Math.floor(count / roomCount);
  const extra = count % roomCount;
  const ratio = (index: number) => Number.isFinite(aspects[index]) && aspects[index] > 0 ? aspects[index] : 1;
  let index = 0;
  for (let room = 0; room < roomCount; room++) {
    const inRoom = base + (room < extra ? 1 : 0);
    const last = room === roomCount - 1 && inRoom > 0;
    const onSides = inRoom - Number(last);
    const left = Math.ceil(onSides / 2);
    const right = onSides - left;
    for (const [side, sideCount] of [["left", left], ["right", right]] as const) {
      const spacing = 7.6 / Math.max(1, sideCount);
      for (let slot = 0; slot < sideCount; slot++) {
        const aspect = ratio(index);
        const height = Math.min(1.65, (spacing - 0.52) / aspect, 2.65 / aspect);
        const width = height * aspect;
        const z = room * 10 + 1.2 + (slot + 0.5) * spacing;
        artworks.push({ index, room, side, z, width, height });
        roomForIndex.push(room);
        index++;
      }
    }
    if (last) {
      const aspect = ratio(index);
      const height = Math.min(1.85, 3.2 / aspect);
      artworks.push({ index, room, side: "end", z: (room + 1) * 10, width: aspect * height, height });
      roomForIndex.push(room);
      index++;
    }
  }
  return { roomCount, roomForIndex, artworks };
}
