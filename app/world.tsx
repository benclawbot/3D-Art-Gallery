"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createScene, type WorldArtwork } from "./lib/gallery-scene";

export type { WorldArtwork };

type Props = {
  artworks: WorldArtwork[];
  onArtwork?: (index: number) => void;
  onRoom?: (room: number) => void;
  room?: number;
  paused?: boolean;
  preview?: boolean;
  onFallback?: () => void;
  minimumRooms?: number;
};

const movementKeys = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);

export default function GalleryWorld({ artworks, onArtwork, onRoom, room = 0, paused = false, preview = false, onFallback, minimumRooms = 1 }: Props) {
  const mount = useRef<HTMLDivElement>(null);
  const controller = useRef<{ jump: (room: number) => void } | null>(null);
  const callbacks = useRef({ paused, onArtwork, onRoom, onFallback });
  useEffect(() => { callbacks.current = { paused, onArtwork, onRoom, onFallback }; }, [paused, onArtwork, onRoom, onFallback]);

  useEffect(() => {
    const host = mount.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    } catch {
      host.classList.add("no-webgl");
      callbacks.current.onFallback?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    const canvas = renderer.domElement;
    host.appendChild(canvas);
    let redraw = true;
    const refresh = () => { redraw = true; };
    const { scene, clickable, occluders, blocked, dispose, loadNearby, roomAt, rooms } = createScene(artworks, renderer, refresh, minimumRooms);
    const camera = new THREE.PerspectiveCamera(63, 1, 0.06, 75);
    const portrait = host.clientWidth < host.clientHeight * 0.72;
    let yaw = 0;
    let pitch = -0.035;
    let currentRoom = 0;
    let animation = 0;
    let lastFrame = 0;
    let drag: { id: number; x: number; y: number; distance: number } | null = null;
    let held: [number, number] = [0, 0];
    const keys = new Set<string>();
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function faceRoom(index: number, angle = 0) {
      const spawn = rooms[index].spawn;
      camera.position.set(spawn.x, preview ? 1.77 : 1.63, spawn.z);
      yaw = spawn.yaw + angle;
      pitch = -0.035;
    }
    faceRoom(0, portrait ? 0 : -0.11);
    loadNearby(0);

    controller.current = {
      jump(nextRoom) {
        if (nextRoom === currentRoom || nextRoom < 0 || nextRoom >= rooms.length) return;
        faceRoom(nextRoom);
        currentRoom = nextRoom;
        loadNearby(currentRoom);
        refresh();
      },
    };

    function walk(strafe: number, forward: number, distance: number) {
      if (callbacks.current.paused || (!strafe && !forward)) return;
      const fraction = distance / Math.max(1, Math.hypot(strafe, forward));
      const dx = (Math.cos(yaw) * strafe - Math.sin(yaw) * forward) * fraction;
      const dz = (-Math.sin(yaw) * strafe - Math.cos(yaw) * forward) * fraction;
      if (!blocked(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
      if (!blocked(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
      refresh();
    }
    function keyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (callbacks.current.paused || event.metaKey || event.ctrlKey || event.altKey || !movementKeys.has(key)) return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      keys.add(key);
    }
    const keyUp = (event: KeyboardEvent) => keys.delete(event.key.toLowerCase());
    const clearKeys = () => {
      keys.clear();
      held = [0, 0];
    };
    const holdTouch = (event: Event) => { held = (event as CustomEvent<[number, number]>).detail; };
    const walkTouch = (event: Event) => {
      const [strafe, forward] = (event as CustomEvent<[number, number]>).detail;
      for (let i = 0; i < 4; i++) walk(strafe, forward, 0.16);
    };
    function startDrag(event: PointerEvent) {
      if (event.button !== 0 || drag || callbacks.current.paused) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, distance: 0 };
      canvas.setPointerCapture(event.pointerId);
    }
    function moveDrag(event: PointerEvent) {
      if (!drag || drag.id !== event.pointerId) return;
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      drag.distance += Math.hypot(dx, dy);
      drag.x = event.clientX;
      drag.y = event.clientY;
      if (drag.distance <= 4) return;
      yaw += dx * 0.004;
      pitch = THREE.MathUtils.clamp(pitch - dy * 0.0035, -0.72, 0.72);
      refresh();
    }
    function endDrag(event: PointerEvent) {
      if (drag?.id !== event.pointerId) return;
      const tapped = drag.distance < 5 && event.type === "pointerup";
      drag = null;
      if (!tapped || callbacks.current.paused) return;
      const rect = canvas.getBoundingClientRect();
      pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, 1 - ((event.clientY - rect.top) / rect.height) * 2);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(clickable)[0];
      if (!hit) return;
      const wall = raycaster.intersectObjects(occluders)[0];
      if (wall && wall.distance < hit.distance) return;
      callbacks.current.onArtwork?.(hit.object.userData.artworkIndex);
    }

    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width < 1 || height < 1) return;
      camera.aspect = width / height;
      camera.fov = camera.aspect < 0.72 ? 76 : 63;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      refresh();
    });
    resize.observe(host);
    const events = new AbortController();
    const track = { signal: events.signal };
    canvas.addEventListener("webglcontextlost", (event) => {
      event.preventDefault();
      cancelAnimationFrame(animation);
      host.classList.add("no-webgl");
      callbacks.current.onFallback?.();
    }, track);
    if (!preview) {
      window.addEventListener("keydown", keyDown, track);
      window.addEventListener("keyup", keyUp, track);
      window.addEventListener("blur", clearKeys, track);
      window.addEventListener("gallery-walk", walkTouch, track);
      window.addEventListener("gallery-hold", holdTouch, track);
      canvas.addEventListener("pointerdown", startDrag, track);
      canvas.addEventListener("pointermove", moveDrag, track);
      canvas.addEventListener("pointerup", endDrag, track);
      canvas.addEventListener("pointercancel", endDrag, track);
    }

    function tick(now: number) {
      const dt = lastFrame ? Math.min(0.045, (now - lastFrame) / 1000) : 0;
      lastFrame = now;
      if (callbacks.current.paused) clearKeys();
      const forward = Number(keys.has("w") || keys.has("arrowup")) - Number(keys.has("s") || keys.has("arrowdown"));
      const strafe = Number(keys.has("d") || keys.has("arrowright")) - Number(keys.has("a") || keys.has("arrowleft"));
      walk(strafe + held[0], forward + held[1], dt * 2.55);
      camera.rotation.set(pitch, yaw, 0, "YXZ");
      const enteredRoom = roomAt(camera.position.x, camera.position.z);
      if (enteredRoom !== undefined && enteredRoom !== currentRoom) {
        currentRoom = enteredRoom;
        loadNearby(enteredRoom);
        callbacks.current.onRoom?.(enteredRoom);
      }
      if (redraw) {
        renderer.render(scene, camera);
        redraw = false;
      }
      animation = requestAnimationFrame(tick);
    }

    animation = requestAnimationFrame(tick);
    return () => {
      controller.current = null;
      cancelAnimationFrame(animation);
      events.abort();
      resize.disconnect();
      dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    };
  }, [artworks, preview, minimumRooms]);

  useEffect(() => { controller.current?.jump(room); }, [room]);
  return <div className={preview ? "world world-preview" : "world"} ref={mount}
    role="img" aria-label={preview ? "Preview of the gallery interior" : "First-person gallery interior"} />;
}
