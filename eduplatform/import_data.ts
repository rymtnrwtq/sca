// ... (previous imports)
import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(path.join(__dirname, "data.db"));

const KINESCOPE_TOKEN = process.env.KINESCOPE_TOKEN;

async function kinescopeFetch(endpoint: string) {
  if (!KINESCOPE_TOKEN) throw new Error("KINESCOPE_TOKEN missing");
  const res = await fetch(`https://api.kinescope.io/v1${endpoint}`, {
    headers: { Authorization: `Bearer ${KINESCOPE_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Kinescope error: ${res.status} ${await res.text()}`);
  return res.json();
}

function parseTimecodeToSec(tc: string): number {
  if (!tc) return 0;
  const parts = tc.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function formatDuration(sec: number): string {
  if (!sec) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function kinescopeToRow(v: any, section: string, catalogItemId: string | null): any {
  return {
    id: v.id,
    folder_id: v.folder_id ?? null,
    project_id: v.project_id ?? null,
    section,
    catalog_item_id: catalogItemId,
    title: v.title ?? '',
    description: v.description ?? '',
    duration: v.duration ? formatDuration(v.duration) : '—',
    duration_sec: v.duration ?? 0,
    embed_url: v.embed_link ?? null,
    poster_url: v.poster?.md ?? v.poster?.original ?? null,
    created_at_kinescope: v.created_at ?? null,
    tags: JSON.stringify(v.tags ?? []),
    chapters: JSON.stringify(
      v.chapters?.enabled && v.chapters?.items?.length
        ? v.chapters.items.map((c: any) => ({ timecode: parseTimecodeToSec(c.timecode), title: c.title }))
        : []
    ),
  };
}

function upsertVideo(row: any) {
  db.prepare(`
    INSERT INTO videos (id, folder_id, project_id, section, catalog_item_id, title, description, duration, duration_sec, embed_url, poster_url, created_at_kinescope, tags, chapters)
    VALUES (@id, @folder_id, @project_id, @section, @catalog_item_id, @title, @description, @duration, @duration_sec, @embed_url, @poster_url, @created_at_kinescope, @tags, @chapters)
    ON CONFLICT(id) DO UPDATE SET
      folder_id = excluded.folder_id,
      project_id = excluded.project_id,
      section = CASE WHEN excluded.section != '' AND videos.section = 'broadcasts' THEN excluded.section ELSE videos.section END,
      catalog_item_id = COALESCE(videos.catalog_item_id, excluded.catalog_item_id),
      title = CASE WHEN videos.title = '' OR videos.title = videos.id THEN excluded.title ELSE videos.title END,
      description = CASE WHEN videos.description = '' THEN excluded.description ELSE videos.description END,
      duration = excluded.duration,
      duration_sec = excluded.duration_sec,
      embed_url = excluded.embed_url,
      poster_url = excluded.poster_url,
      created_at_kinescope = excluded.created_at_kinescope,
      tags = excluded.tags,
      chapters = excluded.chapters
  `).run(row);
}

// ... rest of import logic ...

const LINKS_PATH = path.join(__dirname, "..", "arhive", "link", "links.json");
const ADD_PATH = path.join(__dirname, "..", "arhive", "link", "additional_materials.json");
const HTML_DIR = path.join(__dirname, "..", "arhive", "link", "sca_html");
const ADD_HTML_DIR = path.join(__dirname, "..", "arhive", "link", "additional_html");

function getKinescopeIdsFromHtml(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    // Try variations like _1
    const base = filePath.replace(".html", "");
    const variations = [`${base}_1.html`, `${base}_2.html`].map(v => path.join(path.dirname(filePath), path.basename(v)));
    for (const v of variations) {
      if (fs.existsSync(v)) {
        filePath = v;
        break;
      }
    }
  }
  if (!fs.existsSync(filePath)) return {};

  const html = fs.readFileSync(filePath, "utf-8");
  const mapping: Record<string, string> = {};
  
  // Extract popup:videoplayerN mapping with potential newlines/attributes between
  const popupRegex = /data-tooltip-hook="#popup:videoplayer(\d+)"[\s\S]*?data-videolazy-id="([^"]+)"/g;
  let match;
  while ((match = popupRegex.exec(html)) !== null) {
    mapping[match[1]] = match[2];
  }

  // If no videoplayer tags found, just grab all kinescope IDs in order
  if (Object.keys(mapping).length === 0) {
    const idRegex = /data-videolazy-id="([^"]+)"/g;
    let idx = 1;
    while ((match = idRegex.exec(html)) !== null) {
      mapping[idx++] = match[1];
    }
  }

  return mapping;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/[^\wа-я]+/g, '_').replace(/^_+|_+$/g, '');
}

