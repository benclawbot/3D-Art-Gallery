import * as THREE from "three";
import { portalGeometry } from "./gallery-architecture";
import { createGalleryLayout, type Bounds, type GalleryConnection, type GalleryRoom, type Wall } from "./gallery-layout";
import { addTravertineShader, finishTexture, travertineGeometry } from "./scene-finishes";
import { createOliveTree } from "./olive-tree";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

export type WorldArtwork = { index: number; url: string; width: number; height: number; name: string };

const WALLS: Wall[] = ["west", "east", "north", "south"];
const WALL_THICKNESS = 0.24;
const PLAYER_RADIUS = 0.25;
const FLAT_CEILING = 3.42;
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
  scene.background = new THREE.Color("#cbdae4");
  scene.fog = new THREE.Fog("#bab3a6", 48, 88);
  scene.add(new THREE.HemisphereLight("#fff5e7", "#a09380", 1.12));
  const entrance = rooms[0];
  const sun = new THREE.SpotLight("#ffe7be", 6.6, 31, 0.49, 0.30, 0);
  sun.position.set(entrance.x - 17, 10.9, entrance.z + 6.4);
  sun.target.position.set(entrance.x, 0, entrance.z - 0.7);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(2048);
  sun.shadow.camera.near = 7;
  sun.shadow.camera.far = 30;
  sun.shadow.normalBias = 0.019;
  sun.shadow.bias = -0.0002;
  scene.add(sun, sun.target);

  const plasterTexture = finishTexture("plaster", renderer);
  const stoneTexture = finishTexture("stone", renderer);
  const woodTexture = finishTexture("oak", renderer);
  const plaster = new THREE.MeshStandardMaterial({ color: "#d9cbb9", map: plasterTexture, roughness: 0.96 });
  const floor = new THREE.MeshStandardMaterial({ color: "#bbaa92", map: stoneTexture, bumpMap: plasterTexture, bumpScale: 0.018, roughness: 0.56 });
  addTravertineShader(floor);
  const trim = new THREE.MeshStandardMaterial({ color: "#635342", roughness: 0.82 });
  const frame = new THREE.MeshStandardMaterial({ color: "#463326", roughness: 0.72 });
  const mat = new THREE.MeshStandardMaterial({ color: "#f7f0e1", roughness: 0.9 });
  const limestone = new THREE.MeshStandardMaterial({
    color: "#e1cfb2", map: plasterTexture, bumpMap: plasterTexture, bumpScale: 0.029, roughness: 0.87,
    emissive: "#bd9b70", emissiveMap: plasterTexture, emissiveIntensity: 0.20,
  });
  const creamCeiling = limestone.clone();
  creamCeiling.emissiveIntensity = 0.40;
  const palePaving = new THREE.MeshStandardMaterial({
    color: "#c6b69b", map: stoneTexture, bumpMap: plasterTexture, bumpScale: 0.014, roughness: 0.45,
  });
  const charcoal = new THREE.MeshStandardMaterial({
    color: "#635a4f", map: plasterTexture, bumpMap: plasterTexture, bumpScale: 0.039, roughness: 0.86,
    emissive: "#67594c", emissiveIntensity: 0.16,
  });
  const graphite = new THREE.MeshStandardMaterial({
    color: "#473f35", map: stoneTexture, bumpMap: plasterTexture, bumpScale: 0.014, roughness: 0.27, metalness: 0.05,
    emissive: "#625044", emissiveMap: stoneTexture, emissiveIntensity: 0.13,
  });
  const darkOak = new THREE.MeshStandardMaterial({
    color: "#594130", map: woodTexture, bumpMap: woodTexture, bumpScale: 0.027, roughness: 0.60,
    emissive: "#73533d", emissiveMap: woodTexture, emissiveIntensity: 0.35,
  });
  const benchWood = darkOak.clone();
  benchWood.emissiveIntensity = 0.13;
  const bronze = new THREE.MeshStandardMaterial({ color: "#615043", metalness: 0.36, roughness: 0.36 });
  const glass = new THREE.MeshBasicMaterial({ color: "#e6e9e2", transparent: true, opacity: 0.065, side: THREE.DoubleSide, depthWrite: false });
  const daylightFloor = palePaving.clone();
  const charcoalTrim = new THREE.MeshStandardMaterial({ color: "#302820", roughness: 0.61 });
  addTravertineShader(daylightFloor, [entrance.bounds.minX + 0.78 - entrance.x, 0.36], true);
  addTravertineShader(graphite);
  const passageLight = new THREE.MeshBasicMaterial({ color: "#fff5e2", toneMapped: false });
  const shadow = createShadow();
  const group = new THREE.Group();
  scene.add(group);
  const occluders: THREE.Mesh[] = [];
  const doors = rooms.map(() => new Map<Wall, GalleryConnection>());
  const neighbors = rooms.map(() => [] as number[]);
  const furniture = rooms.map(() => [] as Bounds[]);
  const isPrintRoom = (index: number) => index > 0 && index === rooms.length - 1;
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

  const roomArt = rooms.map(({ index }) => layout.artworks.filter((art) => art.room === index));
  const fixturePositions = rooms.map(() => [] as { position: THREE.Vector3; target: THREE.Vector3; feature: boolean }[]);
  for (const room of rooms) {
    const { index, x, z, width, depth } = room;
    const feature = roomArt[index].find((art) => art.feature);
    const court = index === 0;
    const print = isPrintRoom(index);
    const wallFinish = court ? limestone : print ? charcoal : plaster;
    const start = group.children.length;
    const paving = court ? daylightFloor : print ? graphite : floor;
    add(travertineGeometry(width, depth), paving, x, 0, z);
    box(width + 0.14, 0.19, depth + 0.14, x, FLAT_CEILING + 0.095, z, print ? darkOak : creamCeiling);

    for (const wall of WALLS) {
      const side = wallFace(room, wall);
      const wallX = side.x - side.dx * WALL_THICKNESS / 2;
      const wallZ = side.z - side.dz * WALL_THICKNESS / 2;
      const edge = doors[index].get(wall);
      if (court && wall === "west") {
        const bottom = 0.035;
        const top = FLAT_CEILING - 0.11;
        const opening = side.span - WALL_THICKNESS * 2;
        const bays = Math.round(opening / 1.46);
        box(WALL_THICKNESS, bottom, side.span, wallX, bottom / 2, wallZ, limestone);
        box(WALL_THICKNESS, FLAT_CEILING - top, side.span, wallX, (FLAT_CEILING + top) / 2, wallZ, limestone);
        const pane = add(new THREE.PlaneGeometry(opening, top - bottom), glass, side.x - 0.076, (top + bottom) / 2, wallZ);
        pane.rotation.y = Math.PI / 2;
        for (let bar = 0; bar <= bays; bar++) {
          const zAt = wallZ - opening / 2 + opening * bar / bays;
          box(0.13, top - bottom, 0.051, side.x - 0.035, (top + bottom) / 2, zAt, bronze);
          box(0.023, top - bottom, 0.065, side.x + 0.034, (top + bottom) / 2, zAt, bronze);
        }
        for (const yAt of [bottom, top]) box(0.16, 0.051, opening, side.x - 0.025, yAt, wallZ, bronze);
        continue;
      }

      if (edge) {
        const corridor = edge.bounds;
        const center = side.dx ? room.z - (corridor.minZ + corridor.maxZ) / 2 : (corridor.minX + corridor.maxX) / 2 - room.x;
        const radius = side.dx ? (corridor.maxZ - corridor.minZ) / 2 : (corridor.maxX - corridor.minX) / 2;
        const structure = add(portalGeometry(radius, side.span, center, 0.38), wallFinish, wallX, 0, wallZ);
        structure.rotation.y = side.rotation;
        occluders.push(structure);
      } else {
        const structure = box(side.dx ? WALL_THICKNESS : side.span, FLAT_CEILING, side.dx ? side.span : WALL_THICKNESS,
          wallX, FLAT_CEILING / 2, wallZ, wallFinish);
        occluders.push(structure);
        const shadowGap = print ? charcoalTrim : court ? bronze : trim;
        box(side.dx ? 0.018 : side.span - WALL_THICKNESS, 0.024,
          side.dx ? side.span - WALL_THICKNESS : 0.018, side.x + side.dx * 0.010, 0.014, side.z + side.dz * 0.010, shadowGap);
      }
    }

    if (court) {
      const courtWidth = 6.2;
      const courtDepth = depth + 0.90;
      const courtX = room.bounds.minX - courtWidth / 2;
      const courtGround = new THREE.MeshStandardMaterial({ color: "#b3a388", map: stoneTexture, bumpMap: plasterTexture, bumpScale: 0.045, roughness: 1 });
      box(courtWidth + 0.08, 0.15, courtDepth, courtX, -0.088, z, courtGround);
      box(0.29, 3.25, courtDepth, room.bounds.minX - courtWidth, 1.57, z, limestone);
      for (const flank of [-1, 1]) {
        box(courtWidth, 3.25, 0.32, courtX, 1.57, z + flank * (courtDepth / 2), limestone);
      }
      const gravel = new THREE.MeshStandardMaterial({ color: "#b8aa95", roughness: 0.98, metalness: 0 });
      const pebbles = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.032, 0), gravel, 6200);
      const pebble = new THREE.Object3D();
      let pebbleSeed = 0x51a7;
      const randomPebble = () => { pebbleSeed = (Math.imul(pebbleSeed, 1664525) + 1013904223) >>> 0; return pebbleSeed / 0x100000000; };
      const stoneTone = new THREE.Color();
      for (let i = 0; i < pebbles.count; i++) {
        pebble.position.set(room.bounds.minX - 0.08 - randomPebble() * (courtWidth - 0.1), 0.003, z + (randomPebble() - 0.5) * courtDepth);
        pebble.scale.set(0.38 + randomPebble() * 1.02, 0.30 + randomPebble() * 0.38, 0.50 + randomPebble() * 0.60);
        pebble.rotation.y = randomPebble() * Math.PI;
        pebble.updateMatrix();
        pebbles.setMatrixAt(i, pebble.matrix);
        pebbles.setColorAt(i, stoneTone.setScalar(0.57 + randomPebble() * 0.61));
      }
      // The gravel receives daylight without adding thousands of tiny casters.
      pebbles.receiveShadow = true;
      group.add(pebbles);
      const tree = createOliveTree(417);
      tree.scale.setScalar(1.085);
      // Measure the transformed trunk and every leaf instance, then place the whole tree
      // outside the glazing with a consistent physical gap.
      tree.updateMatrixWorld(true);
      const treeBounds = new THREE.Box3().setFromObject(tree);
      const glazingSetback = 0.68;
      const masonryInset = 0.26;
      const treeZ = THREE.MathUtils.clamp(
        z - depth * 0.28,
        z - courtDepth / 2 + masonryInset - treeBounds.min.z,
        z + courtDepth / 2 - masonryInset - treeBounds.max.z,
      );
      tree.position.set(room.bounds.minX - glazingSetback - treeBounds.max.x, 0, treeZ);
      group.add(tree);

      const benchX = room.bounds.minX + 0.78;
      const benchZ = z + 0.36;
      add(new RoundedBoxGeometry(0.51, 0.18, 2.34, 2, 0.014), limestone, benchX, 0.43, benchZ);
      for (const foot of [-0.87, 0.87]) box(0.44, 0.36, 0.26, benchX, 0.18, benchZ + foot, limestone);
      furniture[index].push({ minX: benchX - 0.255, maxX: benchX + 0.255, minZ: benchZ - 1.17, maxZ: benchZ + 1.17 });
    }

    if (print && feature) {
      const { dx, dz } = inward[feature.wall];
      const benchX = feature.x + dx * 0.36;
      const benchZ = feature.z + dz * 0.36;
      const length = Math.max(2.55, feature.width + 0.24);
      const benchWidth = dx ? 0.55 : length;
      const benchDepth = dx ? length : 0.55;
      add(new RoundedBoxGeometry(benchWidth, 0.17, benchDepth, 2, 0.012), benchWood, benchX, 0.38, benchZ);
      box(benchWidth * 0.82, 0.29, benchDepth * 0.85, benchX, 0.145, benchZ, charcoalTrim);
      furniture[index].push({ minX: benchX - benchWidth / 2, maxX: benchX + benchWidth / 2, minZ: benchZ - benchDepth / 2, maxZ: benchZ + benchDepth / 2 });
    }

    for (const wall of WALLS) {
      const works = roomArt[index].filter((art) => art.wall === wall);
      if (!works.length) continue;
      const side = wallFace(room, wall);
      const distance = print ? 1.36 : 1.63;
      const trackY = FLAT_CEILING;
      const along = works.map((art) => side.dx ? art.z : art.x);
      const railMin = Math.min(...along) - 0.92;
      const railMax = Math.max(...along) + 0.92;
      const railCenter = (railMin + railMax) / 2;
      const railLength = railMax - railMin;
      box(side.dx ? 0.024 : railLength, 0.032, side.dx ? railLength : 0.024,
        side.dx ? side.x + side.dx * distance : railCenter, trackY - 0.027,
        side.dx ? railCenter : side.z + side.dz * distance, charcoalTrim);
      for (const art of works) {
        const position = new THREE.Vector3(art.x + side.dx * distance, trackY - 0.15, art.z + side.dz * distance);
        const target = new THREE.Vector3(art.x, art.feature ? 1.88 : 1.77, art.z);
        const lamp = add(new THREE.CylinderGeometry(0.045, 0.059, 0.14, 14), charcoalTrim, position.x, position.y, position.z);
        lamp.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(position).normalize());
        fixturePositions[index].push({ position, target, feature: art.feature });
      }
    }
    fixturePositions[index].sort((a, b) => Number(b.feature) - Number(a.feature));

    if (court) {
      for (const object of group.children.slice(start)) {
        object.traverse((child) => {
          if (!(child instanceof THREE.Mesh) || child.material === glass
            || (child instanceof THREE.InstancedMesh && child.receiveShadow)) return;
          child.castShadow = child.material !== paving;
          child.receiveShadow = true;
        });
      }
    }
  }

  for (const { bounds, fromWall, from, to } of connections) {
    const width = bounds.maxX - bounds.minX;
    const depth = bounds.maxZ - bounds.minZ;
    const x = (bounds.minX + bounds.maxX) / 2;
    const z = (bounds.minZ + bounds.maxZ) / 2;
    const runsX = fromWall === "east" || fromWall === "west";
    const passageFloor = isPrintRoom(to) ? graphite : from === 0 ? palePaving : floor;
    add(travertineGeometry(width, depth), passageFloor, x, 0, z);
    const passageWall = isPrintRoom(to) ? charcoal : from === 0 ? limestone : plaster;
    const passageHeight = 3.22;
    box(width + (runsX ? -0.58 : 0.15), 0.10, depth + (runsX ? 0.15 : -0.58),
      x, passageHeight + 0.05, z, passageWall);
    for (const side of [-1, 1]) {
      const wallX = x + (runsX ? 0 : side * (width / 2 + WALL_THICKNESS / 2));
      const wallZ = z + (runsX ? side * (depth / 2 + WALL_THICKNESS / 2) : 0);
      const wall = box(runsX ? width - 0.58 : WALL_THICKNESS, passageHeight, runsX ? WALL_THICKNESS : depth - 0.58,
        wallX, passageHeight / 2, wallZ, passageWall);
      occluders.push(wall);
    }
    box(runsX ? 0.94 : 0.13, 0.018, runsX ? 0.13 : 0.94, x, passageHeight - 0.015, z, passageLight);
  }

  // A fixed light budget covers the room being visited and its nearest display room.
  const lightBanks = Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => {
    const light = new THREE.SpotLight("#ffe3bc", 0, 8, 0.70, 0.82, 1.50);
    scene.add(light, light.target);
    return light;
  }));
  function lightRoom(index: number) {
    const visible = [index, neighbors[index][0]];
    lightBanks.forEach((bank, bankIndex) => {
      const roomIndex = visible[bankIndex];
      bank.forEach((light, lampIndex) => {
        const lamp = fixturePositions[roomIndex]?.[lampIndex];
        light.intensity = lamp ? isPrintRoom(roomIndex) ? lamp.feature ? 87 : 65 : roomIndex === 0 ? 18 : 39 : 0;
        if (!lamp) return;
        light.color.set(isPrintRoom(roomIndex) ? "#ffdcaa" : "#fff3dd");
        light.position.copy(lamp.position);
        light.target.position.copy(lamp.target);
      });
    });
  }

  const clickable: THREE.Mesh[] = [];
  const pending: { material: THREE.MeshBasicMaterial; art: WorldArtwork; room: number }[] = [];
  for (const art of layout.artworks) {
    const item = artworks[art.index];
    const { dx, dz, yaw } = inward[art.wall];
    const y = isPrintRoom(art.room) && art.feature ? 1.88 : 1.73;
    const position = (mesh: THREE.Mesh, offset: number, height = y) => {
      mesh.position.set(art.x + dx * offset, height, art.z + dz * offset);
      mesh.rotation.y = yaw;
      return mesh;
    };

    position(add(new THREE.PlaneGeometry(art.width + 0.40, art.height + 0.37), shadow), 0.003, y - 0.04);
    const moulding = position(add(new THREE.BoxGeometry(art.width + 0.16, art.height + 0.16, 0.065), frame), 0.046);
    const mount = position(add(new THREE.BoxGeometry(art.width + 0.105, art.height + 0.105, 0.02), mat), 0.082);
    if (art.room === 0) {
      moulding.castShadow = true;
      moulding.receiveShadow = mount.receiveShadow = true;
    }
    const material = new THREE.MeshBasicMaterial({ color: "#b7aa98", toneMapped: false });
    const image = position(add(new THREE.PlaneGeometry(art.width, art.height), material), 0.095);
    image.userData.artworkIndex = art.index;
    clickable.push(image);
    pending.push({ material, art: item, room: art.room });
    const labelTexture = makeLabel(item.name, art.index);
    if (labelTexture) {
      position(add(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false })),
        0.012, y - art.height / 2 - 0.14);
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
    if (room) return furniture[room.index].some((bounds) => inside(bounds, x, z, -PLAYER_RADIUS));
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
    sun.shadow.dispose();
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
