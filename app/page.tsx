"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, LoaderCircle, X } from "lucide-react";
import Link from "next/link";
import ExhibitionView from "./exhibition";
import GalleryWorld from "./world";
import { defaultTitle, demoArtworks, type Artwork } from "./lib/exhibition";

const maxPhotos = 50;
type DraftPhoto = { file: File; name: string; width: number; height: number; key: string };
type Photo = DraftPhoto & Artwork;
type Draft = { photos: DraftPhoto[]; title: string };
type Attempt = { id: string; photos: Photo[]; title: string; uploaded: Set<number> };

export default function Home() {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [title, setTitle] = useState("");
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const attempt = useRef<Attempt | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/session", { cache: "no-store" })
      .then((response) => response.json<{ signedIn: boolean }>())
      .then((data) => { if (active) setSignedIn(Boolean(data.signedIn)); })
      .catch(() => {});
    draftTransaction<Draft | undefined>("readonly", (store) => store.get("current"))
      .then((draft) => {
        if (!active || !Array.isArray(draft?.photos)) return;
        setPhotos(draft.photos.slice(0, maxPhotos).map((photo) => ({ ...photo, url: URL.createObjectURL(photo.file) })));
        setTitle(draft.title);
      })
      .catch(() => {})
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  async function saveDraft(next: Photo[], nextTitle: string) {
    const saved: Draft = {
      photos: next.map(({ file, name, width, height, key }) => ({ file, name, width, height, key })),
      title: nextTitle,
    };
    await draftTransaction("readwrite", (store) => store.put(saved, "current"));
  }

  function updatePhotos(next: Photo[]) {
    setPhotos(next);
    void saveDraft(next, title).catch(() => {});
  }

  async function choosePhotos(files: FileList | null) {
    if (!files || busy || preparing || !ready) return;
    const available = maxPhotos - photos.length;
    if (!available) return setError("This exhibition already has 50 photographs.");
    const incoming = Array.from(files);
    if (!incoming.length) return;
    setError("");
    setPreparing(true);
    let skipped = Math.max(0, incoming.length - available);
    const accepted: Photo[] = [];
    for (const [i, file] of incoming.slice(0, available).entries()) {
      setProgress(`Preparing photograph ${i + 1} of ${Math.min(available, incoming.length)}`);
      try {
        if (!file.type.startsWith("image/") || file.type === "image/svg+xml") throw new Error("Unsupported photograph");
        const photo = await prepare(file);
        accepted.push({ ...photo, url: URL.createObjectURL(photo.file) });
      } catch {
        skipped++;
      }
    }
    updatePhotos([...photos, ...accepted]);
    if (skipped) setError(`${skipped} ${skipped === 1 ? "file was" : "files were"} skipped. Choose readable JPG, PNG, WebP or AVIF images, up to 50 total.`);
    setPreparing(false);
    setProgress("");
    if (picker.current) picker.current.value = "";
  }

  function movePhoto(index: number, shift: number) {
    const next = [...photos];
    const target = index + shift;
    if (target < 0 || target >= photos.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updatePhotos(next);
  }
  function removePhoto(index: number) {
    URL.revokeObjectURL(photos[index].url);
    updatePhotos(photos.filter((_, i) => i !== index));
  }

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      await saveDraft(photos, title);
      window.location.assign("/signin-with-chatgpt?return_to=%2F");
    } catch {
      setError("This browser couldn't save your draft for sign-in. Sign in first, then select your photographs again.");
      setBusy(false);
    }
  }

  async function publish() {
    if (!photos.length || busy || preparing) return;
    setBusy(true);
    setError("");
    try {
      if (!attempt.current || attempt.current.photos !== photos || attempt.current.title !== title) {
        attempt.current = { id: crypto.randomUUID().replaceAll("-", ""), photos, title, uploaded: new Set() };
      }
      const { id, uploaded } = attempt.current;
      for (const [i, { file }] of photos.entries()) {
        if (uploaded.has(i)) continue;
        setProgress(`Uploading ${i + 1} of ${photos.length}`);
        const response = await fetch(`/api/gallery/${id}/photo/${i}`, {
          method: "PUT",
          headers: { "content-type": file.type },
          body: file,
        });
        if (!response.ok) throw new Error(await responseError(response, `Photograph ${i + 1} could not be uploaded.`));
        uploaded.add(i);
      }
      setProgress("Publishing your gallery");
      const response = await fetch(`/api/gallery/${id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || defaultTitle,
          photos: photos.map(({ name, width, height }) => ({ name, width, height })),
        }),
      });
      if (!response.ok) throw new Error(await responseError(response, "Publishing is temporarily unavailable."));
      await draftTransaction("readwrite", (store) => store.delete("current")).catch(() => {});
      window.location.assign(`/g/${id}`);
    } catch (cause) {
      setError(cause instanceof Error ? `${cause.message} You can try publishing again.` : "Publishing failed. Try again.");
      setBusy(false);
      setProgress("");
    }
  }

  if (preview) {
    return <ExhibitionView onExit={() => setPreview(false)} gallery={{ id: "draft", title: title.trim() || defaultTitle, photos }} />;
  }
  const working = busy || preparing;
  return (
    <main className="create-screen">
      <header className="topbar">
        <Link href="/" className="wordmark">stillroom<span>.</span></Link>
        <Link className="text-button" href="/g/demo">Visit the sample <ArrowRight size={16} /></Link>
      </header>
      <section className="intro">
        <div className="intro-copy">
          <h1>Give your photos <em>room to breathe.</em></h1>
          <p className="intro-text">Turn up to 50 photographs into a gallery you can walk through. Invite anyone with a link.</p>
          <a className="entry-link" href="#create">Create an exhibition <ArrowRight size={17} /></a>
        </div>
        <figure className="gallery-preview">
          <div className="preview-stage"><GalleryWorld artworks={demoArtworks} preview minimumRooms={3} /></div>
          <figcaption><span>The Shape of Quiet</span><Link href="/g/demo">Enter sample exhibition <ArrowRight size={15} /></Link></figcaption>
        </figure>
      </section>
      <section className="create-area" id="create">
        <div className="create-heading">
          <h2>Choose your photographs</h2>
          <span>{photos.length} / {maxPhotos}</span>
        </div>
        <div className={`dropzone${dragging ? " dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); if (!working) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); void choosePhotos(event.dataTransfer.files); }}>
          <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/avif"
            multiple tabIndex={-1} disabled={!ready || working || photos.length >= maxPhotos}
            onChange={(event) => void choosePhotos(event.target.files)} aria-label="Choose photographs" />
          <ImagePlus size={24} strokeWidth={1.4} />
          <div><strong>{preparing ? progress : "Drop your photographs here"}</strong>
            <span>or <button type="button" disabled={!ready || working || photos.length >= maxPhotos}
              onClick={() => picker.current?.click()}>choose files</button> from your device</span></div>
          <small>JPG, PNG, WebP, AVIF</small>
        </div>

        {photos.length > 0 && <div className="draft-tools">
          <label className="title-field"><span>Exhibition title</span>
            <input value={title} placeholder={defaultTitle} maxLength={80} disabled={working}
              onChange={(event) => {
                setTitle(event.target.value);
                void saveDraft(photos, event.target.value).catch(() => {});
              }} /></label>
          <p className="order-hint">Photographs hang in the order shown.</p>
          <div className="photo-grid">
            {photos.map((photo, i) => (
              <article className="photo-item" key={photo.key}>
                <img src={photo.url} alt={photo.name || `Selected photograph ${i + 1}`} loading="lazy" />
                <span className="photo-number">{i + 1}</span>
                <div className="photo-actions">
                  <button type="button" onClick={() => movePhoto(i, -1)} disabled={!i || working} aria-label={`Move photograph ${i + 1} earlier`}><ArrowLeft size={15} /></button>
                  <button type="button" onClick={() => movePhoto(i, 1)} disabled={i === photos.length - 1 || working} aria-label={`Move photograph ${i + 1} later`}><ArrowRight size={15} /></button>
                  <button type="button" onClick={() => removePhoto(i)} disabled={working} aria-label={`Remove photograph ${i + 1}`}><X size={15} /></button>
                </div>
              </article>
            ))}
          </div>
          <div className="publish-row">
            <button className="secondary-button" type="button" disabled={working} onClick={() => setPreview(true)}>Preview in 3D</button>
            <button className="primary-button" type="button" disabled={working} onClick={() => void (signedIn ? publish() : signIn())}>
              {busy ? <><LoaderCircle className="spin" size={16} />{progress || "Saving your draft"}</>
                : <>{signedIn ? "Publish gallery" : "Sign in to publish"} <ArrowRight size={16} /></>}
            </button>
          </div>
        </div>}
        {error && <p className="error-line" role="alert">{error} {!signedIn && error.startsWith("This browser couldn't save") &&
          <a href="/signin-with-chatgpt?return_to=%2F">Sign in now</a>}</p>}
        <div className="privacy-note"><Link2 size={16} /><p>Anyone with the exhibition link can visit without an account.</p></div>
      </section>
    </main>
  );
}

async function responseError(response: Response, fallback: string) {
  const result = await response.json<{ error?: string }>().catch(() => null);
  return result?.error || fallback;
}

async function prepare(file: File): Promise<DraftPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.width = width;
  canvas.height = height;
  try {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Photograph decoding failed");
    context.fillStyle = "#f6f1e8";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
  } finally {
    bitmap.close();
  }
  let blob = await exportImage(canvas, "image/webp", 0.88);
  if (blob.type !== "image/webp") blob = await exportImage(canvas, "image/jpeg", 0.88);
  const name = file.name.replace(/\.[^.]+$/, "").slice(0, 100);
  return { file: new File([blob], file.name, { type: blob.type }), name, width, height, key: crypto.randomUUID() };
}

function exportImage(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Image conversion failed")), format, quality));
}

function draftTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("stillroom-photographs", 1);
    open.onupgradeneeded = () => open.result.createObjectStore("draft");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction("draft", mode);
      const request = operation(transaction.objectStore("draft"));
      transaction.oncomplete = () => { db.close(); resolve(request.result); };
      transaction.onabort = () => { db.close(); reject(transaction.error || request.error); };
    };
  });
}
