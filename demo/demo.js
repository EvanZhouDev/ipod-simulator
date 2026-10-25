import { createIPod, defaultSongs, defaultPlaylists, defaultArtists } from "../dist/index.js";
import { createLocalMusic } from "./music.js";

const ipod = document.querySelector("ipod-simulator");
const button = document.querySelector("#add-music");
const picker = document.querySelector("#music-files");
const status = document.querySelector("#upload-status");
const dialog = document.querySelector("#upload-dialog");
const dropZone = document.querySelector("#choose-music");
const banner = document.querySelector("#music-banner");
const bannerMessage = document.querySelector("#music-banner-message");
let bannerAnimation;

function setBannerVisible(visible) {
  if (!visible && banner.hidden) return;
  const current = banner.hidden ? null : getComputedStyle(banner);
  const from = current ? { transform: current.transform, opacity: current.opacity } : { transform: "translateY(-100%)", opacity: 0 };
  bannerAnimation?.cancel();
  bannerAnimation = undefined;
  banner.inert = !visible;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    banner.hidden = !visible;
    return;
  }
  banner.hidden = false;
  const animation = banner.animate([from, {
    transform: visible ? "translateY(0)" : "translateY(-100%)",
    opacity: visible ? 1 : 0,
  }], { duration: 260, easing: "cubic-bezier(.22,1,.36,1)", fill: "both" });
  bannerAnimation = animation;
  animation.finished.then(() => {
    if (bannerAnimation !== animation) return;
    banner.hidden = !visible;
    animation.cancel();
    bannerAnimation = undefined;
  }).catch(() => {});
}
let ready = false;
let localMusic;
let busy = false;

function showStatus(message, error = false) {
  status.textContent = message;
  status.dataset.error = String(error);
}

const initialLibrary = { songs: defaultSongs, playlists: defaultPlaylists, artists: defaultArtists };
createIPod(ipod, initialLibrary).then(player => {
  localMusic = createLocalMusic(ipod, player, initialLibrary);
  ready = true;
  button.disabled = false;
  // Resize the whole device, including its layout bounds, instead of hiding overflow
  // from the original component's fixed-width, internally scaled shadow wrapper.
  // Reserve the full reflection too, so the music button never covers it.
  const body = ipod.shadowRoot?.querySelector('[data-testid="ipod-container"]');
  if (body) {
    const measure = () => {
      const available = ipod.parentElement.clientWidth;
      if (available <= 0) return;
      ipod.style.width = "440px";
      ipod.style.zoom = String(Math.min(1, available / 440));
      ipod.style.setProperty("--ipod-body-height", `${body.offsetHeight}px`);
      const visibleHeight = body.getBoundingClientRect().height;
      const main = document.querySelector("main");
      main.style.setProperty("--ipod-visible-height", `${visibleHeight}px`);
      main.style.setProperty("--ipod-reflection-height", `${visibleHeight / 2 + 8}px`);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(ipod.parentElement);
    measure();
  }
}).catch(() => showStatus("The iPod could not load. Refresh to try again.", true));

let drawerAnimation;
let backdropAnimation;
let drawerClosing = false;

function slideDrawer(from, to, backdropFrom, backdropTo) {
  drawerAnimation?.cancel();
  backdropAnimation?.cancel();
  const timing = {
    duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 260,
    easing: "cubic-bezier(.22,1,.36,1)",
    fill: "both",
  };
  const animation = dialog.animate([{ transform: from }, { transform: to }], timing);
  backdropAnimation = dialog.animate([{ opacity: backdropFrom }, { opacity: backdropTo }], {
    ...timing,
    pseudoElement: "::backdrop",
  });
  drawerAnimation = animation;
  return animation;
}

function openDrawer() {
  if (dialog.open) return;
  setBannerVisible(false);
  if (!busy) showStatus("");
  drawerClosing = false;
  dialog.showModal();
  if (!window.matchMedia("(max-width: 760px)").matches) return;
  const animation = slideDrawer("translateY(100%)", "translateY(0)", 0, 1);
  animation.finished.then(() => {
    if (drawerAnimation === animation) {
      animation.cancel(); drawerAnimation = undefined;
      backdropAnimation?.cancel(); backdropAnimation = undefined;
    }
  }).catch(() => {});
}

function closeDrawer() {
  if (!dialog.open || drawerClosing) return;
  if (!window.matchMedia("(max-width: 760px)").matches) {
    dialog.close();
    return;
  }
  drawerClosing = true;
  const from = getComputedStyle(dialog).transform;
  const backdropOpacity = getComputedStyle(dialog, "::backdrop").opacity;
  const animation = slideDrawer(from === "none" ? "translateY(0)" : from, "translateY(100%)", backdropOpacity, 0);
  animation.finished.then(() => {
    if (drawerAnimation !== animation) return;
    dialog.close();
    animation.cancel();
    drawerAnimation = undefined;
    drawerClosing = false;
  }).catch(() => {});
}

button.addEventListener("click", openDrawer);
document.querySelector("#close-upload").addEventListener("click", closeDrawer);
document.querySelector("#add-more").addEventListener("click", openDrawer);
document.querySelector("#close-banner").addEventListener("click", () => setBannerVisible(false));
dialog.addEventListener("cancel", event => { event.preventDefault(); closeDrawer(); });
dialog.addEventListener("click", event => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeDrawer();
});
dropZone.addEventListener("click", () => picker.click());

