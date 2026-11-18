"use client";

/* eslint @next/next/no-html-link-for-pages: "off" -- Use document navigation for the hosted gallery. */

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ChevronLeft, ChevronRight, Images, Link2, X } from "lucide-react";
import { type Exhibition } from "./lib/exhibition";
import { createGalleryLayout } from "./lib/gallery-layout";
import GalleryWorld from "./world";

type Panel = "index" | "photo" | null;
const movement = [
  { label: "Walk forward", vector: [0, 1], Icon: ArrowUp },
  { label: "Walk left", vector: [-1, 0], Icon: ArrowLeft },
  { label: "Walk back", vector: [0, -1], Icon: ArrowDown },
  { label: "Walk right", vector: [1, 0], Icon: ArrowRight },
];

export default function ExhibitionView({ gallery, onExit }: { gallery: Exhibition; onExit?: () => void }) {
  const [room, setRoom] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState(0);
  const [fallback, setFallback] = useState(false);
  const [copyStatus, setCopyStatus] = useState<"ready" | "copied" | "manual">("ready");
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const backToIndex = useRef(false);
  const heldSince = useRef(0);
  const photos = gallery.photos;
  const artworks = useMemo(() => photos.map((photo, index) => ({ ...photo, index })), [photos]);
  const sample = gallery.id === "demo";
  const minimumRooms = sample ? 3 : 1;
  const layout = useMemo(() => createGalleryLayout(photos.map(({ width, height }) => width / height), minimumRooms), [photos, minimumRooms]);
  const shareable = !onExit;
  const printRoom = room > 0 && room === layout.roomCount - 1;

  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    if (!panel && dialog.current?.open) dialog.current.close();
    if (panel) closeButton.current?.focus();
  }, [panel]);

  function inspect(index: number) {
    backToIndex.current = panel === "index";
    setSelected(index);
    setPanel("photo");
  }
  function dismiss() {
    setPanel(panel === "photo" && backToIndex.current ? "index" : null);
  }
  function next(delta: number) {
    setSelected((index) => (index + delta + photos.length) % photos.length);
  }
  async function copyLink() {
    const url = new URL(`/g/${gallery.id}`, location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("manual");
    }
  }
  function move(vector: number[]) {
    window.dispatchEvent(new CustomEvent("gallery-walk", { detail: vector }));
  }
  function hold(vector: number[]) {
    window.dispatchEvent(new CustomEvent("gallery-hold", { detail: vector }));
  }

  return (
    <main className={printRoom ? "gallery-screen print-room" : "gallery-screen"}>
      <GalleryWorld artworks={artworks} onArtwork={inspect} room={room} onRoom={setRoom} minimumRooms={minimumRooms}
        paused={Boolean(panel)} onFallback={() => { setFallback(true); setPanel("index"); }} />
      <header className="viewer-top">
        <div className="viewer-brand">
          {onExit
            ? <button type="button" className="back-button" onClick={onExit} aria-label="Back to your photographs"><ArrowLeft size={18} /></button>
            : <a href="/" aria-label="Stillroom home" className="wordmark">stillroom<span>.</span></a>}
          <div className="exhibition-header">
            <h1 className="viewer-title">{gallery.title}</h1>
            {sample && <span className="sample-label">Sample exhibition</span>}
            {!shareable && <span className="sample-label">Private preview</span>}
          </div>
        </div>
        <div className="viewer-actions">
          <button type="button" className="viewer-control" onClick={() => setPanel("index")}><Images size={16} /> Photos</button>
          {shareable && <button type="button" className="viewer-control" onClick={copyLink}>
            {copyStatus === "copied" ? <Check size={16} /> : <Link2 size={16} />}
            {copyStatus === "copied" ? "Copied" : "Copy link"}
          </button>}
        </div>
      </header>
      {copyStatus === "manual" && <label className="manual-link">
        <span>Copy this gallery link</span>
        <input readOnly value={new URL(`/g/${gallery.id}`, location.origin).href} onFocus={(event) => event.target.select()} />
        <button type="button" onClick={() => setCopyStatus("ready")} aria-label="Close copy link"><X size={16} /></button>
      </label>}
      {!fallback && <>
        <div className="move-hint"><span>Drag to look</span><span><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrow keys to walk</span></div>
        <div className="touch-hint">Drag to look</div>
        <div className="touch-pad" aria-label="Movement controls">
          {movement.map(({ label, vector, Icon }) => (
            <button type="button" key={label} aria-label={label}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                heldSince.current = performance.now();
                event.currentTarget.setPointerCapture(event.pointerId);
                hold(vector);
              }}
              onLostPointerCapture={() => hold([0, 0])}
              onPointerUp={() => hold([0, 0])}
              onClick={(event) => { if (event.detail === 0 || performance.now() - heldSince.current < 180) move(vector); }}
            ><Icon size={19} /></button>
          ))}
        </div>
        {layout.roomCount > 1 && <nav className="room-nav" aria-label="Gallery rooms">
          {Array.from({ length: layout.roomCount }, (_, i) => <button type="button" key={i}
            className={room === i ? "active" : ""} onClick={() => setRoom(i)} aria-current={room === i ? "location" : undefined}
            aria-label={`Go to room ${i + 1}`}>{i + 1}</button>)}
        </nav>}
      </>}
      <div className="gallery-caption">Room {room + 1} of {layout.roomCount}<i />{photos.length} {photos.length === 1 ? "photograph" : "photographs"}</div>
      <dialog ref={dialog} className={panel === "photo" ? "photo-dialog" : "index-dialog"}
        aria-label={panel === "photo" ? `Photograph ${selected + 1} of ${photos.length}` : "Photographs"}
        onCancel={(event) => { event.preventDefault(); dismiss(); }}
        onKeyDown={(event) => {
          if (panel !== "photo" || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
          event.preventDefault();
          next(event.key === "ArrowLeft" ? -1 : 1);
        }}
      >
        <button ref={closeButton} type="button" className="index-close" onClick={dismiss} aria-label={panel === "photo" ? "Close photograph" : "Close photo index"}><X size={22} /></button>
        {panel === "index" && <>
          <h2>The photographs</h2>
          <p>{fallback ? "3D is unavailable in this browser. Every photograph is available here." : "Select a photograph for a closer look."}</p>
          <div className="index-list">
            {photos.map((photo, index) => <button type="button" key={index} onClick={() => inspect(index)}>
              <img src={photo.url} alt="" width="54" height="45" loading="lazy" />
              <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
              <b>{photo.name || `Photograph ${index + 1}`}</b>
            </button>)}
          </div>
        </>}
        {panel === "photo" && <>
          {photos.length > 1 && <button type="button" className="art-arrow left" aria-label="Previous photograph" onClick={() => next(-1)}><ChevronLeft /></button>}
          <figure className="art-view-inner">
            <img src={photos[selected].url} alt={photos[selected].name || `Photograph ${selected + 1}`} />
            <figcaption>{photos[selected].name || `Photograph ${selected + 1}`} <span>{selected + 1} / {photos.length}</span></figcaption>
          </figure>
          {photos.length > 1 && <button type="button" className="art-arrow right" aria-label="Next photograph" onClick={() => next(1)}><ChevronRight /></button>}
        </>}
      </dialog>
    </main>
  );
}
