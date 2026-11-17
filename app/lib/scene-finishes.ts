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
  return 239 + cloud * 26 + grain * 19 - vein * (16 + cloud * 12) + fine * 4 - fossil * 78 + pores * 14;
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
