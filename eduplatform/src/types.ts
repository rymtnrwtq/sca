export type UserTier = 'guest' | 'free' | 'premium';

export const TIER_ORDER: Record<UserTier, number> = { guest: 0, free: 1, premium: 2 };

export const canAccess = (requiredTier: UserTier, currentTier: UserTier): boolean =>
  TIER_ORDER[currentTier] >= TIER_ORDER[requiredTier];

export interface Course {
  id: string;
  title: string;
  section: string;
  category: string;
  progress: number;
  image: string | null;
  description: string;
}

export interface Chapter {
  timecode: number;
  title: string;
}

export interface DownloadItem {
  title: string;
  url: string;
  type: 'google_drive' | 'file';
}

export interface Lesson {
  id: string;
  folder_id?: string;
  project_id?: string;
  section?: string;
  title: string;
  description?: string;
  duration: string;
  durationSec: number;
  requiredTier?: UserTier;
  embedUrl?: string;
  posterUrl?: string;
  createdAt?: string;
  tags?: string[];
  chapters?: Chapter[];
  downloads?: DownloadItem[];
  seminarTitle?: string;
}

export interface User {
  id: string;
  username: string;
  name: string;
  tier: UserTier;
  progress: number;
  is_admin?: number;
  subscription_expires_at?: string | null;
  payment_method_id?: string | null;
  trial_used?: number;
  auto_renew?: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  telegram_id?: string | null;
  telegram_username?: string | null;
  telegram_first_name?: string | null;
  telegram_last_name?: string | null;
  telegram_photo_url?: string | null;
}

export interface CatalogItemDB {
  id: string;
  category_id: string;
  kinescope_folder_id?: string | null;
  kinescope_project_id?: string | null;
  video_ids?: string[] | null;
  title: string;
  description: string;
  video_count: number;
  sort_order: number;
}

export interface CatalogCategoryDB {
  id: string;
  section: string;
  category_key: string;
  label: string;
  sort_order: number;
  items: CatalogItemDB[];
}
