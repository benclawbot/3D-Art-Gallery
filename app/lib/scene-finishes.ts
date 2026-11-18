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

/**
 * Four vertices per stone slab share their own grain origin and brightness.
 * Keep the surface a single mesh per room or passage.
 */
export function travertineGeometry(width: number, depth: number) {
  const vertices: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const slabs: number[] = [];
  const indices: number[] = [];
  const tileWidth = 1.8;
  const tileDepth = 1.25;

  for (let row = 0; row * tileDepth < depth; row++) {
    const z0 = row * tileDepth;
    const z1 = Math.min(depth, z0 + tileDepth);
    const stagger = (row % 2) * (tileWidth / 2);
    for (let col = 0; col * tileWidth - stagger < width; col++) {
      const origin = col * tileWidth - stagger;
      const x0 = Math.max(0, origin);
      const x1 = Math.min(width, origin + tileWidth);
      const tone = lattice(col + 113, row + Math.round(width * 47));
      const offsetV = lattice(col + 11, row + 291);
      const flip = tone < 0 ? -1 : 1;
      const first = vertices.length / 3;
      for (const [x, z] of [[x0, z0], [x0, z1], [x1, z0], [x1, z1]]) {
        const u = (x - origin) / tileWidth;
        const v = (z - z0) / tileDepth;
        vertices.push(x - width / 2, 0, z - depth / 2);
        normals.push(0, 1, 0);
        uvs.push(tone + flip * u * 0.58, offsetV + v * 0.4);
        slabs.push(u, v, tone + 0.5);
      }
      indices.push(first, first + 1, first + 2, first + 2, first + 1, first + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("slabInfo", new THREE.Float32BufferAttribute(slabs, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Lightly occlude the stone joints and soften the contact shadows under the bench. */
export function addTravertineShader(material: THREE.MeshStandardMaterial, seat?: [number, number], turnSeat = false) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.stillroomSeat = { value: new THREE.Vector2(...(seat ?? [0, 0])) };
    shader.uniforms.stillroomSeatAmount = { value: seat ? 1 : 0 };
    shader.uniforms.stillroomSeatTurn = { value: turnSeat ? 1 : 0 };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>
attribute vec3 slabInfo;
varying vec3 vStillroomSlab;
varying vec2 vStillroomFloor;`)
      .replace("#include <begin_vertex>", `#include <begin_vertex>
vStillroomSlab = slabInfo;
vStillroomFloor = position.xz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
varying vec3 vStillroomSlab;
varying vec2 vStillroomFloor;
uniform vec2 stillroomSeat;
uniform float stillroomSeatAmount;
uniform float stillroomSeatTurn;

float stillroomGroundShadow(vec2 offset, vec2 spread) {
  vec2 radius = offset / spread;
  return exp(-dot(radius, radius));
}`)
      .replace("#include <map_fragment>", `#include <map_fragment>
vec2 stillroomEdge = min(vStillroomSlab.xy, vec2(1.0) - vStillroomSlab.xy);
float stillroomGrout = smoothstep(0.002, 0.013, min(stillroomEdge.x, stillroomEdge.y));
vec2 stillroomSeatOffset = vStillroomFloor - stillroomSeat;
stillroomSeatOffset = mix(stillroomSeatOffset, stillroomSeatOffset.yx, stillroomSeatTurn);
float stillroomShadow = 0.17 * stillroomGroundShadow(stillroomSeatOffset + vec2(0.07, 0.11), vec2(0.92, 0.44));
stillroomShadow += 0.30 * stillroomGroundShadow(vec2(abs(stillroomSeatOffset.x) - 0.67, stillroomSeatOffset.y), vec2(0.19, 0.21));
diffuseColor.rgb *= mix(0.76, 1.0, stillroomGrout) * mix(0.93, 1.05, vStillroomSlab.z)
  * (1.0 - stillroomShadow * stillroomSeatAmount);`);
  };
  material.customProgramCacheKey = () => "stillroom-travertine-v2";
}
