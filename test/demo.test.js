import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

test("upload UI shows loading, closes on success, and reopens from the banner", async () => {
  const nodes = new Map();
  function node(selector) {
    if (!nodes.has(selector)) nodes.set(selector, {
      hidden: true, dataset: {}, attributes: {}, listeners: {}, textContent: "",
      addEventListener(type, callback) { this.listeners[type] = callback; },
      setAttribute(name, value) { this.attributes[name] = value; },
      removeAttribute(name) { delete this.attributes[name]; },
      showModal() { this.open = true; },
      close() { this.open = false; this.listeners.close?.(); },
      animate(frames, options) {
        let resolve, reject;
        const finished = new Promise((yes, no) => { resolve = yes; reject = no; });
        this.animation = { frames, options, finished, finish: resolve, cancel() { reject(new Error("cancelled")); } };
        return this.animation;
      },
    });
    return nodes.get(selector);
  }
  let finish;
  const source = (await readFile(new URL("../demo/demo.js", import.meta.url), "utf8")).replace(/^import .*;\n/gm, "");
  const context = {
    document: { querySelector: node, querySelectorAll: () => [] },
    window: { matchMedia: () => ({ matches: false }), addEventListener() {} },
    IntersectionObserver: class { observe() {} },
    getComputedStyle: () => ({ transform: "none", opacity: "1" }),
    defaultSongs: [], defaultPlaylists: [], defaultArtists: [],
    createIPod: async () => ({}),
    createLocalMusic: () => ({ add: () => new Promise(resolve => { finish = resolve; }) }),
  };
  runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  node("#add-music").listeners.click();
  node("#music-files").files = [{}];
  const pending = node("#music-files").listeners.change();
  assert.equal(node("#choose-music").attributes["aria-busy"], "true");
  assert.equal(node("#upload-status").textContent, "");
  finish({ added: [{}], skipped: 0, rejected: [] });
  await pending;
  assert.equal(node("#upload-dialog").open, false);
  assert.equal(node("#music-banner").hidden, false);
  assert.equal(node("#music-banner-message").textContent, "Your song has been added to the Your Uploads playlist.");
  assert.equal(node("#choose-music").attributes["aria-busy"], undefined);
  node("#music-banner").animation.finish();
  await Promise.resolve();
  node("#close-banner").listeners.click();
  assert.equal(node("#music-banner").hidden, false);
  assert.equal(node("#music-banner").inert, true);
  assert.equal(node("#music-banner").animation.frames[1].transform, "translateY(-100%)");
  node("#music-banner").animation.finish();
  await Promise.resolve();
  assert.equal(node("#music-banner").hidden, true);
  node("#add-more").listeners.click();
  assert.equal(node("#upload-dialog").open, true);
  assert.equal(node("#music-banner").hidden, true);

  const failed = node("#music-files").listeners.change();
  finish({ added: [], skipped: 0, rejected: [{}] });
  await failed;
  assert.equal(node("#upload-dialog").open, true);
  assert.equal(node("#music-banner").hidden, true);
  assert.equal(node("#upload-status").dataset.error, "true");
});
