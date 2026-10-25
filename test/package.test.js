import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import * as api from "../dist/index.js";
const { createIPod, defaultSongs, defaultPlaylists, defaultArtists } = api;
const root = fileURLToPath(new URL("../", import.meta.url));
const song = { id: "one", name: "One", previewUrl: "/one.mp3" };

function writable(initial) {
  let state = initial;
  const listeners = new Set();
  return {
    subscribe(callback) { listeners.add(callback); callback(state); return () => listeners.delete(callback); },
    set(next) { state = next; for (const callback of listeners) callback(state); },
    get state() { return state; },
    get subscribers() { return listeners.size; },
  };
}
function element(store) { return { localName: "ipod-simulator", isConnected: true, iPodDataStore: store }; }
async function browser(run) {
  const previousWindow = globalThis.window;
  const previousRegistry = globalThis.customElements;
  globalThis.window = {};
  globalThis.customElements = { get: () => class {} };
  try { await run(); }
  finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousRegistry === undefined) delete globalThis.customElements; else globalThis.customElements = previousRegistry;
  }
}

test("root exposes only the factory and defaults and imports safely on the server", async () => {
  assert.deepEqual(Object.keys(api).sort(), ["createIPod", "defaultArtists", "defaultPlaylists", "defaultSongs"]);
  await import("../dist/element/index.js");
  await assert.rejects(createIPod(null), /browser/);
});

test("catalog exports match bundled JSON and can be combined with custom songs", async () => {
  const catalog = JSON.parse(await readFile(join(root, "src/includes/ipod/data/us/en-US.json"), "utf8"));
  assert.deepEqual(defaultSongs, catalog.songs);
  assert.deepEqual(defaultPlaylists, catalog.playlists);
  assert.deepEqual(defaultArtists, catalog.artists);
  await browser(async () => {
    const store = writable({ status: "ready" });
    await createIPod(element(store), { songs: [...defaultSongs, song], playlists: defaultPlaylists });
    assert.equal(store.state.data.songs.length, defaultSongs.length + 1);
    assert.equal(store.state.data.songs.at(-1).id, song.id);
    assert.equal(defaultSongs.length, catalog.songs.length);
  });
});

test("root import has no browser registration side effects; element import registers", () => {
  execFileSync(process.execPath, ["--input-type=module", "-e", `
    import assert from "node:assert/strict";
    let reads = 0;
    const definitions = new Map([["web-music-ipod", class {}]]);
    globalThis.window = {};
    globalThis.customElements = {
      get(name) { reads++; return definitions.get(name); },
      define(name, value) { definitions.set(name, value); },
    };
    await import(${JSON.stringify(new URL("../dist/index.js", import.meta.url).href)});
    assert.equal(reads, 0);
    await import(${JSON.stringify(new URL("../dist/element/index.js", import.meta.url).href)});
    assert.equal(definitions.has("ipod-simulator"), true);
  `]);
});

