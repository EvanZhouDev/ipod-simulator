"use client";

import { createElement, forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { createIPod, defineIPod } from "../core.js";

export const IPod = forwardRef(function IPod({ songs, playlists, artists, onReady, onError, componentUrl, locale, backlit, ...props }, forwardedRef) {
  const ref = useRef(null);
  const callbacks = useRef({ onReady, onError });
  const readyElement = useRef(null);
  callbacks.current = { onReady, onError };
  useImperativeHandle(forwardedRef, () => ref.current, []);
  useEffect(() => {
    let active = true;
    const element = ref.current;
    defineIPod({ componentUrl }).then(async () => {
      if (!active) return;
      if (locale !== undefined) element.locale = locale;
      element.backlit = backlit;
      await createIPod(element, { songs, playlists, artists });
      if (active && readyElement.current !== element) {
        readyElement.current = element;
        callbacks.current.onReady?.(element);
      }
    }).catch(error => { if (active) callbacks.current.onError?.(error); });
    return () => { active = false; };
  }, [songs, playlists, artists, componentUrl, locale, backlit]);
  return createElement("ipod-simulator", { ...props, ref });
});
