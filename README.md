# ipod-simulator

![](/assets/ipod-og.png)

- 🍎 React and HTML component for Apple's official iPod Simulator
- 💿 Preset catalog of songs 1000+ songs
- 🎼 Add your own audio and create your own playlists

## Get Started

### HTML

Add the element and a module script to your page:

```html
<ipod-simulator></ipod-simulator>

<script
  type="module"
  src="https://cdn.jsdelivr.net/npm/ipod-simulator@latest/dist/element/index.js"
></script>
```

### React

```bash
npm install ipod-simulator
```

Make sure to include `"use client"` for Next.js.

```tsx
import { IPod } from "ipod-simulator/react";

export default function App() {
  return <IPod />;
}
```

## Documentation

You can even customize the songs on your iPod Simulator. Here's a quick guide as to how.

`Song`, `Playlist`, and `Library` types are exported from `ipod-simulator`.

```ts
interface Song {
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

interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}
```

`previewUrl` can point to a full audio file. For a local `File`, use `URL.createObjectURL(file)` and revoke the URL when it is no longer used for playback. Remote audio must allow cross-origin access.

For the default songs, you can use the `defaultSongs` and `defaultPlaylists` imports from `ipod-simulator`. By default, editing songs and playlists removes all default songs.

### React

```tsx
import { IPod } from "ipod-simulator/react";
import { defaultSongs, defaultPlaylists, type Library } from "ipod-simulator";

const library: Library = {
  songs: [
    ...defaultSongs,
    {
      id: "my-song",
      name: "My song",
      artistName: "My artist",
      previewUrl: "/music/my-song.mp3",
    },
  ],
  playlists: [
    ...defaultPlaylists,
    {
      id: "favorites",
      name: "Favorites",
      songIds: ["my-song"],
    }
  ],
};

export default function App() {
  return <IPod {...library} />;
}
```

### HTML

Pass the same library shape to `createIPod()`, which registers the component and waits for initialization.

```html
<ipod-simulator></ipod-simulator>

<script type="module">
  import { createIPod, defaultSongs, defaultPlaylists } from "https://cdn.jsdelivr.net/npm/ipod-simulator@latest/dist/index.js";

  const library = {
    songs: [
      ...defaultSongs,
      {
        id: "my-song",
        name: "My song",
        artistName: "My artist",
        previewUrl: "/music/my-song.mp3",
      }
    ],
    playlists: [
      ...defaultPlaylists,
      {
        id: "favorites",
        name: "Favorites",
        songIds: ["my-song"],
      }
    ],
  };

  const element = document.querySelector("ipod-simulator");
  const ipod = await createIPod(element, library);
</script>
```

Call `await ipod.setLibrary(nextLibrary)` to replace the library later.
