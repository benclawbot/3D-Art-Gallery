import * as THREE from "three";

export const SIDE = 4.5;
export const WALL_HEIGHT = 3.42;
export const VAULT_HEIGHT = 4.52;

export function vaultHeight(x: number, span = SIDE * 2) {
  return VAULT_HEIGHT - (VAULT_HEIGHT - WALL_HEIGHT) * (x / (span / 2)) ** 2;
}

export function vaultGeometry(
  width: number,
  center: number,
  halfLength: number,
  lowering = 0,
  roundedEnds = false,
  span = SIDE * 2,
) {
  const steps = 64;
  const vertices: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const x = (i / steps - 0.5) * width;
    const radius = width / 2;
    const end = halfLength + (roundedEnds ? Math.sqrt(Math.max(0, radius * radius - x * x)) : 0);
    for (const z of [center - end, center + end]) {
      vertices.push(x, vaultHeight(x, span) - lowering, z);
      uvs.push(x / 3.2, z / 3.2);
    }
    const a = i * 2;
    if (i < steps) indices.push(a, a + 2, a + 1, a + 2, a + 3, a + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function archLine(shape: THREE.Shape, radius: number, spring: number, center = 0) {
  shape.lineTo(center - radius, spring);
  shape.absellipse(center, spring, radius, radius * 0.77, Math.PI, 0, true, 0);
  shape.lineTo(center + radius, 0);
}

export function partitionGeometry(radius: number, spring: number, depth: number, span = SIDE * 2, center = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0);
  shape.lineTo(center - radius, 0);
  archLine(shape, radius, spring, center);
  shape.lineTo(span / 2, 0);
  shape.lineTo(span / 2, VAULT_HEIGHT + 0.08);
  shape.lineTo(-span / 2, VAULT_HEIGHT + 0.08);
  shape.closePath();
  return centeredExtrusion(shape, depth);
}

export function archLiningGeometry(radius: number, spring: number, depth: number) {
  const outer = radius + 0.10;
  const shape = new THREE.Shape();
  shape.moveTo(-outer, 0);
  shape.lineTo(-radius, 0);
  archLine(shape, radius, spring);
  shape.lineTo(outer, 0);
  shape.lineTo(outer, spring);
  shape.absellipse(0, spring, outer, outer * 0.77, 0, Math.PI, false, 0);
  shape.lineTo(-outer, 0);
  shape.closePath();
  return centeredExtrusion(shape, depth);
}

function centeredExtrusion(shape: THREE.Shape, depth: number) {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, curveSegments: 28, bevelEnabled: false });
  geometry.translate(0, 0, -depth / 2);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 3.2, uv.getY(i) / 3.2);
  return geometry;
}

export function seatGeometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.69, -0.32);
  shape.lineTo(0.69, -0.32);
  shape.absarc(0.69, 0, 0.32, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-0.69, 0.32);
  shape.absarc(-0.69, 0, 0.32, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.078, bevelEnabled: true, bevelThickness: 0.016, bevelSize: 0.018,
    curveSegments: 18, bevelSegments: 3,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}
