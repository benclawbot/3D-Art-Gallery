import * as THREE from "three";
import { archLiningGeometry, partitionGeometry, seatGeometry, SIDE, VAULT_HEIGHT, WALL_HEIGHT, vaultGeometry, vaultHeight } from "./gallery-architecture";
import { createGalleryLayout } from "./gallery-layout";
import { finishTexture } from "./scene-finishes";

export type WorldArtwork = { index: number; url: string; width: number; height: number; name: string };
export const ROOM_DEPTH = 10;
const DOOR_HALF_WIDTH = 1.38;
const DOOR_SPRING = 2.03;
const PLAYER_RADIUS = 0.25;

export function createScene(artworks: WorldArtwork[], renderer: THREE.WebGLRenderer, refresh: () => void) {
  const layout = createGalleryLayout(artworks.map(({ width, height }) => width / Math.max(1, height)));
  const length = layout.roomCount * ROOM_DEPTH;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#cabdae");
  scene.fog = new THREE.Fog("#cabdae", 28, 62);
  scene.add(new THREE.HemisphereLight("#fffaf3", "#b8a692", 1.65));
  const daylight = new THREE.DirectionalLight("#fff5e9", 1.28);
  daylight.position.set(-4, 8, -5);
  const bounce = new THREE.DirectionalLight("#ffecd4", 0.65);
  bounce.position.set(1, -8, 3);
  scene.add(daylight, bounce);

  const plasterTexture = finishTexture("plaster", renderer);
  const stoneTexture = finishTexture("stone", renderer);
  const woodTexture = finishTexture("oak", renderer);
  const plaster = new THREE.MeshStandardMaterial({ color: "#d9cbb9", map: plasterTexture, roughness: 0.96 });
  const lime = new THREE.MeshStandardMaterial({ color: "#e8dac8", map: plasterTexture, roughness: 0.95 });
  const sandstone = new THREE.MeshStandardMaterial({ color: "#c8ad90", map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.04, roughness: 0.9 });
  const floor = new THREE.MeshStandardMaterial({ color: "#c6b6a0", map: stoneTexture, bumpMap: stoneTexture, bumpScale: 0.075, roughness: 0.68 });
  const seam = new THREE.MeshStandardMaterial({ color: "#998673", roughness: 1 });
  const ceiling = new THREE.MeshStandardMaterial({ color: "#c79c70", map: woodTexture, bumpMap: woodTexture, bumpScale: 0.027, roughness: 0.89 });
  const trim = new THREE.MeshStandardMaterial({ color: "#635342", roughness: 0.82 });
  const frame = new THREE.MeshStandardMaterial({ color: "#463326", roughness: 0.72 });
  const mat = new THREE.MeshStandardMaterial({ color: "#f7f0e1", roughness: 0.9 });
  const oak = new THREE.MeshStandardMaterial({ color: "#a77550", map: woodTexture, roughness: 0.75 });
  const fixture = new THREE.MeshStandardMaterial({ color: "#5b5246", roughness: 0.65 });
  const luminous = new THREE.MeshBasicMaterial({ color: "#fff5e2", toneMapped: false });
  const shadow = createShadow();
  const group = new THREE.Group();
  scene.add(group);
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, material: THREE.Material) => {
    const geometry = new THREE.BoxGeometry(w, h, d);
    const vertex = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const uv = geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) {
      const across = Math.abs(normal.getX(i)) > 0.5 ? vertex.getZ(i) + z : vertex.getX(i) + x;
      const up = Math.abs(normal.getY(i)) > 0.5 ? vertex.getZ(i) + z : vertex.getY(i) + y;
      uv.setXY(i, across / 3.2, up / 3.2);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  };
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, z = 0) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.z = z;
    group.add(mesh);
    return mesh;
  }

  box(9.2, 0.12, length + 0.24, 0, -0.06, length / 2, floor);
  add(vaultGeometry(SIDE * 2, length / 2, length / 2 + 0.08), ceiling);
  for (const side of [-1, 1]) {
    box(0.24, WALL_HEIGHT + 0.02, length, side * (SIDE + 0.12), WALL_HEIGHT / 2, length / 2, side < 0 ? lime : plaster);
    box(0.025, 0.039, length, side * (SIDE - 0.011), 0.022, length / 2, trim);
    box(0.06, 0.062, length, side * (SIDE - 0.02), WALL_HEIGHT - 0.025, length / 2, trim);
  }
  for (let z = 1.25; z < length; z += 1.25) {
    box(9, 0.002, 0.012, 0, 0, z, seam);
    const stagger = Math.round(z / 1.25) % 2 ? 0 : 0.9;
    for (let x = -3.6 + stagger; x < SIDE; x += 1.8) box(0.012, 0.002, 1.25, x, 0, z - 0.625, seam);
  }
  box(9.2, VAULT_HEIGHT, 0.24, 0, VAULT_HEIGHT / 2, -0.12, plaster);
  box(9.2, VAULT_HEIGHT, 0.24, 0, VAULT_HEIGHT / 2, length + 0.12, lime);
  add(partitionGeometry(2.04, 1.92, 0.14), plaster, length - 0.21);
  add(archLiningGeometry(2.04, 1.92, 0.19), sandstone, length - 0.21);
  for (let room = 0; room < layout.roomCount; room++) {
    const z = room * ROOM_DEPTH;
    if (room > 0) {
      add(partitionGeometry(DOOR_HALF_WIDTH, DOOR_SPRING, 0.48), plaster, z);
      add(archLiningGeometry(DOOR_HALF_WIDTH, DOOR_SPRING, 0.54), sandstone, z);
      box(DOOR_HALF_WIDTH * 2, 0.005, 0.56, 0, 0.0025, z, seam);
    }

    add(vaultGeometry(2.76, z + 5, 2.22, 0.021, true), fixture);
    add(vaultGeometry(2.58, z + 5, 2.22, 0.032, true), luminous);
    for (const side of [-1, 1]) {
      const track = side * 3.36;
      const height = vaultHeight(track);
      box(0.035, 0.027, 6.45, track, height - 0.024, z + 5, fixture);
      for (const offset of [2.6, 5, 7.4]) {
        const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.074, 0.18, 16), fixture);
        lamp.rotation.z = side * 0.48;
        lamp.position.set(track, height - 0.134, z + offset);
        group.add(lamp);
      }
    }
    if (room % 2 === 0) {
      const benchZ = z + 5.3;
      add(seatGeometry(), oak, benchZ).position.set(0.65, 0.40, benchZ);
      for (const x of [-0.02, 1.32]) {
        add(new THREE.CylinderGeometry(0.14, 0.19, 0.40, 28), sandstone, benchZ).position.set(x, 0.20, benchZ);
      }
      const benchShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 0.94), shadow);
      benchShadow.rotation.x = -Math.PI / 2;
      benchShadow.position.set(0.65, 0.003, benchZ);
      group.add(benchShadow);
    }
  }

  // A small fixed pool of lights follows the occupied rooms without increasing
  // the number of lights the GPU must evaluate for a fifty-photo exhibition.
  const washes = [-1, 1, -1, 1].map((side) => {
    const light = new THREE.SpotLight("#fff1d5", 47, 9, 0.84, 0.85, 1.5);
    scene.add(light, light.target);
    return { light, side };
  });
  const lightRoom = (room: number) => {
    const nearby = room + (room + 1 < layout.roomCount ? 1 : -1);
    for (const [i, { light, side }] of washes.entries()) {
      const index = i < 2 ? room : nearby;
      light.intensity = index < 0 ? 0 : 48;
      light.position.set(side * 3.36, vaultHeight(3.36) - 0.18, index * ROOM_DEPTH + 5);
      light.target.position.set(side * SIDE, 1.35, index * ROOM_DEPTH + 5);
    }
  };
  const endLight = new THREE.SpotLight("#ffedcd", 30, 8, 0.55, 0.74, 1.6);
  endLight.position.set(0, VAULT_HEIGHT - 0.20, length - 1.58);
  endLight.target.position.set(0, 1.72, length);
  scene.add(endLight, endLight.target);
  const endLamp = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.072, 0.17, 12), fixture);
  endLamp.rotation.x = -0.48;
  endLamp.position.copy(endLight.position);
  group.add(endLamp);

  const clickable: THREE.Mesh[] = [];
  const pending: { material: THREE.MeshBasicMaterial; art: WorldArtwork; room: number }[] = [];
  for (const art of layout.artworks) {
    const item = artworks[art.index];
    const end = art.side === "end";
    const direction = art.side === "left" ? 1 : -1;
    const x = end ? 0 : direction * -SIDE;
    const y = 1.72;
    const rotation = end ? Math.PI : direction * Math.PI / 2;
    const position = (mesh: THREE.Mesh, offset: number, height = y, z = art.z) => {
      mesh.position.set(end ? x : x + direction * offset, height, end ? z - offset : z);
      mesh.rotation.y = rotation;
      group.add(mesh);
    };

    position(new THREE.Mesh(new THREE.PlaneGeometry(art.width + 0.40, art.height + 0.37), shadow), 0.003, y - 0.04);
    if (end) {
      box(art.width + 0.16, art.height + 0.16, 0.065, x, y, art.z - 0.046, frame);
      box(art.width + 0.105, art.height + 0.105, 0.02, x, y, art.z - 0.082, mat);
    } else {
      box(0.065, art.height + 0.16, art.width + 0.16, x + direction * 0.046, y, art.z, frame);
      box(0.02, art.height + 0.105, art.width + 0.105, x + direction * 0.082, y, art.z, mat);
    }
    const material = new THREE.MeshBasicMaterial({ color: "#b7aa98", toneMapped: false });
    const image = new THREE.Mesh(new THREE.PlaneGeometry(art.width, art.height), material);
    image.userData.artworkIndex = art.index;
    position(image, 0.095);
    clickable.push(image);
    pending.push({ material, art: item, room: art.room });
    const labelTexture = makeLabel(item.name, art.index);
    if (labelTexture) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.14), new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false }));
      position(label, 0.012, y - art.height / 2 - 0.18);
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
      .filter(({ art, room }) => !tried.has(art.index) && Math.abs(room - activeRoom) <= 1)
      .sort((a, b) => Math.abs(a.room - activeRoom) - Math.abs(b.room - activeRoom));
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

  function blocked(x: number, z: number) {
    if (Math.abs(x) > SIDE - PLAYER_RADIUS || z < PLAYER_RADIUS || z > length - PLAYER_RADIUS) return true;
    const threshold = Math.round(z / ROOM_DEPTH) * ROOM_DEPTH;
    if (threshold > 0 && threshold < length && Math.abs(z - threshold) < 0.25 + PLAYER_RADIUS
      && Math.abs(x) > DOOR_HALF_WIDTH - PLAYER_RADIUS) return true;
    const room = Math.floor(z / ROOM_DEPTH);
    return room % 2 === 0 && Math.abs(z - room * ROOM_DEPTH - 5.3) < 0.34 + PLAYER_RADIUS
      && Math.abs(x - 0.65) < 1.03 + PLAYER_RADIUS;
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
  return { scene, clickable, blocked, dispose, loadNearby, roomCount: layout.roomCount };
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
