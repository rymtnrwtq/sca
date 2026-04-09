import { useState, useEffect } from 'react';
import { isInWatchLater } from '../utils/localStorage';

/**
 * Reactive hook that returns whether a video is bookmarked.
 * Automatically updates when bookmarks change from any component.
 */
export function useIsInWatchLater(videoId: string, embedUrl?: string): boolean {
  const [pinned, setPinned] = useState(() => isInWatchLater(videoId, embedUrl));

  useEffect(() => {
    // Re-check immediately when video changes
    setPinned(isInWatchLater(videoId, embedUrl));

    const handler = () => setPinned(isInWatchLater(videoId, embedUrl));
    window.addEventListener('sca_watch_later_update', handler);
    return () => window.removeEventListener('sca_watch_later_update', handler);
  }, [videoId, embedUrl]);

  return pinned;
}
