import { Lesson } from '../types';
import { HIDDEN_VIDEOS_KEY, FORCED_WATCHED_KEY, HISTORY_KEY, WATCH_LATER_KEY, MAX_HISTORY } from '../constants';
import { syncHistoryToDB, syncDeleteHistoryFromDB, syncWatchLaterToDB } from './apiSync';

// --- Types ---

export interface WatchHistoryEntry {
  videoId: string;
  title: string;
  posterUrl: string | null;
  duration: string;
  durationSec: number;
  embedUrl: string;
  lastPosition: number; // seconds
  lastWatched: number;  // timestamp
  progress: number;     // 0-100
}

export interface WatchLaterEntry {
  videoId: string;
  title: string;
  posterUrl: string | null;
  duration: string;
  durationSec: number;
  embedUrl: string;
  addedAt: number;
}

// --- Hidden Videos & Forced Watched ---

export function loadHiddenVideos(): string[] {
  try { return JSON.parse(localStorage.getItem(HIDDEN_VIDEOS_KEY) ?? '[]'); } catch { return []; }
}
export function toggleHideVideo(videoId: string) {
  const hidden = loadHiddenVideos();
  const idx = hidden.indexOf(videoId);
  if (idx >= 0) hidden.splice(idx, 1);
  else hidden.push(videoId);
  localStorage.setItem(HIDDEN_VIDEOS_KEY, JSON.stringify(hidden));
  window.dispatchEvent(new CustomEvent('sca_history_update'));
}

export function loadForcedWatched(): string[] {
  try { return JSON.parse(localStorage.getItem(FORCED_WATCHED_KEY) ?? '[]'); } catch { return []; }
}
export function toggleForcedWatched(video: Lesson) {
  const watched = loadForcedWatched();
  const idx = watched.indexOf(video.id);
  const history = loadWatchHistory();
  const hIdx = history.findIndex(h => h.videoId === video.id);

  if (idx >= 0) {
    watched.splice(idx, 1);
    if (hIdx >= 0) {
      history[hIdx].progress = 0;
      history[hIdx].lastPosition = 0;
      saveWatchHistory(history);
    }
  } else {
    watched.push(video.id);
    addToWatchHistory(video, video.durationSec);
  }
  localStorage.setItem(FORCED_WATCHED_KEY, JSON.stringify(watched));
  window.dispatchEvent(new CustomEvent('sca_history_update'));
}

export function resetWatchProgress(videoId: string) {
  const history = loadWatchHistory();
  const filtered = history.filter(h => h.videoId !== videoId);
  saveWatchHistory(filtered);
  
  const watched = loadForcedWatched();
  const wIdx = watched.indexOf(videoId);
  if (wIdx >= 0) {
    watched.splice(wIdx, 1);
    localStorage.setItem(FORCED_WATCHED_KEY, JSON.stringify(watched));
  }
  
  window.dispatchEvent(new CustomEvent('sca_history_update'));
}

// --- Watch History ---

