import { WatchHistoryEntry, WatchLaterEntry } from './localStorage';

function authHeader(): Record<string, string> {
  const token = localStorage.getItem('auth_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem('auth_token');
}

// Per-video debounce timers for position saves (30s)
const positionTimers = new Map<string, ReturnType<typeof setTimeout>>();

async function doSyncHistory(entry: WatchHistoryEntry) {
  try {
    await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({
        videoId: entry.videoId,
        progress: entry.progress,
        lastPosition: entry.lastPosition,
        videoTitle: entry.title,
        videoPoster: entry.posterUrl,
        videoDuration: entry.duration,
        videoDurationSec: entry.durationSec,
        videoEmbedUrl: entry.embedUrl,
      }),
    });
  } catch (e) {
    console.error('Failed to sync history to DB', e);
  }
}

// immediate=true: sync now (on video start / completion)
// immediate=false (default): debounce 30s per video (during playback)
export async function syncHistoryToDB(entry: WatchHistoryEntry, immediate = false) {
  if (!isLoggedIn()) return;

  if (immediate) {
    const existing = positionTimers.get(entry.videoId);
    if (existing) { clearTimeout(existing); positionTimers.delete(entry.videoId); }
    await doSyncHistory(entry);
    return;
  }

  // Debounced: cancel previous timer for this video, start new one
  const existing = positionTimers.get(entry.videoId);
  if (existing) clearTimeout(existing);
  positionTimers.set(entry.videoId, setTimeout(() => {
    positionTimers.delete(entry.videoId);
    doSyncHistory(entry);
  }, 30_000));
}

export async function syncDeleteHistoryFromDB(videoId: string) {
  if (!isLoggedIn()) return;
  try {
    await fetch('/api/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ videoId }),
    });
  } catch (e) {
    console.error('Failed to delete history from DB', e);
  }
}

export async function syncWatchLaterToDB(entry: WatchLaterEntry | null, videoId: string, isAdded: boolean) {
  if (!isLoggedIn()) return;
  try {
    if (isAdded && entry) {
      await fetch('/api/watch-later', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          videoId: entry.videoId,
          videoTitle: entry.title,
          videoPoster: entry.posterUrl,
          videoDuration: entry.duration,
          videoDurationSec: entry.durationSec,
          videoEmbedUrl: entry.embedUrl,
        }),
      });
    } else {
      await fetch('/api/watch-later', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoId }),
      });
    }
  } catch (e) {
    console.error('Failed to sync watch later to DB', e);
  }
}
