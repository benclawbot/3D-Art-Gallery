import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

function makeBarkTexture() {
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  const turn = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    const v = y / size * turn;
    const twist = 0.15 * Math.sin(2 * v) + 0.075 * Math.sin(5 * v);
    for (let x = 0; x < size; x++) {
      const u = x / size * turn + twist;
      const crevice = Math.pow(0.5 + 0.5 * Math.cos(13 * u + 0.72 * Math.sin(3 * v + 5 * u)), 8);
      const grain = Math.sin(31 * u + Math.sin(v * 4 - u * 9));
      const scales = Math.sin(v * 7 + u * 17) * Math.sin(v * 13 - u * 8);
      const fiber = Math.imul(x + 17, 1637133) ^ Math.imul(y + 61, 1013904223);
      const speckle = ((fiber >>> 8) & 255) / 255 - 0.5;
      const value = Math.min(255, Math.round(225 - 84 * crevice + 14 * grain + 13 * scales + 18 * speckle));
      const pixel = (y * size + x) * 4;
      pixels[pixel] = value;
      pixels[pixel + 1] = value;
      pixels[pixel + 2] = value;
      pixels[pixel + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, size, size);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.generateMipmaps = true;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.needsUpdate = true;
  return texture;
}

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
  const barkShades = ["#39291f", "#755c45", "#9a8062", "#614733", "#514536", "#ad9675"].map((color) => new THREE.Color(color));
  const up = new THREE.Vector3(0, 1, 0);
  const perpendicular = new THREE.Vector3();
  const tangent = new THREE.Vector3();
  const orientation = new THREE.Quaternion();

  function bough(points: THREE.Vector3[], radius: number, tipRadius: number, steps: number, sides: number) {
    const path = new THREE.CatmullRomCurve3(points);
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    const ring = sides + 1;
    const length = path.getLength();
    const repeats = Math.max(1, Math.round(radius * 10));
    const flutes = Array.from({ length: sides }, () => 0.70 + random() * 0.54);
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
        const value = 0.70 + 0.43 * random();
        colors.push(shade.r * value, shade.g * value, shade.b * value);
        uvs.push(repeats * side / sides, t * length * 1.7);
        if (step === steps) continue;
        const a = step * ring + side;
        indices.push(a, a + ring, a + 1, a + 1, a + ring, a + ring + 1);
      }
      // Duplicate the seam vertex so its texture coordinates can wrap.
      const start = step * ring * 3;
      positions.push(positions[start], positions[start + 1], positions[start + 2]);
      colors.push(colors[start], colors[start + 1], colors[start + 2]);
      uvs.push(repeats, t * length * 1.7);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const normals = geometry.getAttribute("normal");
    for (let step = 0; step <= steps; step++) {
      const left = step * ring;
      const right = left + sides;
      tangent.set(
        normals.getX(left) + normals.getX(right),
        normals.getY(left) + normals.getY(right),
        normals.getZ(left) + normals.getZ(right),
      ).normalize();
      normals.setXYZ(left, tangent.x, tangent.y, tangent.z);
      normals.setXYZ(right, tangent.x, tangent.y, tangent.z);
    }
    wood.push(geometry);
    return path;
  }

  const vector = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const trunk = bough([
    vector(0, -0.08, 0), vector(0.14, 0.42, 0.06), vector(-0.03, 1.04, 0.03),
    vector(-0.21, 1.60, -0.12), vector(0.08, 2, -0.30),
  ], 0.25, 0.062, 35, 26);
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
  if (bark) {
    const texture = makeBarkTexture();
    tree.add(new THREE.Mesh(bark, new THREE.MeshStandardMaterial({
      map: texture, bumpMap: texture, bumpScale: 0.025, vertexColors: true, roughness: 0.95,
    })));
  }

  const leaf = new THREE.BufferGeometry();
  // A slim, shallowly cupped blade with a raised midrib. Instance scale is its length.
  leaf.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0, -0.091, 0, 0.28, -0.063, 0, 0.67, 0, 0.011, 1,
    0.063, 0, 0.67, 0.091, 0, 0.28, 0, 0.039, 0.51,
  ], 3));
  leaf.setAttribute("color", new THREE.Float32BufferAttribute([
    0.72, 0.76, 0.70, 0.89, 0.92, 0.87, 0.91, 0.95, 0.90, 0.79, 0.85, 0.81,
    0.82, 0.88, 0.82, 0.85, 0.90, 0.85, 1.02, 1.05, 0.99,
  ], 3));
  leaf.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  leaf.computeVertexNormals();
  const colors = ["#566744", "#74855e", "#9aa587", "#65764c", "#435d43", "#b5b59a", "#87917b", "#a9a98a"].map((color) => new THREE.Color(color));
  const leavesPerSpray = 56;
  const foliage = new THREE.InstancedMesh(leaf, new THREE.MeshStandardMaterial({
    roughness: 0.87, side: THREE.DoubleSide, vertexColors: true,
  }), sprays.length * leavesPerSpray);
  const dummy = new THREE.Object3D();
  const bladeAxis = new THREE.Vector3(0, 0, 1);
  const shootDirection = new THREE.Vector3();
  const alignment = new THREE.Quaternion();
  const roll = new THREE.Quaternion();
  const outwardTilt = new THREE.Quaternion();
  const localY = new THREE.Vector3(0, 1, 0);
  let leafIndex = 0;
  for (const { base, tip } of sprays) {
    shootDirection.subVectors(tip, base).normalize();
    alignment.setFromUnitVectors(bladeAxis, shootDirection);
    for (let i = 0; i < leavesPerSpray; i++) {
      const node = Math.floor(i / 2);
      const t = 0.05 + (node + random() * 0.68) / (leavesPerSpray / 2) * 0.93;
      dummy.position.copy(base).lerp(tip, t);
      const side = i % 2 ? 1 : -1;
      const angle = random() * Math.PI * 2;
      const spread = 0.008 + random() * 0.029;
      dummy.position.x += Math.sin(angle) * spread;
      dummy.position.z += Math.cos(angle) * spread;
      dummy.position.y += (random() - 0.45) * spread * 0.9;
      // Leaves grow in alternating ranks along each fine shoot, turning outward from it.
      outwardTilt.setFromAxisAngle(localY, side * (0.48 + random() * 0.52));
      roll.setFromAxisAngle(bladeAxis, (random() - 0.5) * 0.48);
      dummy.quaternion.copy(alignment).multiply(outwardTilt).multiply(roll);
      dummy.rotateX((random() - 0.5) * 0.46);
      dummy.rotateY((random() - 0.5) * 0.38);
      const length = 0.12 + random() * 0.10;
      dummy.scale.set(length * (0.82 + random() * 0.34), length, length);
      dummy.updateMatrix();
      foliage.setMatrixAt(leafIndex, dummy.matrix);
      foliage.setColorAt(leafIndex, colors[Math.floor(random() * colors.length)]);
      leafIndex++;
    }
  }
  foliage.instanceMatrix.needsUpdate = true;
  foliage.computeBoundingBox();
  foliage.computeBoundingSphere();
  tree.add(foliage);
  return tree;
}
