import * as THREE from "three";
import { archLiningGeometry, partitionGeometry, seatGeometry, VAULT_HEIGHT, vaultGeometry, vaultHeight } from "./gallery-architecture";
import { createGalleryLayout, type Bounds, type GalleryConnection, type GalleryRoom, type Wall } from "./gallery-layout";
import { addSkylightShader, addTravertineShader, finishTexture, travertineGeometry } from "./scene-finishes";

export type WorldArtwork = { index: number; url: string; width: number; height: number; name: string };

const WALLS: Wall[] = ["west", "east", "north", "south"];
const WALL_THICKNESS = 0.24;
const DOOR_SPRING = 2.03;
const PLAYER_RADIUS = 0.25;
const seatX = 0.65;
const seatZ = 0.45;
const inward = {
  west: { dx: 1, dz: 0, yaw: Math.PI / 2 },
  east: { dx: -1, dz: 0, yaw: -Math.PI / 2 },
  north: { dx: 0, dz: 1, yaw: 0 },
  south: { dx: 0, dz: -1, yaw: Math.PI },
};

function inside(bounds: Bounds, x: number, z: number, insetX = 0, insetZ = insetX) {
  return x >= bounds.minX + insetX && x <= bounds.maxX - insetX
    && z >= bounds.minZ + insetZ && z <= bounds.maxZ - insetZ;
}

function wallFace(room: GalleryRoom, wall: Wall) {
  const { bounds } = room;
  const { dx, dz } = inward[wall];
  return {
    x: wall === "west" ? bounds.minX : wall === "east" ? bounds.maxX : room.x,
    z: wall === "north" ? bounds.minZ : wall === "south" ? bounds.maxZ : room.z,
    span: (dx ? room.depth : room.width) + WALL_THICKNESS * 2,
    rotation: dx ? Math.PI / 2 : 0,
    dx, dz,
  };
}

