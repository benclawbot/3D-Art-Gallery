import * as THREE from "three";

type Surface = "plaster" | "stone" | "oak";

function lattice(x: number, y: number) {
  const hash = Math.imul(x, 0x1f123bb5) ^ Math.imul(y, 0x5f356495);
  return ((Math.imul(hash ^ (hash >>> 15), 0x27d4eb2d) >>> 0) / 4294967295) - 0.5;
}

function periodicNoise(x: number, y: number, periodX: number, periodY = periodX) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const a = THREE.MathUtils.smoothstep(x - ix, 0, 1);
  const b = THREE.MathUtils.smoothstep(y - iy, 0, 1);
  const left = ix % periodX;
  const right = (ix + 1) % periodX;
  const top = iy % periodY;
  const bottom = (iy + 1) % periodY;
  const rowA = THREE.MathUtils.lerp(lattice(left, top), lattice(right, top), a);
  const rowB = THREE.MathUtils.lerp(lattice(left, bottom), lattice(right, bottom), a);
  return THREE.MathUtils.lerp(rowA, rowB, b);
}

function travertine(u: number, v: number, cloud: number, grain: number, pores: number) {
  const warped = u * 7 + v * 5 + cloud * 0.58 + grain * 0.20;
  const band = Math.abs(Math.sin(warped * Math.PI));
  const vein = THREE.MathUtils.smoothstep(band, 0.68, 0.99);
  const fine = Math.sin((warped * 6 + grain * 0.6) * Math.PI * 2);
  const fossil = Math.max(0, periodicNoise(u * 38, v * 79, 38, 79) - 0.31);
  return 239 + cloud * 18 + grain * 14 - vein * (9 + cloud * 8) + fine * 2 - fossil * 78 + pores * 16;
}

function oak(u: number, v: number, pores: number) {
  const board = u * 14;
  const seam = Math.abs(board - Math.round(board));
  const gap = 1 - THREE.MathUtils.smoothstep(seam, 0.004, 0.03);
  const variation = lattice(Math.floor(board), 151);
  const drift = periodicNoise(u * 17, v * 4, 17, 4);
  const fibers = periodicNoise(u * 91, v * 8, 91, 8);
  const growth = Math.sin((u * 128 + drift * 1.65 + fibers * 0.25) * Math.PI * 2);
  return 222 + variation * 31 + drift * 22 + fibers * 17 + growth * 7 - gap * 59 + pores * 7;
}

