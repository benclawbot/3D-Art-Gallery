import demo from "./sample.json";

export type Artwork = { url: string; name: string; width: number; height: number };
export type Exhibition = { id: string; title: string; photos: Artwork[] };

export const sampleExhibition: Exhibition = demo;
export const defaultTitle = "Untitled exhibition";
export const demoArtworks = demo.photos.map((photo, index) => ({ ...photo, index }));