export function createScene(artworks: WorldArtwork[], renderer: THREE.WebGLRenderer, refresh: () => void, minimumRooms: number) {
  const layout = createGalleryLayout(artworks.map(({ width, height }) => width / Math.max(1, height)), minimumRooms);
  const { rooms, connections } = layout;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#cabdae");
  scene.fog = new THREE.Fog("#cabdae", 31, 68);
  scene.add(new THREE.HemisphereLight("#fffaf3", "#b8a692", 1.65));
  const daylight = new THREE.DirectionalLight("#fff6ec", 1.21);
  daylight.position.set(-4, 8, -5);
  const bounce = new THREE.DirectionalLight("#ffecd4", 0.62);
  bounce.position.set(1, -8, 3);
  scene.add(daylight, bounce);

  const plasterTexture = finishTexture("plaster", renderer);
  const stoneTexture = finishTexture("stone", renderer);
  const woodTexture = finishTexture("oak", renderer);
  const plaster = new THREE.MeshStandardMaterial({ color: "#d9cbb9", map: plasterTexture, roughness: 0.96 });
  const lime = new THREE.MeshStandardMaterial({ color: "#e8dac8", map: plasterTexture, roughness: 0.95 });
  const sandstone = new THREE.MeshStandardMaterial({ color: "#c8ad90", map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.04, roughness: 0.9 });
  const floor = new THREE.MeshStandardMaterial({ color: "#c6b6a0", map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.05, roughness: 0.68 });
  const seatFloor = floor.clone();
  const turnedSeatFloor = floor.clone();
  addTravertineShader(floor);
  addTravertineShader(seatFloor, [seatX, seatZ]);
  addTravertineShader(turnedSeatFloor, [seatX, seatZ], true);
  const ceiling = new THREE.MeshStandardMaterial({ color: "#c79c70", map: woodTexture, bumpMap: woodTexture, bumpScale: 0.027, roughness: 0.89 });
  const trim = new THREE.MeshStandardMaterial({ color: "#635342", roughness: 0.82 });
  const frame = new THREE.MeshStandardMaterial({ color: "#463326", roughness: 0.72 });
  const mat = new THREE.MeshStandardMaterial({ color: "#f7f0e1", roughness: 0.9 });
  const oak = new THREE.MeshStandardMaterial({ color: "#a77550", map: woodTexture, roughness: 0.75 });
  const fixture = new THREE.MeshStandardMaterial({ color: "#5b5246", roughness: 0.65 });
  const diffuserRadius = 1.22;
  const diffuserHalfLength = 2.0;
  const luminous = new THREE.MeshBasicMaterial({ color: "#fff5e2", toneMapped: false });
  addSkylightShader(luminous, diffuserRadius, diffuserHalfLength);
  const passageLight = new THREE.MeshBasicMaterial({ color: "#fff5e2", toneMapped: false });
  const shadow = createShadow();
  const group = new THREE.Group();
  scene.add(group);
  const occluders: THREE.Mesh[] = [];
  const doors = rooms.map(() => new Map<Wall, GalleryConnection>());
  const neighbors = rooms.map(() => [] as number[]);
  for (const edge of connections) {
    doors[edge.from].set(edge.fromWall, edge);
    doors[edge.to].set(edge.toWall, edge);
    neighbors[edge.from].push(edge.to);
    neighbors[edge.to].push(edge.from);
  }

  function add(geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  function box(w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const vertex = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const across = Math.abs(normal.getX(i)) > 0.5 ? vertex.getZ(i) + z : vertex.getX(i) + x;
      const up = Math.abs(normal.getY(i)) > 0.5 ? vertex.getZ(i) + z : vertex.getY(i) + y;
      uv.setXY(i, across / 3.2, up / 3.2);
    }
    return add(geometry, material, x, y, z);
  }

  const featureInRoom = rooms.map(({ index }) => layout.artworks.find((art) => art.room === index && art.feature));
  const turnedSeats = featureInRoom.map((feature) => feature?.wall === "east" || feature?.wall === "west");
  for (const room of rooms) {
    const { index, x, z, width, depth } = room;
    const feature = featureInRoom[index];
    const nicheWall = rooms.length === 1 || index === 0 || index === rooms.length - 1 ? feature?.wall : undefined;
    const hasSeat = index % 2 === 0;
    const turnedSeat = turnedSeats[index];
    const paving = hasSeat ? turnedSeat ? turnedSeatFloor : seatFloor : floor;
    add(travertineGeometry(width, depth), paving, x, 0, z);
    add(vaultGeometry(width, 0, depth / 2 + 0.02, 0, false, width), ceiling, x, 0, z);

    for (const wall of WALLS) {
      const side = wallFace(room, wall);
      const wallX = side.x - side.dx * WALL_THICKNESS / 2;
      const wallZ = side.z - side.dz * WALL_THICKNESS / 2;
      const edge = doors[index].get(wall);
      const color = wall === "north" || wall === "west" ? lime : plaster;
      if (edge) {
        const corridor = edge.bounds;
        const center = side.dx ? room.z - (corridor.minZ + corridor.maxZ) / 2 : (corridor.minX + corridor.maxX) / 2 - room.x;
        const radius = side.dx ? (corridor.maxZ - corridor.minZ) / 2 : (corridor.maxX - corridor.minX) / 2;
        const structure = add(partitionGeometry(radius, DOOR_SPRING, WALL_THICKNESS, side.span, center), color, wallX, 0, wallZ);
        structure.rotation.y = side.rotation;
        occluders.push(structure);
        const border = add(archLiningGeometry(radius, DOOR_SPRING, 0.30), sandstone,
          wallX + (side.dx ? 0 : center), 0, wallZ - (side.dx ? center : 0));
        border.rotation.y = side.rotation;
      } else {
        const structure = box(side.dx ? WALL_THICKNESS : side.span, VAULT_HEIGHT, side.dx ? side.span : WALL_THICKNESS,
          wallX, VAULT_HEIGHT / 2, wallZ, color);
        occluders.push(structure);
        if (wall === nicheWall && feature) {
          const center = side.dx ? room.z - feature.z : feature.x - room.x;
          const radius = Math.max(1.48, feature.width / 2 + 0.37);
          const spring = 1.96;
          const nicheX = side.x + side.dx * 0.21;
          const nicheZ = side.z + side.dz * 0.21;
          const surround = add(partitionGeometry(radius, spring, 0.13, side.span, center), plaster, nicheX, 0, nicheZ);
          surround.rotation.y = side.rotation;
          occluders.push(surround);
          const casing = add(archLiningGeometry(radius, spring, 0.17), sandstone,
            nicheX + (side.dx ? 0 : center), 0, nicheZ - (side.dx ? center : 0));
          casing.rotation.y = side.rotation;
        } else {
          box(side.dx ? 0.023 : side.span - WALL_THICKNESS, 0.038,
            side.dx ? side.span - WALL_THICKNESS : 0.023, side.x + side.dx * 0.011, 0.021, side.z + side.dz * 0.011, trim);
        }
      }
    }

    const skylight = diffuserRadius * 2;
    add(vaultGeometry(skylight + 0.23, 0, diffuserHalfLength, 0.015, true, width), sandstone, x, 0, z);
    add(vaultGeometry(skylight + 0.12, 0, diffuserHalfLength, 0.028, true, width), fixture, x, 0, z);
    add(vaultGeometry(skylight, 0, diffuserHalfLength, 0.044, true, width), luminous, x, 0, z);
    for (const side of [-1, 1]) {
      const track = side * (width / 2 - 1.08);
      const height = vaultHeight(track, width);
      box(0.035, 0.027, depth * 0.68, x + track, height - 0.024, z, fixture);
      for (const offset of [-0.25, 0, 0.25]) {
        const lamp = add(new THREE.CylinderGeometry(0.055, 0.074, 0.18, 16), fixture, x + track, height - 0.134, z + depth * offset);
        lamp.rotation.z = side * 0.48;
      }
    }
    if (hasSeat) {
      add(seatGeometry(), oak, x + seatX, 0.40, z + seatZ).rotation.y = turnedSeat ? Math.PI / 2 : 0;
      for (const side of [-1, 1]) {
        const offset = side * 0.67;
        add(new THREE.CylinderGeometry(0.14, 0.19, 0.40, 28), sandstone,
          x + seatX + (turnedSeat ? 0 : offset), 0.20, z + seatZ + (turnedSeat ? offset : 0));
      }
    }
  }

  for (const { bounds, fromWall } of connections) {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const x = (bounds.minX + bounds.maxX) / 2;
    const z = (bounds.minZ + bounds.maxZ) / 2;
    const runsX = fromWall === "east" || fromWall === "west";
    add(travertineGeometry(width, depth), floor, x, 0, z);
    const passageHeight = 3.22;
    box(width + 0.15, 0.10, depth + 0.15, x, passageHeight + 0.05, z, lime);
    for (const side of [-1, 1]) {
      const wallX = x + (runsX ? 0 : side * (width / 2 + WALL_THICKNESS / 2));
      const wallZ = z + (runsX ? side * (depth / 2 + WALL_THICKNESS / 2) : 0);
      const wall = box(runsX ? width : WALL_THICKNESS, passageHeight, runsX ? WALL_THICKNESS : depth,
        wallX, passageHeight / 2, wallZ, plaster);
      occluders.push(wall);
    }
    box(runsX ? 0.94 : 0.13, 0.018, runsX ? 0.13 : 0.94, x, passageHeight - 0.015, z, passageLight);
  }

  // Reuse two sets of lights for the current room and a nearby doorway.
  const lightBanks = Array.from({ length: 2 }, () => (
    [48, 48, 31].map((power) => {
      const light = new THREE.SpotLight("#fff1d9", power, 9, 0.74, 0.86, 1.5);
      scene.add(light, light.target);
      return { light, power };
    })
  ));
  function lightRoom(index: number) {
    const visible = [index, neighbors[index][0]];
    lightBanks.forEach((bank, i) => {
      const room = rooms[visible[i]];
      bank.forEach(({ light, power }, lightIndex) => {
        light.intensity = room ? power : 0;
        if (!room) return;
        const art = featureInRoom[room.index];
        if (lightIndex === 2 && art) {
          const { dx, dz } = inward[art.wall];
          light.position.set(art.x + dx * 1.94, 4.02, art.z + dz * 1.94);
          light.target.position.set(art.x, 1.7, art.z);
        } else {
          const side = lightIndex === 0 ? -1 : 1;
          const track = side * (room.width / 2 - 1.08);
          light.position.set(room.x + track, vaultHeight(track, room.width) - 0.18, room.z);
          light.target.position.set(room.x + side * room.width / 2, 1.35, room.z);
        }
      });
    });
  }

  const clickable: THREE.Mesh[] = [];
  const pending: { material: THREE.MeshBasicMaterial; art: WorldArtwork; room: number }[] = [];
  for (const art of layout.artworks) {
    const item = artworks[art.index];
    const { dx, dz, yaw } = inward[art.wall];
    const y = 1.72;
    const position = (mesh: THREE.Mesh, offset: number, height = y) => {
      mesh.position.set(art.x + dx * offset, height, art.z + dz * offset);
      mesh.rotation.y = yaw;
      return mesh;
    };

    position(add(new THREE.PlaneGeometry(art.width + 0.40, art.height + 0.37), shadow), 0.003, y - 0.04);
    position(add(new THREE.BoxGeometry(art.width + 0.16, art.height + 0.16, 0.065), frame), 0.046);
    position(add(new THREE.BoxGeometry(art.width + 0.105, art.height + 0.105, 0.02), mat), 0.082);
    const material = new THREE.MeshBasicMaterial({ color: "#b7aa98", toneMapped: false });
    const image = position(add(new THREE.PlaneGeometry(art.width, art.height), material), 0.095);
    image.userData.artworkIndex = art.index;
    clickable.push(image);
    pending.push({ material, art: item, room: art.room });
    const labelTexture = makeLabel(item.name, art.index);
    if (labelTexture) {
      position(add(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false })),
        0.012, y - art.height / 2 - 0.18);
    }
  }

  let disposed = false;
  let running = 0;
  let activeRoom = 0;
  const tried = new Set<number>();
  function loadNearby(room: number) {
    activeRoom = room;
    lightRoom(room);
    fillTextureQueue();
  }
  function fillTextureQueue() {
    if (disposed) return;
    const candidates = pending
      .filter(({ art, room }) => !tried.has(art.index) && (room === activeRoom || neighbors[activeRoom].includes(room)))
      .sort((a, b) => Number(b.room === activeRoom) - Number(a.room === activeRoom));
    for (const { material, art } of candidates.slice(0, 4 - running)) {
      tried.add(art.index);
      running++;
      const img = new Image();
      img.onload = () => {
        if (!disposed) {
          const imageScale = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.naturalWidth * imageScale));
          canvas.height = Math.max(1, Math.round(img.naturalHeight * imageScale));
          const context = canvas.getContext("2d");
          context?.drawImage(img, 0, 0, canvas.width, canvas.height);
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
          material.map = texture;
          material.color.set("#fff");
          material.needsUpdate = true;
          refresh();
        }
        running--;
        fillTextureQueue();
      };
      img.onerror = () => { running--; fillTextureQueue(); };
      img.src = art.url;
    }
  }

  function roomAt(x: number, z: number) {
    return rooms.find(({ bounds }) => inside(bounds, x, z))?.index;
  }
  function blocked(x: number, z: number) {
    const room = rooms.find(({ bounds }) => inside(bounds, x, z, PLAYER_RADIUS));
    if (room) {
      const seat = room.index % 2 === 0;
      const turned = turnedSeats[room.index];
      return seat && Math.abs(x - room.x - seatX) < (turned ? 0.34 : 1.03) + PLAYER_RADIUS
        && Math.abs(z - room.z - seatZ) < (turned ? 1.03 : 0.34) + PLAYER_RADIUS;
    }
    return !connections.some(({ bounds, fromWall }) => {
      const acrossX = fromWall === "east" || fromWall === "west";
      return inside(bounds, x, z, acrossX ? -PLAYER_RADIUS : PLAYER_RADIUS, acrossX ? PLAYER_RADIUS : -PLAYER_RADIUS);
    });
  }
  function dispose() {
    disposed = true;
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      const material = object.material as THREE.Material;
      if ("map" in material && material.map instanceof THREE.Texture) textures.add(material.map);
      materials.add(material);
    });
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  }
  return { scene, clickable, occluders, blocked, dispose, loadNearby, roomAt, rooms };
}

function createShadow() {
  const size = 96;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.shadowColor = "#38271dc4";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = "#38271d68";
    ctx.fillRect(19, 19, 58, 58);
  }
  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    opacity: 0.48,
  });
}

function makeLabel(title: string, index: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 448;
  canvas.height = 112;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#f1e8d8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#675347";
  ctx.font = "22px sans-serif";
  ctx.fillText(String(index + 1).padStart(2, "0"), 22, 42);
  ctx.fillStyle = "#30281f";
  ctx.font = "26px sans-serif";
  ctx.fillText(title || "Untitled", 22, 83, 402);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
