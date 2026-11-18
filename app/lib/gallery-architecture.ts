import * as THREE from "three";

/** A stone opening with eased top corners and a full-height reveal. */
export function portalGeometry(radius: number, span: number, center: number, depth: number) {
  const head = 2.88;
  const wallHeight = 3.44;
  const corner = 0.19;
  const left = center - radius;
  const right = center + radius;
  const shape = new THREE.Shape();
  shape.moveTo(-span / 2, 0);
  shape.lineTo(left, 0);
  shape.lineTo(left, head - corner);
  shape.quadraticCurveTo(left, head, left + corner, head);
  shape.lineTo(right - corner, head);
  shape.quadraticCurveTo(right, head, right, head - corner);
  shape.lineTo(right, 0);
  shape.lineTo(span / 2, 0);
  shape.lineTo(span / 2, wallHeight);
  shape.lineTo(-span / 2, wallHeight);
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
