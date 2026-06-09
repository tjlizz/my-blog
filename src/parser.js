import fs from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { contentDir, formatDate, slugFromFilename, stripHtml, toArray, urlJoin } from './utils.js';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre><code class="hljs language-${lang}">${hljs.highlight(code, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {
        return '';
      }
    }

    return `<pre><code class="hljs">${hljs.highlightAuto(code).value}</code></pre>`;
  }
});

const requiredFields = ['title', 'date'];

function slugifyHeading(text) {
  return String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'section';
}

function createHeadingId(text, usedIds) {
  const base = slugifyHeading(text);
  let id = base;
  let index = 2;

  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  usedIds.add(id);
  return id;
}

md.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const token = tokens[index];
  const nextToken = tokens[index + 1];
  const level = Number(token.tag.slice(1));

  if (nextToken?.type === 'inline' && level >= 1 && level <= 4) {
    env.headingIds ||= new Set();
    env.toc ||= [];

    const title = nextToken.content;
    const id = createHeadingId(title, env.headingIds);
    token.attrSet('id', id);
    env.toc.push({ level, title, id });
  }

  return self.renderToken(tokens, index, options);
};

function estimateReadingTime(text) {
  const cnChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const words = text.replace(/[\u4e00-\u9fa5]/g, ' ').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil((cnChars / 350) + (words / 220)));
  return `${minutes} 分钟阅读`;
}

function normalizeDate(value, file) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`文章 ${file} 的 date 无法解析，请使用类似 "2026-05-29 15:46:00" 的格式。`);
  }
  return date;
}

function validateFrontMatter(data, file) {
  const missing = requiredFields.filter((field) => !data[field]);
  if (missing.length > 0) {
    throw new Error(`文章 ${file} 缺少必要字段：${missing.join(', ')}。请在 Front Matter 中补充。`);
  }
}

export async function parsePost(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = matter(raw);
  const filename = path.basename(filePath);
  validateFrontMatter(parsed.data, filename);

  const date = normalizeDate(parsed.data.date, filename);
  const markdownEnv = {};
  const html = md.render(parsed.content, markdownEnv);
  const plainText = stripHtml(html);
  const slug = slugFromFilename(filename);
  const tags = toArray(parsed.data.tags);
  const categories = toArray(parsed.data.categories);
  const excerpt = parsed.data.excerpt || plainText.slice(0, 180);

  return {
    slug,
    title: String(parsed.data.title),
    date,
    dateISO: date.toISOString(),
    dateText: formatDate(date),
    tags,
    categories,
    excerpt: String(excerpt),
    description: String(parsed.data.description || excerpt),
    cover: parsed.data.cover ? String(parsed.data.cover) : '',
    content: parsed.content,
    html,
    toc: markdownEnv.toc || [],
    plainText,
    readingTime: estimateReadingTime(plainText),
    url: urlJoin('posts', slug),
    source: filePath
  };
}

export async function loadPosts() {
  let files = [];
  try {
    files = await fs.readdir(contentDir);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const markdownFiles = files
    .filter((file) => /\.(md|markdown)$/i.test(file))
    .map((file) => path.join(contentDir, file));

  const posts = await Promise.all(markdownFiles.map(parsePost));
  return posts.sort((a, b) => b.date.getTime() - a.date.getTime());
}