async function loadFiles(files) {
  if (!files.length || !ready || busy) return;
  busy = true;
  dropZone.disabled = true;
  dropZone.setAttribute("aria-busy", "true");
  showStatus("");
  try {
    const { added, skipped, rejected } = await localMusic.add(files);
    if (added.length) {
      const message = added.length === 1 ? "Your song has been added to the Your Uploads playlist." : `Your ${added.length} songs have been added to the Your Uploads playlist.`;
      const warnings = [];
      if (skipped) warnings.push(`${skipped} already added.`);
      if (rejected.length) warnings.push(`${rejected.length} ${rejected.length === 1 ? "file couldn’t" : "files couldn’t"} be played.`);
      bannerMessage.textContent = [message, ...warnings].join(" ");
      setBannerVisible(true);
      closeDrawer();
    } else {
      const parts = [];
      if (skipped) parts.push(`${skipped} already added`);
      if (rejected.length) parts.push(`${rejected.length} ${rejected.length === 1 ? "file couldn’t" : "files couldn’t"} be played`);
      showStatus(parts.join(". ") + ".", rejected.length > 0);
    }
  } catch (error) {
    showStatus(error.message || "Couldn’t add these songs. Try again.", true);
  } finally {
    picker.value = "";
    busy = false;
    dropZone.disabled = false;
    dropZone.removeAttribute("aria-busy");
  }
}
picker.addEventListener("change", () => loadFiles(Array.from(picker.files || [])));

let dragDepth = 0;
dropZone.addEventListener("dragenter", event => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
  dragDepth++;
  if (!busy) dropZone.dataset.dragging = "true";
});
dropZone.addEventListener("dragover", event => {
  if (!Array.from(event.dataTransfer?.types || []).includes("Files")) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = busy ? "none" : "copy";
});
dropZone.addEventListener("dragleave", () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) delete dropZone.dataset.dragging;
});
dropZone.addEventListener("drop", event => {
  event.preventDefault();
  event.stopPropagation();
  dragDepth = 0;
  delete dropZone.dataset.dragging;
  loadFiles(Array.from(event.dataTransfer?.files || []));
});
dialog.addEventListener("dragover", event => {
  if (Array.from(event.dataTransfer?.types || []).includes("Files")) event.preventDefault();
});
dialog.addEventListener("drop", event => event.preventDefault());
dialog.addEventListener("close", () => {
  drawerAnimation?.cancel();
  backdropAnimation?.cancel();
  backdropAnimation = undefined;
  drawerAnimation = undefined;
  drawerClosing = false;
  dragDepth = 0;
  delete dropZone.dataset.dragging;
});

window.addEventListener("pagehide", event => { if (!event.persisted) localMusic?.release(); });

const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
function selectTab(tab) {
  for (const candidate of tabs) {
    const selected = candidate === tab;
    candidate.setAttribute("aria-selected", String(selected));
    candidate.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(candidate.getAttribute("aria-controls"));
    panel.hidden = !selected;
    panel.inert = !selected;
  }
}
for (const [index, tab] of tabs.entries()) {
  tab.addEventListener("click", () => selectTab(tab));
  tab.addEventListener("keydown", event => {
    let next;
    if (event.key === "ArrowRight") next = tabs[(index + 1) % tabs.length];
    if (event.key === "ArrowLeft") next = tabs[(index + tabs.length - 1) % tabs.length];
    if (event.key === "Home") next = tabs[0];
    if (event.key === "End") next = tabs[tabs.length - 1];
    if (next) { event.preventDefault(); selectTab(next); next.focus(); }
  });
}

const copyButton = document.querySelector("#copy-install");
const copyStatus = document.querySelector("#copy-status");
let copyTimer;
copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText("npm install ipod-simulator");
    copyStatus.textContent = "Copied.";
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => { copyStatus.textContent = ""; }, 1800);
  } catch { copyStatus.textContent = "Select the command to copy it."; }
});

const mobileStart = document.querySelector("#mobile-start");
const getStarted = document.querySelector("#get-started");
mobileStart.addEventListener("click", event => {
  event.preventDefault();
  getStarted.focus({ preventScroll: true });
  getStarted.scrollIntoView({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    block: "start",
  });
});
new IntersectionObserver(([entry]) => {
  mobileStart.hidden = entry.isIntersecting;
}).observe(document.querySelector(".docs"));
