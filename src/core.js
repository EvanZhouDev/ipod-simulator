const imports = new Map();
let registering;

function browser() {
  if (typeof window === "undefined" || typeof customElements === "undefined") throw new Error("Mount the iPod in a browser, after rendering.");
}

export async function defineIPod({ componentUrl } = {}) {
  browser();
  if (!customElements.get("web-music-ipod")) {
    if (!registering && !imports.has(componentUrl)) {
      const loading = (componentUrl
        ? import(/* webpackIgnore: true */ /* @vite-ignore */ componentUrl)
        : import("./includes/ipod/web-music-ipod.esm.js")).catch(error => {
        imports.delete(componentUrl);
        throw error;
      });
      imports.set(componentUrl, loading);
      registering = loading.finally(() => { registering = undefined; });
    }
    await (registering ?? imports.get(componentUrl));
  }
  if (!customElements.get("ipod-simulator")) {
    const Original = customElements.get("web-music-ipod");
    if (!Original) throw new Error("The component module did not register web-music-ipod.");
    class IPodElement extends Original {
      constructor() {
        super();
        for (const key of ["songs", "playlists", "artists", "library"]) {
          if (Object.hasOwn(this, key)) {
            const value = this[key];
            delete this[key];
            this[key] = value;
          }
        }
      }
      connectedCallback() { super.connectedCallback(); this.syncLibrary(); }
      get songs() { return this._library?.songs; }
      set songs(value) { this._library = { ...this._library, songs: value }; this.syncLibrary(); }
      get playlists() { return this._library?.playlists; }
      set playlists(value) { this._library = { ...this._library, playlists: value }; this.syncLibrary(); }
      get artists() { return this._library?.artists; }
      set artists(value) { this._library = { ...this._library, artists: value }; this.syncLibrary(); }
      get library() { return this._library; }
      set library(value) { this._library = value; this.syncLibrary(); }
      syncLibrary() {
        if (!this.isConnected || !this._library?.songs || this._scheduled) return;
        this._scheduled = true;
        queueMicrotask(async () => {
          this._scheduled = false;
          if (!this.isConnected) return;
          try { await setLibrary(this, this._library); }
          catch (error) { this.dispatchEvent(new CustomEvent("ipod-error", { detail: error })); }
        });
      }
    }
    customElements.define("ipod-simulator", IPodElement);
  }
}

async function whenReady(element, { timeout = 20000 } = {}) {
  browser();
  if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError("timeout must be a positive number.");
  if (!element?.isConnected) throw new Error("Connect the iPod to the document before loading its library.");
  await defineIPod();
  const deadline = performance.now() + timeout;
  while (!element.iPodDataStore) {
    if (!element.isConnected) throw new Error("The iPod was disconnected.");
    if (performance.now() >= deadline) throw new Error("The iPod could not start.");
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  const store = element.iPodDataStore;
  return new Promise((resolve, reject) => {
    let unsubscribe = () => {};
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(disconnected);
      queueMicrotask(() => unsubscribe());
      if (error) reject(error); else resolve(store);
    };
    const timer = setTimeout(() => {
      finish(new Error("The catalog could not load. Check that the package’s catalog assets are reachable."));
    }, Math.max(1, deadline - performance.now()));
    const disconnected = setInterval(() => {
      if (!element.isConnected) finish(new Error("The iPod was disconnected."));
    }, 20);
    unsubscribe = store.subscribe(state => {
      if (state.status !== "ready" && state.status !== "error") return;
      // A supplied library can replace a failed default catalog too.
      finish();
    });
  });
}

function normalizeLibrary({ songs, playlists, artists } = {}) {
  if (!Array.isArray(songs)) throw new TypeError("songs must be an array.");
  const ids = new Set();
  const normalized = songs.map(song => {
    if (!song || typeof song.id !== "string" || !song.id || ids.has(song.id)) throw new TypeError("Song IDs must be unique, nonempty strings.");
    if (typeof song.name !== "string" || !song.name || typeof song.previewUrl !== "string" || !song.previewUrl) throw new TypeError("Each song needs a name and previewUrl.");
    ids.add(song.id);
    const result = { ...song, artistName: song.artistName ?? "Unknown Artist", albumName: song.albumName ?? "", artistIds: [...(song.artistIds ?? [])] };
    if (typeof result.artistName !== "string" || typeof result.albumName !== "string" || !Array.isArray(song.artistIds ?? []) || !result.artistIds.every(id => typeof id === "string")) throw new TypeError("Invalid song artist or album metadata.");
    if (song.durationInMillis !== undefined && (!Number.isFinite(song.durationInMillis) || song.durationInMillis < 0)) throw new TypeError("Song duration must be a nonnegative number.");
    return result;
  });
  const groups = (entries, label) => {
    if (!Array.isArray(entries)) throw new TypeError(`${label} must be an array.`);
    const groupIds = new Set();
    return entries.map(entry => {
      if (!entry || typeof entry.id !== "string" || !entry.id || groupIds.has(entry.id) || typeof entry.name !== "string" || !entry.name || !Array.isArray(entry.songIds)) throw new TypeError(`Invalid ${label} entry.`);
      if (!entry.songIds.every(id => ids.has(id))) throw new TypeError(`${label} references an unknown song.`);
      groupIds.add(entry.id);
      return { ...entry, songIds: [...entry.songIds] };
    });
  };
  if (!artists) {
    const grouped = new Map();
    for (const song of normalized) {
      const name = song.artistName;
      if (!grouped.has(name)) grouped.set(name, { id: `artist-${grouped.size}`, name, songIds: [] });
      grouped.get(name).songIds.push(song.id);
    }
    artists = [...grouped.values()];
  }
  return { songs: normalized, playlists: groups(playlists ?? [], "playlists"), artists: groups(artists, "artists") };
}

async function setLibrary(element, library) {
  const data = normalizeLibrary(library);
  const store = await whenReady(element);
  if (!element.isConnected) throw new Error("The iPod was disconnected.");
  store.set({ status: "ready", language: "en-US", data });
}

/** Register, wait for startup, and return a controller bound to this element. */
export async function createIPod(element, { songs, playlists, artists, componentUrl, timeout = 20000 } = {}) {
  browser();
  if (element?.localName !== "ipod-simulator") throw new TypeError("Pass an <ipod-simulator> element to createIPod().");
  if (!element.isConnected) throw new Error("Connect the iPod to the document before creating its controller.");
  if (!Number.isFinite(timeout) || timeout <= 0) throw new TypeError("timeout must be a positive number.");
  if (songs === undefined && (playlists !== undefined || artists !== undefined)) throw new TypeError("Supply songs together with playlists or artists.");
  const data = songs === undefined ? undefined : normalizeLibrary({ songs, playlists, artists });
  await defineIPod({ componentUrl });
  const store = await whenReady(element, { timeout });
  if (!element.isConnected) throw new Error("The iPod was disconnected.");
  if (data) store.set({ status: "ready", language: "en-US", data });
  else {
    let state;
    store.subscribe(value => { state = value; })();
    if (state.status === "error") throw new Error("The catalog could not load. Check that the package’s catalog assets are reachable.", { cause: state.error });
  }
  return Object.freeze({
    async setLibrary(library) { await setLibrary(element, library); },
  });
}
