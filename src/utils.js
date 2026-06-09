import fs from 'node:fs/promises';
import path from 'node:path';

export const rootDir = process.cwd();
export const contentRootDir = path.join(rootDir, 'content');
export const contentDir = path.join(rootDir, 'content', 'posts');
export const contentImagesDir = path.join(rootDir, 'content', 'images');
export const publicDir = path.join(rootDir, 'public');
export const distDir = path.join(rootDir, 'dist');
export const themeDir = path.join(rootDir, 'themes', 'github');

export function slugFromFilename(filename) {
  return path.basename(filename, path.extname(filename)).trim();
}

export function urlJoin(...parts) {
  return `/${parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')}/`;
}

export function absoluteUrl(siteUrl, pathname = '/') {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return siteUrl ? `${siteUrl}${normalizedPath}` : normalizedPath;
}

export function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stripHtml(html = '') {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function toArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeFile(file, content) {
  await ensureDir(path.dirname(file));
  await fs.writeFile(file, content, 'utf8');
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}
