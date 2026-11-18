import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** A gnarled olive with tapered bark and folded, lance-shaped leaves. */
export function createOliveTree(seed = 1) {
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  const tree = new THREE.Group();
  const wood: THREE.BufferGeometry[] = [];
  const sprays: { base: THREE.Vector3; tip: THREE.Vector3 }[] = [];
  const barkShades = ["#443128", "#766451", "#8a7a64", "#665243", "#544c3e"].map((color) => new THREE.Color(color));
  const up = new THREE.Vector3(0, 1, 0);
  const perpendicular = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const orientation = new THREE.Quaternion();

  function bough(points: THREE.Vector3[], radius: number, tipRadius: number, steps: number, sides: number) {
    const path = new THREE.CatmullRomCurve3(points);
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const flutes = Array.from({ length: sides }, () => 0.78 + random() * 0.36);
    const shades = flutes.map(() => barkShades[Math.floor(random() * barkShades.length)]);
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const center = path.getPoint(t);
      path.getTangent(t, tangent);
      orientation.setFromUnitVectors(up, tangent);
      const size = THREE.MathUtils.lerp(tipRadius, radius, (1 - t) ** 1.45);
      for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2 + t * 0.36;
        const depth = size * flutes[side] * (0.91 + random() * 0.19);
        perpendicular.set(Math.cos(angle) * depth, 0, Math.sin(angle) * depth)
          .applyQuaternion(orientation).add(center);
        positions.push(perpendicular.x, perpendicular.y, perpendicular.z);
        const shade = shades[side];
        const value = 0.76 + 0.31 * random();
        colors.push(shade.r * value, shade.g * value, shade.b * value);
        if (step === steps) continue;
        const a = step * sides + side;
        const b = step * sides + (side + 1) % sides;
        indices.push(a, a + sides, b, b, a + sides, b + sides);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    wood.push(geometry);
    return path;
  }

  const vector = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const trunk = bough([
    vector(0, -0.08, 0), vector(0.14, 0.42, 0.06), vector(-0.03, 1.04, 0.03),
    vector(-0.21, 1.60, -0.12), vector(0.08, 2, -0.30),
  ], 0.25, 0.062, 21, 16);
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4;
    const end = vector(Math.cos(angle) * (0.32 + random() * 0.28), -0.08, Math.sin(angle) * (0.32 + random() * 0.28));
    bough([vector(0, 0.18, 0), end.clone().multiplyScalar(0.56).add(vector(0, 0.08, 0)), end], 0.102, 0.024, 4, 7);
  }
  for (let branch = 0; branch < 9; branch++) {
    const angle = branch * 2.4 + random() * 0.47;
    const start = trunk.getPoint(0.48 + branch * 0.059);
    const reach = 0.92 + (0.69 - branch * 0.034) * random() + Math.abs(Math.cos(angle)) * 0.22;
    const mid = start.clone().add(vector(Math.cos(angle) * reach * 0.55, 0.40 + random() * 0.29, Math.sin(angle) * reach * 0.58));
    const tip = vector(Math.cos(angle + 0.24) * reach, mid.y + 0.36 + random() * 0.56, Math.sin(angle + 0.24) * reach);
    const limb = bough([start, mid, tip], 0.106 - branch * 0.0065, 0.012, 13, 10);
    for (let twig = 0; twig < 5; twig++) {
      const stem = limb.getPoint(0.29 + twig * 0.165);
      const heading = angle + (twig % 2 ? -1 : 1) * (0.50 + random() * 0.79);
      const length = 0.37 + random() * 0.51;
      const fork = stem.clone().add(vector(Math.cos(heading) * length * 0.55, 0.26 + random() * 0.19, Math.sin(heading) * length * 0.62));
      const end = stem.clone().add(vector(Math.cos(heading) * length, 0.45 + random() * 0.57, Math.sin(heading) * length));
      bough([stem, fork, end], 0.030 - twig * 0.0029, 0.0032, 7, 6);
      sprays.push({ base: fork, tip: end });
      for (let forkIndex = 0; forkIndex < 2; forkIndex++) {
        const off = heading + (forkIndex === 0 ? -0.89 : 0.87);
        const base = fork.clone().lerp(end, 0.20 + forkIndex * 0.48);
        const tip = base.clone().add(vector(Math.cos(off) * 0.39, 0.25 + random() * 0.30, Math.sin(off) * 0.39));
        bough([base, tip], 0.010, 0.0016, 3, 5);
        sprays.push({ base, tip });
      }
    }
  }
  const bark = mergeGeometries(wood);
  for (const branch of wood) branch.dispose();
  if (bark) tree.add(new THREE.Mesh(bark, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94 })));

  const leaf = new THREE.BufferGeometry();
  leaf.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, -0.20, 0, 0.28, -0.16, 0, 0.65, 0, 0.025, 1,
    0.16, 0, 0.65, 0.20, 0, 0.28, 0, 0.080, 0.49,
  ], 3));
  leaf.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  leaf.computeVertexNormals();
  const colors = ["#677349", "#849165", "#a4ad83", "#727b53", "#506747", "#b2b096", "#929275"].map((color) => new THREE.Color(color));
  const leavesPerSpray = 46;
  const foliage = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({
    roughness: 0.81, side: THREE.DoubleSide,
  }), sprays.length * leavesPerSpray);
  const dummy = new THREE.Object3D();
  let leafIndex = 0;
  for (const { base, tip } of sprays) {
    for (let i = 0; i < leavesPerSpray; i++) {
      const t = 0.1 + random() * 0.94;
      dummy.position.copy(base).lerp(tip, t);
      const spread = 0.13 + Math.sin(t * Math.PI) * 0.24;
      const angle = random() * Math.PI * 2;
      const offset = Math.sqrt(random()) * spread;
      dummy.position.x += Math.sin(angle) * offset;
      dummy.position.z += Math.cos(angle) * offset;
      dummy.position.y += (random() - 0.5) * spread * 0.92;
      dummy.rotation.set((random() - 0.49) * 1.7, angle, (random() - 0.5) * 1.72, "YXZ");
      const size = 0.095 + random() * 0.15;
      dummy.scale.set(size * (0.65 + 0.69 * random()), size, size);
      dummy.updateMatrix();
      foliage.setMatrixAt(leafIndex, dummy.matrix);
      foliage.setColorAt(leafIndex, colors[Math.floor(random() * colors.length)]);
      leafIndex++;
    }
  }
  foliage.instanceMatrix.needsUpdate = true;
  foliage.computeBoundingSphere();
  tree.add(foliage);
  return tree;
}
