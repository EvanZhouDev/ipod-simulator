// File selection, metadata, and object URLs belong to this demo, not the package.
function inspectAudio(url) {
  return new Promise((resolve, reject) => {
    const audio = new Audio();
    const timer = setTimeout(() => finish(new Error("Timed out reading audio metadata.")), 10000);
    let finished = false;
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      const duration = audio.duration;
      audio.onloadedmetadata = audio.onerror = null;
      audio.removeAttribute("src");
      audio.load();
      if (error || !Number.isFinite(duration) || duration <= 0) reject(error || new Error("Unsupported audio file."));
      else resolve(duration);
    }
    audio.preload = "metadata";
    audio.onloadedmetadata = () => finish();
    audio.onerror = () => finish(new Error("This browser cannot play the file."));
    audio.src = url;
  });
}

export function createLocalMusic(element, player, initialLibrary) {
  let library = initialLibrary;
  let tail = Promise.resolve();
  let generation = 0;
  const fingerprints = new Map();
  const urls = new Set();

  function add(files) {
    const selected = Array.from(files);
    const started = generation;
    const result = tail.then(async () => {
      const added = [], rejected = [], pending = [];
      let skipped = 0;
      try {
        const batch = new Set();
        for (const file of selected) {
          const key = JSON.stringify([file.name, file.size, file.lastModified]);
          if (fingerprints.has(key) || batch.has(key)) { skipped++; continue; }
          batch.add(key);
          if (!file.type?.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|flac|ogg|opus|aiff?)$/i.test(file.name)) {
            rejected.push({ name: file.name, reason: "Not an audio file." });
            continue;
          }
          const url = URL.createObjectURL(file);
          pending.push({ key, url });
          try {
            const duration = await inspectAudio(url);
            added.push({ id: `upload-${crypto.randomUUID()}`, name: file.name.replace(/\.[^.]+$/, "") || file.name, artistName: "Your Music", artistIds: ["uploads-artist"], albumName: "Your Uploads", previewUrl: url, durationInMillis: Math.round(duration * 1000) });
          } catch (error) {
            URL.revokeObjectURL(url);
            pending.pop();
            rejected.push({ name: file.name, reason: error.message });
          }
        }
        if (!element.isConnected || started !== generation) throw new Error("The iPod was disconnected.");
        if (added.length) {
          const old = library.playlists.find(playlist => playlist.id === "uploads-playlist");
          const songIds = [...(old?.songIds ?? []), ...added.map(song => song.id)];
          const next = {
            songs: [...library.songs, ...added],
            playlists: [{ id: "uploads-playlist", name: "Your Uploads", songIds }, ...library.playlists.filter(playlist => playlist.id !== "uploads-playlist")],
            artists: [{ id: "uploads-artist", name: "Your Music", songIds }, ...library.artists.filter(artist => artist.id !== "uploads-artist")],
          };
          await player.setLibrary(next);
          library = next;
          for (const item of pending) { urls.add(item.url); fingerprints.set(item.key, item); }
          pending.length = 0;
        }
        return { added, skipped, rejected };
      } finally { for (const item of pending) URL.revokeObjectURL(item.url); }
    });
    tail = result.catch(() => {});
    return result;
  }

  function release() {
    generation++;
    for (const url of urls) URL.revokeObjectURL(url);
    urls.clear();
    fingerprints.clear();
  }

  return { add, release };
}