export function loadWatchHistory(): WatchHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}
export function saveWatchHistory(entries: WatchHistoryEntry[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY)));
    window.dispatchEvent(new CustomEvent('sca_history_update'));
  } catch {}
}
export function addToWatchHistory(video: Lesson, position = 0) {
  const history = loadWatchHistory();
  const existing = history.find(h => h.videoId === video.id);
  const progress = video.durationSec > 0 ? Math.min(100, Math.round((position / video.durationSec) * 100)) : 0;
  
  let entry: WatchHistoryEntry;
  if (existing) {
    existing.lastPosition = position;
    existing.lastWatched = Date.now();
    existing.progress = Math.max(existing.progress, progress);
    existing.title = video.title;
    existing.posterUrl = video.posterUrl ?? null;
    const idx = history.indexOf(existing);
    history.splice(idx, 1);
    history.unshift(existing);
    entry = existing;
  } else {
    entry = {
      videoId: video.id,
      title: video.title,
      posterUrl: video.posterUrl ?? null,
      duration: video.duration,
      durationSec: video.durationSec,
      embedUrl: video.embedUrl ?? '',
      lastPosition: position,
      lastWatched: Date.now(),
      progress,
    };
    history.unshift(entry);
  }
  saveWatchHistory(history);
  syncHistoryToDB(entry, true);
}
export function updateWatchPosition(videoId: string, position: number, durationSec: number) {
  const history = loadWatchHistory();
  const entry = history.find(h => h.videoId === videoId);
  if (entry) {
    entry.lastPosition = position;
    entry.lastWatched = Date.now();
    entry.progress = durationSec > 0 ? Math.min(100, Math.round((position / durationSec) * 100)) : entry.progress;
    saveWatchHistory(history);
    syncHistoryToDB(entry);
  }
}
export function getWatchPosition(videoId: string): number {
  const history = loadWatchHistory();
  return history.find(h => h.videoId === videoId)?.lastPosition ?? 0;
}
export function getWatchProgress(videoId: string): { progress: number; lastPosition: number } {
  const h = loadWatchHistory().find(e => e.videoId === videoId);
  return { progress: h?.progress ?? 0, lastPosition: h?.lastPosition ?? 0 };
}
export function removeFromHistory(videoId: string) {
  saveWatchHistory(loadWatchHistory().filter(h => h.videoId !== videoId));
  syncDeleteHistoryFromDB(videoId);
}

// --- Watch Later ---

export function loadWatchLater(): WatchLaterEntry[] {
  try { return JSON.parse(localStorage.getItem(WATCH_LATER_KEY) ?? '[]'); } catch { return []; }
}
export function saveWatchLater(entries: WatchLaterEntry[]) {
  try {
    localStorage.setItem(WATCH_LATER_KEY, JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('sca_watch_later_update'));
  } catch {}
}
export function toggleWatchLater(video: Lesson): boolean {
  const list = loadWatchLater();
  // Check by videoId first, then by embedUrl to handle cases where the same
  // physical video has different IDs in different contexts (API vs DB)
  let idx = list.findIndex(w => w.videoId === video.id);
  if (idx < 0 && video.embedUrl) {
    idx = list.findIndex(w => w.embedUrl && w.embedUrl === video.embedUrl);
  }
  if (idx >= 0) {
    const removedId = list[idx].videoId;
    list.splice(idx, 1);
    saveWatchLater(list);
    syncWatchLaterToDB(null, removedId, false);
    return false; // removed
  }
  const entry: WatchLaterEntry = {
    videoId: video.id,
    title: video.title,
    posterUrl: video.posterUrl ?? null,
    duration: video.duration,
    durationSec: video.durationSec,
    embedUrl: video.embedUrl ?? '',
    addedAt: Date.now(),
  };
  list.unshift(entry);
  saveWatchLater(list);
  syncWatchLaterToDB(entry, entry.videoId, true);
  return true; // added
}
export function isInWatchLater(videoId: string, embedUrl?: string): boolean {
  const list = loadWatchLater();
  return list.some(w =>
    w.videoId === videoId ||
    (embedUrl && w.embedUrl && w.embedUrl === embedUrl)
  );
}
export function removeFromWatchLater(videoId: string) {
  const list = loadWatchLater().filter(w => w.videoId !== videoId);
  saveWatchLater(list);
  syncWatchLaterToDB(null, videoId, false);
}

// --- Helpers ---

export function getResumeEmbedUrl(embedUrl: string, videoId: string): string {
  const pos = getWatchPosition(videoId);
  if (pos > 5) {
    const sep = embedUrl.includes('?') ? '&' : '?';
    return `${embedUrl}${sep}t=${Math.floor(pos)}`;
  }
  return embedUrl;
}

export function loadLearnPrefs() {
  try {
    const raw = localStorage.getItem('sca_learn_prefs');
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}
export function saveLearnPrefs(prefs: Record<string, unknown>) {
  try {
    const existing = loadLearnPrefs();
    localStorage.setItem('sca_learn_prefs', JSON.stringify({ ...existing, ...prefs }));
  } catch {}
}
