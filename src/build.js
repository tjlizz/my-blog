import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { loadPosts } from './parser.js';
import { clearTemplateCache, renderArchivePage, renderIndex, renderPost, renderSearchPage } from './renderer.js';
import { createSearchIndex } from './search.js';
import { absoluteUrl, contentDir, contentImagesDir, distDir, ensureDir, escapeHtml, pathExists, publicDir, themeDir, urlJoin, writeFile } from './utils.js';

function collectStats(posts) {
  const categories = new Map();
  const tags = new Map();

  for (const post of posts) {
    for (const category of post.categories) {
      categories.set(category, (categories.get(category) || 0) + 1);
    }
    for (const tag of post.tags) {
      tags.set(tag, (tags.get(tag) || 0) + 1);
    }
  }

  const sortEntries = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-CN'));
  return {
    categories: sortEntries(categories),
    tags: sortEntries(tags)
  };
}

function countOverlap(left, right) {
  const rightSet = new Set(right);
  return left.reduce((count, item) => count + (rightSet.has(item) ? 1 : 0), 0);
}

function findRelatedPosts(post, posts, limit = 3) {
  return posts
    .filter((candidate) => candidate.slug !== post.slug)
    .map((candidate) => {
      const categoryScore = countOverlap(post.categories, candidate.categories) * 3;
      const tagScore = countOverlap(post.tags, candidate.tags) * 2;
      return {
        post: candidate,
        score: categoryScore + tagScore
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || b.post.date.getTime() - a.post.date.getTime())
    .slice(0, limit)
    .map((item) => item.post);
}

async function copyPublicAssets() {
  if (!(await pathExists(publicDir))) return;
  await fs.cp(publicDir, distDir, { recursive: true });
}

async function copyThemeAssets() {
  await fs.copyFile(path.join(themeDir, 'style.css'), path.join(distDir, 'style.css'));
}

async function copyDirIfExists(from, to) {
  if (!(await pathExists(from))) return;
  await fs.cp(from, to, { recursive: true });
}

async function copyContentImages(posts) {
  await copyDirIfExists(contentImagesDir, path.join(distDir, 'images'));
  await copyDirIfExists(path.join(contentDir, 'images'), path.join(distDir, 'images'));

  for (const post of posts) {
    await copyDirIfExists(
      path.join(contentDir, post.slug, 'images'),
      path.join(distDir, 'posts', post.slug, 'images')
    );
  }
}

async function resetDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await ensureDir(distDir);
}

function renderSitemapUrl(config, { pathname, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${escapeHtml(absoluteUrl(config.siteUrl, pathname))}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>'
  ].join('\n');
}

function renderSitemap(config, posts, stats) {
  const latestPostDate = posts[0]?.dateISO.slice(0, 10) || new Date().toISOString().slice(0, 10);
  const urls = [
    renderSitemapUrl(config, {
      pathname: '/',
      lastmod: latestPostDate,
      changefreq: 'daily',
      priority: '1.0'
    }),
    renderSitemapUrl(config, {
      pathname: '/search/',
      lastmod: latestPostDate,
      changefreq: 'weekly',
      priority: '0.5'
    })
  ];

  for (const post of posts) {
    urls.push(renderSitemapUrl(config, {
      pathname: post.url,
      lastmod: post.dateISO.slice(0, 10),
      changefreq: 'monthly',
      priority: '1.0'
    }));
  }

  for (const [tag] of stats.tags) {
    urls.push(renderSitemapUrl(config, {
      pathname: urlJoin('tags', tag),
      lastmod: latestPostDate,
      changefreq: 'weekly',
      priority: '0.6'
    }));
  }

  for (const [category] of stats.categories) {
    urls.push(renderSitemapUrl(config, {
      pathname: urlJoin('categories', category),
      lastmod: latestPostDate,
      changefreq: 'weekly',
      priority: '0.7'
    }));
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

function renderRobots(config) {
  const sitemap = absoluteUrl(config.siteUrl, '/sitemap.xml');
  const rss = absoluteUrl(config.siteUrl, '/rss.xml');
  return `User-agent: *
Allow: /

Sitemap: ${sitemap}
RSS: ${rss}
`;
}

function renderRss(config, posts) {
  const latestPostDate = posts[0]?.date || new Date();
  const items = posts.map((post) => {
    const postUrl = absoluteUrl(config.siteUrl, post.url);
    return `    <item>
      <title>${escapeHtml(post.title)}</title>
      <link>${escapeHtml(postUrl)}</link>
      <guid isPermaLink="true">${escapeHtml(postUrl)}</guid>
      <pubDate>${post.date.toUTCString()}</pubDate>
      <description>${escapeHtml(post.description || post.excerpt)}</description>
      ${post.categories.map((category) => `<category>${escapeHtml(category)}</category>`).join('\n      ')}
      ${post.tags.map((tag) => `<category>${escapeHtml(tag)}</category>`).join('\n      ')}
    </item>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeHtml(config.title)}</title>
    <link>${escapeHtml(absoluteUrl(config.siteUrl, '/'))}</link>
    <description>${escapeHtml(config.description)}</description>
    <language>${escapeHtml(config.language)}</language>
    <lastBuildDate>${latestPostDate.toUTCString()}</lastBuildDate>
    <generator>Blog System</generator>
${items}
  </channel>
</rss>
`;
}

export async function build() {
  clearTemplateCache();
  const started = Date.now();
  const config = await loadConfig();
  const posts = await loadPosts();
  const stats = collectStats(posts);

  await resetDist();
  await copyPublicAssets();
  await copyContentImages(posts);
  await copyThemeAssets();

  await writeFile(path.join(distDir, 'index.html'), await renderIndex(posts, stats, config));

  for (const post of posts) {
    await writeFile(
      path.join(distDir, 'posts', post.slug, 'index.html'),
      await renderPost(post, config, findRelatedPosts(post, posts))
    );
  }

  for (const [tag] of stats.tags) {
    const taggedPosts = posts.filter((post) => post.tags.includes(tag));
    await writeFile(
      path.join(distDir, 'tags', tag, 'index.html'),
      await renderArchivePage({
        title: `标签：${tag}`,
        description: `标签 ${tag} 下的文章。`,
        canonical: urlJoin('tags', tag),
        posts: taggedPosts,
        config
      })
    );
  }

  for (const [category] of stats.categories) {
    const categoryPosts = posts.filter((post) => post.categories.includes(category));
    await writeFile(
      path.join(distDir, 'categories', category, 'index.html'),
      await renderArchivePage({
        title: `分类：${category}`,
        description: `分类 ${category} 下的文章。`,
        canonical: urlJoin('categories', category),
        posts: categoryPosts,
        config
      })
    );
  }

  await writeFile(path.join(distDir, 'search', 'index.html'), await renderSearchPage(config));
  await writeFile(path.join(distDir, 'search-index.json'), JSON.stringify(createSearchIndex(posts), null, 2));
  await writeFile(path.join(distDir, 'sitemap.xml'), renderSitemap(config, posts, stats));
  await writeFile(path.join(distDir, 'rss.xml'), renderRss(config, posts));
  await writeFile(path.join(distDir, 'robots.txt'), renderRobots(config));

  return {
    posts: posts.length,
    tags: stats.tags.length,
    categories: stats.categories.length,
    duration: Date.now() - started
  };
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  build()
    .then((result) => {
      console.log(`Build complete: ${result.posts} posts, ${result.categories} categories, ${result.tags} tags in ${result.duration}ms.`);
    })
    .catch((error) => {
      console.error(`Build failed: ${error.message}`);
      process.exitCode = 1;
    });
}
