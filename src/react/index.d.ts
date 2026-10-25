import type { ForwardRefExoticComponent, HTMLAttributes, RefAttributes } from "react";
import type { Artist, IPodElement, Playlist, Song } from "../index.js";
export interface IPodProps extends Omit<HTMLAttributes<IPodElement>, "onError"> {
  songs?: Song[];
  playlists?: Playlist[];
  artists?: Artist[];
  onReady?: (element: IPodElement) => void;
  onError?: (error: Error) => void;
  componentUrl?: string;
  locale?: { storefront: string; language: string };
  backlit?: boolean;
}
export const IPod: ForwardRefExoticComponent<IPodProps & RefAttributes<IPodElement>>;
