export interface Song {
  id: string;
  name: string;
  previewUrl: string;
  artistName?: string;
  artistIds?: string[];
  albumName?: string;
  durationInMillis?: number;
  url?: string;
  playParams?: { id: string; kind: string };
}
export interface Playlist { id: string; name: string; songIds: string[] }
export interface Artist { id: string; name: string; songIds: string[] }
export interface Library { songs: Song[]; playlists?: Playlist[]; artists?: Artist[] }
export interface IPodElement extends HTMLElement {
  songs: Song[] | undefined;
  playlists: Playlist[] | undefined;
  artists: Artist[] | undefined;
  library: Library | undefined;
  locale: { storefront: string; language: string };
  backlit: boolean | undefined;
}
export interface IPodOptions {
  songs?: Song[];
  playlists?: Playlist[];
  artists?: Artist[];
  componentUrl?: string;
  /** Maximum wait for the initial catalog, in milliseconds. Defaults to 20000. */
  timeout?: number;
}
export interface IPodInstance {
  /** Validate and replace the library. Rejects if data is invalid or the element is disconnected. */
  setLibrary(library: Library): Promise<void>;
}
/** Registers the component, waits for initialization, and optionally supplies an initial library. */
export function createIPod(element: HTMLElement, options?: IPodOptions): Promise<IPodInstance>;
declare global { interface HTMLElementTagNameMap { "ipod-simulator": IPodElement } }

/** Built-in US English catalog. Supplied songs replace the catalog; spread these to retain it. */
export const defaultSongs: Song[];
export const defaultPlaylists: Playlist[];
export const defaultArtists: Artist[];
