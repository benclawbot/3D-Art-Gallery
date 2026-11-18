export type Wall = "west" | "east" | "north" | "south";
export type Bounds = { minX: number; maxX: number; minZ: number; maxZ: number };
export type GalleryRoom = {
  index: number; x: number; z: number; width: number; depth: number;
  bounds: Bounds; spawn: { x: number; z: number; yaw: number };
};
export type GalleryConnection = { from: number; to: number; fromWall: Wall; toWall: Wall; bounds: Bounds };
export type WallArtwork = { index: number; room: number; wall: Wall; x: number; z: number; width: number; height: number; feature: boolean };
export type GalleryLayout = {
  roomCount: number; roomForIndex: number[]; artworks: WallArtwork[];
  rooms: GalleryRoom[]; connections: GalleryConnection[];
};

const WALLS: Wall[] = ["west", "east", "north", "south"];
const pitch = 13.5;
const corridorWidth = 2.76;
const leftOfEntry: Record<Wall, Wall> = { north: "west", west: "south", south: "east", east: "north" };
const entryDirection: Record<Wall, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };

function rngFor(aspects: number[]): () => number {
  let seed = (aspects.length + 0x9e3779b9) >>> 0;
  for (const value of aspects) {
    const n = Number.isFinite(value) ? Math.round(value * 1000) : 1000;
    seed = Math.imul(seed ^ n, 0x85ebca6b) >>> 0;
    seed ^= seed >>> 13;
  }
  return () => {
    seed = (Math.imul(seed ^ (seed >>> 16), 0x45d9f3b) + 0x6d2b79f5) >>> 0;
    return seed / 0x100000000;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function growCells(count: number, random: () => number): { cells: Array<{ x: number; z: number }>; parents: number[] } {
  const cells = [{ x: 0, z: 0 }];
  const parents = [-1];
  if (count === 1) return { cells, parents };
  // The entry's north display wall and west courtyard frame the first view.
  // A second wing turns off the east room, which also anchors the first branch.
  cells.push({ x: 1, z: 0 });
  parents.push(0);
  if (count >= 3) {
    cells.push({ x: 1, z: random() > 0.5 ? 1 : -1 });
    parents.push(1);
  }
  if (count >= 4) {
    cells.push({ x: 2, z: 0 });
    parents.push(1);
  }
  while (cells.length < count) {
    const occupied = new Set(cells.map(({ x, z }) => `${x},${z}`));
    const candidates: Array<{ parent: number; cell: { x: number; z: number }; weight: number }> = [];
    cells.forEach((cell, parent) => {
      const degree = Number(parent > 0) + parents.filter((candidate) => candidate === parent).length;
      if (degree >= 3) return;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (parent === 0 && (dx === -1 || dz === -1)) continue;
        const next = { x: cell.x + dx, z: cell.z + dz };
        if (next.x < 0 || occupied.has(`${next.x},${next.z}`)) continue;
        // Favor compact growth while allowing branches and irregular outlines.
        candidates.push({ parent, cell: next, weight: 1 + Math.max(0, 5 - Math.abs(next.x) - Math.abs(next.z)) * 0.18 });
      }
    });
    if (!candidates.length) throw new Error("Unable to grow a connected gallery plan");
    const weighted = candidates.reduce((sum, item) => sum + item.weight, 0) * random();
    let pick = candidates[candidates.length - 1];
    let sum = 0;
    for (const candidate of candidates) { sum += candidate.weight; if (weighted <= sum) { pick = candidate; break; } }
    cells.push(pick.cell);
    parents.push(pick.parent);
  }
  return { cells, parents };
}

function wallToward(a: { x: number; z: number }, b: { x: number; z: number }): Wall {
  if (b.x > a.x) return "east";
  if (b.x < a.x) return "west";
  if (b.z > a.z) return "south";
  return "north";
}

export function createGalleryLayout(aspects: number[], minimumRooms = 1): GalleryLayout {
  const count = Math.max(0, Math.min(50, aspects.length));
  const roomCount = count === 0 ? 1 : Math.min(7, count, Math.max(Math.ceil(count / 8), Math.floor(minimumRooms) || 1));
  const random = rngFor(aspects.slice(0, count));
  const { cells, parents } = growCells(roomCount, random);
  const rooms: GalleryRoom[] = cells.map((cell, index) => {
    const width = 7.3 + random() * 2.8;
    const depth = 7.4 + random() * 4.1;
    const x = cell.x * pitch + (random() - 0.5) * 1.1;
    const z = cell.z * pitch + (random() - 0.5) * 1.1;
    return { index, x, z, width, depth, bounds: { minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 }, spawn: { x, z, yaw: 0 } };
  });

  const connections: GalleryConnection[] = [];
  // The room order is the growth order, so each new cell attaches to one prior cell.
  for (let to = 1; to < roomCount; to++) {
    const cell = cells[to];
    const parent = parents[to];
    const a = rooms[parent], b = rooms[to];
    const fromWall = wallToward(cells[parent], cell), toWall = wallToward(cell, cells[parent]);
    let bounds: Bounds;
    if (fromWall === "east" || fromWall === "west") {
      const minX = fromWall === "east" ? a.bounds.maxX : b.bounds.maxX;
      const maxX = fromWall === "east" ? b.bounds.minX : a.bounds.minX;
      const low = Math.max(a.bounds.minZ, b.bounds.minZ) + corridorWidth / 2 + 0.8;
      const high = Math.min(a.bounds.maxZ, b.bounds.maxZ) - corridorWidth / 2 - 0.8;
      const fraction = random();
      const center = low <= high ? low + (parent === 0 ? 0.46 + fraction * 0.20 : fraction) * (high - low)
        : (Math.max(a.bounds.minZ, b.bounds.minZ) + Math.min(a.bounds.maxZ, b.bounds.maxZ)) / 2;
      bounds = { minX, maxX, minZ: center - corridorWidth / 2, maxZ: center + corridorWidth / 2 };
    } else {
      const minZ = fromWall === "south" ? a.bounds.maxZ : b.bounds.maxZ;
      const maxZ = fromWall === "south" ? b.bounds.minZ : a.bounds.minZ;
      const low = Math.max(a.bounds.minX, b.bounds.minX) + corridorWidth / 2 + 0.8;
      const high = Math.min(a.bounds.maxX, b.bounds.maxX) - corridorWidth / 2 - 0.8;
      const center = low <= high ? low + random() * (high - low) : (Math.max(a.bounds.minX, b.bounds.minX) + Math.min(a.bounds.maxX, b.bounds.maxX)) / 2;
      bounds = { minX: center - corridorWidth / 2, maxX: center + corridorWidth / 2, minZ, maxZ };
    }
    connections.push({ from: parent, to, fromWall, toWall, bounds });
  }

  const roomForIndex: number[] = [];
  const artworks: WallArtwork[] = [];
  const base = count ? Math.floor(count / roomCount) : 0;
  const extra = count % roomCount;
  let index = 0;
  for (let roomIndex = 0; roomIndex < roomCount; roomIndex++) {
    const room = rooms[roomIndex];
    const inRoom = base + (roomIndex < extra ? 1 : 0);
    const doors = new Map<Wall, Bounds>();
    for (const edge of connections) {
      if (edge.from === roomIndex) doors.set(edge.fromWall, edge.bounds);
      if (edge.to === roomIndex) doors.set(edge.toWall, edge.bounds);
    }
    const print = roomIndex > 0 && roomIndex === roomCount - 1;
    const entry = connections.find((edge) => edge.to === roomIndex)?.toWall;
    const printFocal = entry && leftOfEntry[entry];
    const focalWall = roomIndex === 0 ? "north"
      : print && printFocal && !doors.has(printFocal) ? printFocal
      : shuffle(WALLS.filter((wall) => !doors.has(wall)), random)[0];
    const alongZ = (wall: Wall) => wall === "west" || wall === "east";
    function hang(photo: number, wall: Wall, along: number, maxWidth: number, feature: boolean) {
      const rawAspect = aspects[photo];
      const aspect = Number.isFinite(rawAspect) && rawAspect > 0 ? rawAspect : 1;
      const height = Math.min(feature ? 2.36 : 1.74, maxWidth / aspect);
      const width = height * aspect;
      const x = wall === "west" ? room.bounds.minX : wall === "east" ? room.bounds.maxX : along;
      const z = wall === "north" ? room.bounds.minZ : wall === "south" ? room.bounds.maxZ : along;
      artworks.push({ index: photo, room: roomIndex, wall, x, z, width, height, feature });
    }
    const startIndex = index;
    index += inRoom;
    for (let photo = 0; photo < inRoom; photo++) roomForIndex.push(roomIndex);

    if (inRoom > 0) {
      const focalAlong = alongZ(focalWall) ? room.z : room.x;
      hang(startIndex, focalWall, focalAlong, 3.10, true);
    }

    // Hang secondary works in clear wall bays, including the two sides of a door.
    const bays: { wall: Wall; start: number; end: number; photos: number[] }[] = [];
    const addBay = (wall: Wall, start: number, end: number) => {
      if (end - start >= 0.66) bays.push({ wall, start, end, photos: [] });
    };
    for (const wall of WALLS) {
      if (wall === focalWall || (roomIndex === 0 && wall === "west")) continue;
      const zAxis = alongZ(wall);
      const start = (zAxis ? room.bounds.minZ : room.bounds.minX) + 0.64;
      const end = (zAxis ? room.bounds.maxZ : room.bounds.maxX) - 0.64;
      const door = doors.get(wall);
      if (!door) {
        addBay(wall, start, end);
      } else {
        addBay(wall, start, Math.min(end, (zAxis ? door.minZ : door.minX) - 0.36));
        addBay(wall, Math.max(start, (zAxis ? door.maxZ : door.maxX) + 0.36), end);
      }
    }

    for (let photo = 1; photo < inRoom; photo++) {
      function score(bay: typeof bays[number]) {
        const sideWall = alongZ(bay.wall) !== alongZ(focalWall);
        return (bay.end - bay.start) / (bay.photos.length + 1) * (sideWall ? 1.16 : 1);
      }
      let composedBay;
      if (photo === 1 && roomIndex === 0) {
        composedBay = bays.find((bay) => bay.wall === "east" && bay.end - bay.start > 1.55);
      } else if (photo === 1 && print && entry) {
        const entryBays = bays.filter((bay) => bay.wall === entry && bay.end - bay.start > 1.55);
        composedBay = focalWall === "east" || focalWall === "south" ? entryBays.at(-1) : entryBays[0];
      }
      const bay = composedBay ?? bays.reduce((best, candidate) => score(candidate) > score(best) ? candidate : best);
      bay.photos.push(startIndex + photo);
    }
    for (const { wall, start, end, photos } of bays) {
      const span = (end - start) / Math.max(1, photos.length);
      for (const [slot, photo] of photos.entries()) {
        hang(photo, wall, start + (slot + 0.5) * span, Math.min(2.60, Math.max(0.12, span - 0.42)), false);
      }
    }
    // Spawn faces the uninterrupted focal wall, one metre inside the opposite wall.
    const focal = focalWall;
    if (focal === "north") { room.spawn.x = room.x; room.spawn.z = room.bounds.maxZ - 0.82; room.spawn.yaw = roomIndex === 0 ? 0.09 : 0; }
    else if (focal === "south") { room.spawn.x = room.x; room.spawn.z = room.bounds.minZ + 1; room.spawn.yaw = Math.PI; }
    else if (focal === "west") { room.spawn.x = room.bounds.maxX - 1; room.spawn.z = room.z; room.spawn.yaw = Math.PI / 2; }
    else { room.spawn.x = room.bounds.minX + 1; room.spawn.z = room.z; room.spawn.yaw = -Math.PI / 2; }
    if (print && entry) {
      const entryOffset = entryDirection[entry];
      room.spawn.x += entryOffset[0] * 0.83;
      room.spawn.z += entryOffset[1] * 0.83;
      room.spawn.yaw -= 0.41;
    }
  }
  artworks.sort((a, b) => a.index - b.index);
  return { roomCount, roomForIndex, artworks, rooms, connections };
}