test("factory waits for startup, normalizes internally, and binds updates to its element", async () => {
  await browser(async () => {
    const store = writable({ status: "loading" });
    const input = [{ ...song, artistIds: ["a"] }];
    let settled = false;
    const pending = createIPod(element(store), { songs: input }).then(value => { settled = true; return value; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    store.set({ status: "ready", data: { songs: [] } });
    const player = await pending;
    assert.deepEqual(Object.keys(player), ["setLibrary"]);
    assert.equal(store.subscribers, 0);
    assert.deepEqual(store.state.data.playlists, []);
    assert.equal(store.state.data.songs[0].id, song.id);
    assert.equal(store.state.data.artists[0].name, "Unknown Artist");
    store.state.data.songs[0].artistIds.push("b");
    assert.deepEqual(input[0].artistIds, ["a"]);
    assert.equal(input[0].albumName, undefined);
    const { setLibrary } = player;
    const playlists = [{ id: "favorites", name: "Favorites", songIds: [song.id] }];
    await setLibrary({ songs: [song], playlists });
    assert.deepEqual(store.state.data.playlists, playlists);
    await setLibrary({ songs: [song] });
    assert.deepEqual(store.state.data.playlists, []);
    assert.equal(store.state.data.songs[0].id, song.id);
    await setLibrary({ songs: [] });
    assert.deepEqual(store.state.data.songs, []);
    const other = writable({ status: "ready" });
    await createIPod(element(other), { songs: [song] });
    assert.deepEqual(store.state.data.songs, []);
    assert.equal(other.state.data.songs.length, 1);
  });
});

test("invalid libraries reject without replacing the current library", async () => {
  await browser(async () => {
    const store = writable({ status: "ready" });
    const player = await createIPod(element(store), { songs: [song] });
    const current = store.state;
    for (const library of [
      {}, { songs: [song, song] }, { songs: [{ ...song, id: "" }] },
      { songs: [{ ...song, artistName: 4 }] },
      { songs: [{ ...song, durationInMillis: NaN }] },
      { songs: [song], playlists: [{ id: "p", name: "Playlist", songIds: ["missing"] }] },
    ]) {
      await assert.rejects(player.setLibrary(library), TypeError);
      assert.equal(store.state, current);
    }
    await assert.rejects(createIPod(element(store), { songs: [song, song] }), TypeError);
    await assert.rejects(createIPod(element(store), { playlists: [] }), /Supply songs/);
    assert.equal(store.state, current);
  });
});

test("factory rejects startup failures, accepts a replacement catalog, and cleans up waiters", async () => {
  await browser(async () => {
    const store = writable({ status: "error", error: new Error("missing catalog") });
    const host = element(store);
    await assert.rejects(createIPod(host), /catalog could not load/);
    const player = await createIPod(host, { songs: [song] });
    assert.equal(store.state.status, "ready");
    host.isConnected = false;
    await assert.rejects(player.setLibrary({ songs: [] }), /Connect the iPod/);
    await assert.rejects(createIPod(host), /Connect the iPod/);
    await assert.rejects(createIPod({ ...host, localName: "div" }), TypeError);
    host.isConnected = true;
    store.set({ status: "loading" });
    const waiting = createIPod(host, { timeout: 1000 });
    setTimeout(() => { host.isConnected = false; }, 10);
    await assert.rejects(waiting, /disconnected/);
    assert.equal(store.subscribers, 0);
    host.isConnected = true;
    await assert.rejects(createIPod(host, { timeout: 5 }), /catalog could not load/);
    await assert.rejects(createIPod(host, { timeout: 0 }), TypeError);
    assert.equal(store.subscribers, 0);
  });
});

test("concurrent factories register once and HTML properties still synchronize", async () => {
  const previousWindow = globalThis.window;
  const previousRegistry = globalThis.customElements;
  const previousOriginal = globalThis.IPodTestOriginal;
  const registrations = new Map();
  const store = writable({ status: "ready", data: { songs: [], playlists: [], artists: [] } });
  globalThis.window = {};
  globalThis.IPodTestOriginal = class {
    localName = "ipod-simulator";
    isConnected = false;
    iPodDataStore = store;
    connectedCallback() {}
    disconnectedCallback() {}
    dispatchEvent() {}
  };
  globalThis.customElements = {
    get(name) { return registrations.get(name); },
    define(name, ctor) { assert.ok(!registrations.has(name)); registrations.set(name, ctor); },
  };
  const componentUrl = "data:text/javascript," + encodeURIComponent('customElements.define("web-music-ipod", globalThis.IPodTestOriginal)');
  try {
    await Promise.all([createIPod(element(store), { componentUrl }), createIPod(element(store), { componentUrl })]);
    assert.equal(registrations.size, 2);
    const host = new (registrations.get("ipod-simulator"))();
    host.library = { songs: [song] };
    host.isConnected = true;
    host.connectedCallback();
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.equal(store.state.data.songs[0].id, "one");
  } finally {
    if (previousWindow === undefined) delete globalThis.window; else globalThis.window = previousWindow;
    if (previousRegistry === undefined) delete globalThis.customElements; else globalThis.customElements = previousRegistry;
    if (previousOriginal === undefined) delete globalThis.IPodTestOriginal; else globalThis.IPodTestOriginal = previousOriginal;
  }
});

test("Apple component differs only in package-relative catalog URLs", async () => {
  const patched = await readFile(join(root, "src/includes/ipod/web-music-ipod.esm.js"), "utf8");
  const source = patched.replace(
    '  return e === "us" && t === "en-US"\n    ? new URL("./data/us/en-US.json", import.meta.url)\n    : new URL(`./data/${e}/${t}.json`, vr);',
    '  return new URL(`/includes/ipod/data/${e}/${t}.json`, vr);',
  );
  assert.equal(createHash("sha256").update(source).digest("hex"), "0cf574f5e562ffa9b8ab147e83e3f5c26532694bf6ef5f81d7a8e0a02c0f436e");
});
