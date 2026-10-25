import test from "node:test";
import assert from "node:assert/strict";
import { createLocalMusic } from "../demo/music.js";

const song = { id: "one", name: "One", previewUrl: "/one.mp3" };

test("demo handles files through the instance method, including rollback and URL cleanup", async () => {
  const originalAudio = globalThis.Audio;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let created = 0;
  const revoked = [];
  globalThis.Audio = class {
    duration = 12;
    set src(value) { queueMicrotask(() => value.includes("bad") ? this.onerror?.() : this.onloadedmetadata?.()); }
    removeAttribute() {}
    load() {}
  };
  URL.createObjectURL = file => `blob:${file.name}-${++created}`;
  URL.revokeObjectURL = url => revoked.push(url);
  try {
    let library = { songs: [song], playlists: [], artists: [] };
    let fail = false;
    const player = { async setLibrary(next) { if (fail) throw new Error("Commit failed"); library = next; } };
    const host = { isConnected: true };
    const music = createLocalMusic(host, player, library);
    const file = { name: "music.mp3", type: "audio/mpeg", size: 10, lastModified: 1 };
    const [first, second] = await Promise.all([music.add([file]), music.add([file])]);
    assert.equal(first.added.length, 1);
    assert.equal(second.skipped, 1);
    assert.equal(created, 1);
    assert.equal(library.songs.length, 2);
    assert.equal(library.playlists[0].name, "Your Uploads");
    assert.deepEqual(library.playlists[0].songIds, [first.added[0].id]);
    const rejected = await music.add([{ ...file, name: "bad.mp3" }, { ...file, name: "readme.txt", type: "text/plain" }]);
    assert.equal(rejected.rejected.length, 2);
    assert.equal(revoked.length, 1);
    const another = { ...file, name: "another.mp3" };
    fail = true;
    await assert.rejects(music.add([another]), /Commit failed/);
    assert.equal(library.songs.length, 2);
    assert.equal(revoked.length, 2);
    fail = false;
    assert.equal((await music.add([another])).added.length, 1);
    assert.equal(library.songs.length, 3);
    music.release();
    music.release();
    assert.equal(revoked.length, 4);
    const canceled = music.add([{ ...file, name: "cancel.mp3" }]);
    music.release();
    await assert.rejects(canceled, /disconnected/);
    assert.equal(revoked.length, 5);
    assert.equal(library.songs.length, 3);
  } finally {
    if (originalAudio === undefined) delete globalThis.Audio; else globalThis.Audio = originalAudio;
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
  }
});