async function runImport() {
  console.log("Starting import...");

  const linksData = JSON.parse(fs.readFileSync(LINKS_PATH, "utf-8"));
  const addData = JSON.parse(fs.readFileSync(ADD_PATH, "utf-8"));

  const allCategories = [
    ...linksData.categories.map((c: any) => ({ ...c, section: 'seminars' })),
    ...addData.categories.map((c: any) => ({ ...c, section: 'materials' }))
  ];

  for (const cat of allCategories) {
    const catId = crypto.randomUUID?.() || Math.random().toString(36).substring(7);
    const catKey = slugify(cat.category_name);
    
    db.prepare("INSERT OR IGNORE INTO catalog_categories (id, section, category_key, label, sort_order) VALUES (?, ?, ?, ?, ?)").run(
      catId, cat.section, catKey, cat.category_name, 0
    );
    
    // Get actual ID if IGNORED
    const actualCatId = (db.prepare("SELECT id FROM catalog_categories WHERE category_key = ? AND section = ?").get(catKey, cat.section) as any).id;

    for (const item of cat.items) {
      const itemId = crypto.randomUUID?.() || Math.random().toString(36).substring(7);
      let videoIds: string[] = [];
      
      // Try to get IDs from content
      if (item.content && item.content.length > 0) {
        videoIds = item.content.map((c: any) => c.id).filter(Boolean);
      }

      // If IDs are missing, try to extract from HTML
      if (videoIds.length === 0 && item.link) {
        const match = item.link.match(/\/(seminars|additional_materials)\/(\d+)$/);
        if (match) {
          const type = match[1];
          const num = match[2];
          const htmlPath = type === 'seminars' 
            ? path.join(HTML_DIR, `seminars_${num}.html`)
            : path.join(ADD_HTML_DIR, `additional_materials_${num}.html`);
          
          const mapping = getKinescopeIdsFromHtml(htmlPath);
          // We assume the order in content matches videoplayer1, 2, 3...
          videoIds = Object.keys(mapping).sort((a, b) => parseInt(a) - parseInt(b)).map(k => mapping[k]);
        }
      }

      console.log(`Importing item: ${item.title} (${videoIds.length} videos)`);

      db.prepare(`
        INSERT OR IGNORE INTO catalog_items (id, category_id, title, description, video_ids, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(itemId, actualCatId, item.title, item.description || "", videoIds.join(','), 0);

      // Insert placeholder videos if we have IDs
      for (const vid of videoIds) {
        db.prepare(`
          INSERT OR IGNORE INTO videos (id, section, catalog_item_id, title)
          VALUES (?, ?, ?, ?)
        `).run(vid, cat.section, itemId, vid);
      }
      
      // Also handle content details
      if (item.content) {
        for (const c of item.content) {
          if (c.id) {
            db.prepare("UPDATE videos SET title = ?, description = ? WHERE id = ? AND (title = '' OR title = id)").run(
              c.title || "", c.description || "", c.id
            );
          }
        }
      }
    }
  }

  console.log("Importing from files finished. Starting Kinescope sync for all videos...");

  // Sync all projects
  const projects = db.prepare("SELECT * FROM allowed_projects").all() as any[];
  for (const p of projects) {
    try {
      console.log(`Syncing project ${p.id}...`);
      let page = 1;
      while (true) {
        const data = await kinescopeFetch(`/videos?project_id=${p.id}&per_page=100&page=${page}`);
        const videos: any[] = data.data || [];
        for (const v of videos) {
          upsertVideo(kinescopeToRow(v, p.section, null));
        }
        if (!videos.length || page * 100 >= (data.meta?.pagination?.total || 0)) break;
        page++;
      }
    } catch (e: any) { console.error(e.message); }
  }

  // Sync specific IDs that might be missing from projects
  const missingVideos = db.prepare("SELECT id, section, catalog_item_id FROM videos WHERE embed_url IS NULL").all() as any[];
  console.log(`Syncing ${missingVideos.length} missing videos...`);
  for (const v of missingVideos) {
    try {
      const data = await kinescopeFetch(`/videos/${v.id}`);
      if (data.data) upsertVideo(kinescopeToRow(data.data, v.section, v.catalog_item_id));
    } catch (e: any) { console.error(`Error syncing ${v.id}: ${e.message}`); }
  }

  console.log("Full sync finished.");
}

runImport().catch(console.error);