/** Tileable surface color. The scene multiplies the finish with each material's tint. */
export function finishTexture(surface: Surface, renderer: THREE.WebGLRenderer) {
  const size = surface === "plaster" ? 256 : 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const cloud = periodicNoise(u * 5, v * 5, 5);
      const grain = periodicNoise(u * 23, v * 23, 23);
      const pores = lattice(x + 731, y + 439);
      const value = surface === "oak" ? oak(u, v, pores) : surface === "stone"
        ? travertine(u, v, cloud, grain, pores) : 241 + cloud * 10 + grain * 10 + pores * 14;
      const offset = (y * size + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

/** World-aligned, independently beveled oak boards clipped to a rectangular floor. */
export function oakFloorGeometry(width: number, depth: number, worldX: number, worldZ: number) {
  const positions: number[] = [];
  const boardInfo: number[] = [];
  const indices: number[] = [];
  const boardLength = 2.25;
  const boardWidth = 0.223;
  const joint = 0.003;
  const bevel = 0.0025;
  const minX = worldX - width / 2;
  const maxX = worldX + width / 2;
  const minZ = worldZ - depth / 2;
  const maxZ = worldZ + depth / 2;
  const firstRow = Math.floor(minZ / boardWidth);
  const lastRow = Math.ceil(maxZ / boardWidth);

  function vertex(x: number, z: number, y: number, u: number, v: number, tone: number) {
    positions.push(x - worldX, y, z - worldZ);
    boardInfo.push(u, v, tone);
  }
  type Corner = [number, number, number, number, number];
  function quad(a: Corner, b: Corner, c: Corner, d: Corner, tone: number) {
    const base = positions.length / 3;
    vertex(a[0], a[1], a[2], a[3], a[4], tone);
    vertex(b[0], b[1], b[2], b[3], b[4], tone);
    vertex(c[0], c[1], c[2], c[3], c[4], tone);
    vertex(d[0], d[1], d[2], d[3], d[4], tone);
    // Counter-clockwise from above, so the plank tops face the room lights.
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  for (let row = firstRow; row <= lastRow; row++) {
    const z0 = row * boardWidth + joint / 2;
    const z1 = (row + 1) * boardWidth - joint / 2;
    if (z1 <= minZ || z0 >= maxZ) continue;
    const stagger = (0.5 + lattice(173, row + 37)) * boardLength;
    const jointAt = (col: number) => col * boardLength + stagger + 0.52 * lattice(col + 81, row + 511);
    const firstBoard = Math.floor((minX - stagger) / boardLength) - 1;
    const lastBoard = Math.ceil((maxX - stagger) / boardLength) + 1;
    for (let col = firstBoard; col <= lastBoard; col++) {
      const start = jointAt(col);
      const end = jointAt(col + 1);
      const boardStart = start + joint / 2;
      const boardEnd = end - joint / 2;
      const x0 = Math.max(minX, boardStart);
      const x1 = Math.min(maxX, boardEnd);
      const cz0 = Math.max(minZ, z0);
      const cz1 = Math.min(maxZ, z1);
      if (x1 - x0 < 0.0001 || cz1 - cz0 < 0.0001) continue;
      const seed = lattice(col + 317, row + 719);
      const tone = seed * 0.5 + lattice(col + 977, row + 41) * 0.22;
      const u0 = (x0 - start) / (end - start);
      const u1 = (x1 - start) / (end - start);
      const v0 = (cz0 - row * boardWidth) / boardWidth;
      const v1 = (cz1 - row * boardWidth) / boardWidth;
      // Keep cut edges flush where a board continues across a room or corridor.
      const bx = Math.min(bevel, (x1 - x0) / 3);
      const bz = Math.min(bevel, (cz1 - cz0) / 3);
      const ix0 = x0 === boardStart ? x0 + bx : x0;
      const ix1 = x1 === boardEnd ? x1 - bx : x1;
      const iz0 = cz0 === z0 ? cz0 + bz : cz0;
      const iz1 = cz1 === z1 ? cz1 - bz : cz1;
      const low = 0.0014;
      const high = 0.0043;
      if (iz0 > cz0) quad([x0, cz0, low, u0, v0], [x1, cz0, low, u1, v0], [ix1, iz0, high, u1, v0], [ix0, iz0, high, u0, v0], tone);
      if (ix1 < x1) quad([x1, cz0, low, u1, v0], [x1, cz1, low, u1, v1], [ix1, iz1, high, u1, v1], [ix1, iz0, high, u1, v0], tone);
      if (iz1 < cz1) quad([x1, cz1, low, u1, v1], [x0, cz1, low, u0, v1], [ix0, iz1, high, u0, v1], [ix1, iz1, high, u1, v1], tone);
      if (ix0 > x0) quad([x0, cz1, low, u0, v1], [x0, cz0, low, u0, v0], [ix0, iz0, high, u0, v0], [ix0, iz1, high, u0, v1], tone);
      quad([ix0, iz0, high, u0, v0], [ix1, iz0, high, u1, v0], [ix1, iz1, high, u1, v1], [ix0, iz1, high, u0, v1], tone);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("boardInfo", new THREE.Float32BufferAttribute(boardInfo, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Oak grain and softly darkened joints, with restrained board-to-board variation. */
export function addOakFloorShader(material: THREE.MeshStandardMaterial, seat?: [number, number], turnSeat = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stillroomSeat = { value: new THREE.Vector2(...(seat ?? [0, 0])) };
    shader.uniforms.stillroomSeatAmount = { value: seat ? 1 : 0 };
    shader.uniforms.stillroomSeatTurn = { value: turnSeat ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nattribute vec3 boardInfo;\nvarying vec3 vStillroomBoard;\nvarying vec2 vStillroomFloor;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>\nvStillroomBoard = boardInfo;\nvStillroomFloor = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nvarying vec3 vStillroomBoard;\nvarying vec2 vStillroomFloor;\nuniform vec2 stillroomSeat;\nuniform float stillroomSeatAmount;\nuniform float stillroomSeatTurn;\n
float stillroomWoodHash(vec2 p) {
  vec3 h = fract(p.xyx * vec3(0.1031, 0.1030, 0.0973));
  h += dot(h, h.yzx + 33.33);
  return fract((h.x + h.y) * h.z);
}
float stillroomWoodNoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(stillroomWoodHash(i), stillroomWoodHash(i + vec2(1.0, 0.0)), f.x),
             mix(stillroomWoodHash(i + vec2(0.0, 1.0)), stillroomWoodHash(i + vec2(1.0)), f.x), f.y);
}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
float stillroomSeed = vStillroomBoard.z * 223.0;
vec2 stillroomUV = vStillroomBoard.xy;
float stillroomDrift = stillroomWoodNoise(vec2(stillroomUV.x * 3.6 + stillroomSeed, stillroomUV.y * 3.2)) - 0.5;
vec2 stillroomKnotCenter = vec2(
  0.18 + 0.64 * stillroomWoodHash(vec2(stillroomSeed, 3.17)),
  0.20 + 0.60 * stillroomWoodHash(vec2(stillroomSeed, 5.31)));
vec2 stillroomKnotOffset = (stillroomUV - stillroomKnotCenter) * vec2(7.0, 1.9);
float stillroomKnotDistance = length(stillroomKnotOffset);
float stillroomKnotWeight = step(0.77, stillroomWoodHash(vec2(stillroomSeed, 9.43)));
float stillroomKnotFlow = stillroomKnotWeight * exp(-5.0 * stillroomKnotDistance);
float stillroomLongGrain = stillroomUV.y + 0.24 * stillroomDrift + 0.035 * sin(stillroomUV.x * 8.0 + stillroomSeed)
  + 0.27 * stillroomKnotFlow * stillroomKnotOffset.y;
float stillroomFine = stillroomWoodNoise(vec2(stillroomUV.x * 10.0 + stillroomSeed, stillroomLongGrain * 120.0)) - 0.5;
float stillroomGrowth = stillroomLongGrain * 12.0 + stillroomSeed;
float stillroomRings = sin(stillroomGrowth * 6.28318) * (1.0 - smoothstep(0.22, 0.85, fwidth(stillroomGrowth)));
float stillroomFleck = smoothstep(0.73, 0.96, stillroomWoodNoise(vec2(stillroomUV.x * 39.0 + stillroomSeed, stillroomLongGrain * 76.0)));
float stillroomKnot = stillroomKnotWeight * (1.0 - smoothstep(0.018, 0.14, stillroomKnotDistance));
float stillroomGrain = 1.0 + stillroomDrift * 0.16 + stillroomFine * 0.085 + stillroomRings * 0.039 - stillroomFleck * 0.066 - stillroomKnot * 0.21;
vec2 stillroomSeatOffset = vStillroomFloor - stillroomSeat;
stillroomSeatOffset = mix(stillroomSeatOffset, stillroomSeatOffset.yx, stillroomSeatTurn);
float stillroomSeatShadow = 0.17 * exp(-dot(stillroomSeatOffset + vec2(0.07, 0.11), stillroomSeatOffset + vec2(0.07, 0.11)) / 0.82);
stillroomSeatShadow += 0.30 * exp(-pow((abs(stillroomSeatOffset.x) - 0.67) / 0.19, 2.0) - pow(stillroomSeatOffset.y / 0.21, 2.0));
diffuseColor.rgb *= stillroomGrain * (1.0 + vStillroomBoard.z * 0.43) * (1.0 - stillroomSeatShadow * stillroomSeatAmount);`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
roughnessFactor = clamp(roughnessFactor + (stillroomFine * -0.045) + stillroomFleck * 0.035, 0.35, 0.78);`);
  };
  material.customProgramCacheKey = () => "stillroom-oak-floor-v1";
}
