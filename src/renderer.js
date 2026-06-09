import fs from 'node:fs/promises';
import path from 'node:path';
import { absoluteUrl, escapeHtml, themeDir, urlJoin } from './utils.js';

let templateCache = new Map();

async function readTemplate(name) {
  if (templateCache.has(name)) return templateCache.get(name);
  const content = await fs.readFile(path.join(themeDir, name), 'utf8');
  templateCache.set(name, content);
  return content;
}

export function clearTemplateCache() {
  templateCache = new Map();
}

function replaceTokens(template, data) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const value = key.split('.').reduce((acc, part) => (acc == null ? '' : acc[part]), data);
    return value == null ? '' : String(value);
  });
}

export function tagLink(tag) {
  return `<a class="meta-pill" href="${urlJoin('tags', tag)}">${escapeHtml(tag)}</a>`;
}

export function categoryLink(category) {
  return `<a class="meta-pill meta-pill-category" href="${urlJoin('categories', category)}">${escapeHtml(category)}</a>`;
}

export function renderPostCard(post) {
  const categories = post.categories.map(categoryLink).join('');
  const tags = post.tags.map(tagLink).join('');
  return `
    <article class="post-card">
      <h2><a href="${post.url}">${escapeHtml(post.title)}</a></h2>
      <div class="post-meta">
        <time datetime="${post.dateISO}">${escapeHtml(post.dateText)}</time>
        ${categories}
        ${tags}
      </div>
      <p>${escapeHtml(post.excerpt)}</p>
    </article>
  `;
}

function renderTermList(items, basePath) {
  if (!items.length) return '<p class="sidebar-empty">暂无内容</p>';
  return items
    .map(([name, count]) => `
      <a class="term-row" href="${urlJoin(basePath, name)}">
        <span>${escapeHtml(name)}</span>
        <strong>${count}</strong>
      </a>
    `)
    .join('\n');
}

function renderRelatedPosts(posts) {
  if (!posts.length) return '';

    return `
      <aside class="related-posts" aria-labelledby="related-posts-title">
        <h2 id="related-posts-title">相关文章</h2>
        <div class="related-list">
          ${posts.map((post) => `
          <a class="related-item" href="${post.url}">
            <span>${escapeHtml(post.title)}</span>
            <time datetime="${post.dateISO}">${escapeHtml(post.dateText)}</time>
          </a>
          `).join('\n')}
        </div>
      </aside>
    `;
  }

function renderGoogleAnalytics(id) {
  const analyticsId = String(id || '').trim();
  if (!analyticsId) return '';

  return `
    <script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(analyticsId)}"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${escapeHtml(analyticsId)}');
    </script>
  `;
}

function renderTableOfContents(items) {
  if (!items.length) return '<div class="post-toc post-toc-empty" aria-hidden="true"></div>';

  return `
    <nav class="post-toc" aria-label="文章目录">
      <h2>目录</h2>
      <ol>
        ${items.map((item) => `
          <li class="toc-level-${item.level}">
            <a href="#${escapeHtml(item.id)}">${escapeHtml(item.title)}</a>
          </li>
        `).join('\n')}
      </ol>
    </nav>
  `;
}

function renderSeoMeta(page, config) {
  const canonical = absoluteUrl(config.siteUrl, page.canonical);
  const image = page.image || config.defaultImage;
  const imageUrl = image ? absoluteUrl(config.siteUrl, image) : '';

  return `
    <meta name="author" content="${escapeHtml(config.author)}">
    <meta property="og:site_name" content="${escapeHtml(config.title)}">
    <meta property="og:title" content="${escapeHtml(page.title)}">
    <meta property="og:description" content="${escapeHtml(page.description)}">
    <meta property="og:type" content="${page.type || 'website'}">
    <meta property="og:url" content="${escapeHtml(canonical)}">
    ${page.publishedTime ? `<meta property="article:published_time" content="${escapeHtml(page.publishedTime)}">` : ''}
    ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}">` : ''}
    <meta name="twitter:card" content="${imageUrl ? 'summary_large_image' : 'summary'}">
    <meta name="twitter:title" content="${escapeHtml(page.title)}">
    <meta name="twitter:description" content="${escapeHtml(page.description)}">
    ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}">` : ''}
  `;
}

function safeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderStructuredData(page, config) {
  const canonical = absoluteUrl(config.siteUrl, page.canonical);
  const base = {
    '@context': 'https://schema.org',
    '@type': page.type === 'article' ? 'BlogPosting' : 'WebSite',
    name: page.title,
    headline: page.headline || page.title,
    description: page.description,
    url: canonical
  };

  if (page.type === 'article') {
    base.datePublished = page.publishedTime;
    base.dateModified = page.publishedTime;
    base.author = {
      '@type': 'Person',
      name: config.author || config.title
    };
    base.publisher = {
      '@type': 'Organization',
      name: config.title
    };
    if (page.image || config.defaultImage) {
      base.image = absoluteUrl(config.siteUrl, page.image || config.defaultImage);
    }
  } else {
    base.publisher = {
      '@type': 'Organization',
      name: config.title
    };
    base.potentialAction = {
      '@type': 'SearchAction',
      target: absoluteUrl(config.siteUrl, '/search/?q={search_term_string}'),
      'query-input': 'required name=search_term_string'
    };
  }

  return `<script type="application/ld+json">${safeJsonLd(base)}</script>`;
}

function renderLayout(layout, page, config) {
  const canonical = absoluteUrl(config.siteUrl, page.canonical);
  return replaceTokens(layout, {
    ...page,
    title: escapeHtml(page.title),
    description: escapeHtml(page.description),
    canonical: escapeHtml(canonical),
    seoMeta: renderSeoMeta(page, config),
    structuredData: renderStructuredData(page, config),
    googleAnalytics: renderGoogleAnalytics(config.googleAnalyticsId),
    site: {
      title: escapeHtml(config.title),
      description: escapeHtml(config.description),
      language: escapeHtml(config.language)
    }
  });
}

export async function renderIndex(posts, stats, config) {
  const template = await readTemplate('index.html');
  const layout = await readTemplate('layout.html');
  const body = replaceTokens(template, {
    pageTitle: '最新文章',
    pageIntro: '记录工程实践、产品思考和技术创作中的长期主义。',
    postCount: posts.length,
    categoryCount: stats.categories.length,
    tagCount: stats.tags.length,
    posts: posts.map(renderPostCard).join('\n'),
    sidebar: `
      <aside class="home-sidebar">
        <section class="sidebar-section">
          <h2>分类</h2>
          ${renderTermList(stats.categories, 'categories')}
        </section>
        <section class="sidebar-section">
          <h2>标签</h2>
          <div class="tag-cloud">${stats.tags.map(([tag]) => tagLink(tag)).join('')}</div>
        </section>
      </aside>
    `
  });

  return renderLayout(layout, {
    title: config.title,
    description: config.description,
    canonical: '/',
    body
  }, config);
}

export async function renderArchivePage({ title, description, canonical, posts, config }) {
  const template = await readTemplate('index.html');
  const layout = await readTemplate('layout.html');
  const body = replaceTokens(template, {
    pageTitle: title,
    pageIntro: description,
    postCount: posts.length,
    categoryCount: '',
    tagCount: '',
    posts: posts.map(renderPostCard).join('\n') || '<p class="empty-state">暂无文章。</p>',
    sidebar: ''
  });

  return renderLayout(layout, { title: `${title} - ${config.title}`, description, canonical, body }, config);
}

export async function renderPost(post, config, relatedPosts = []) {
  const template = await readTemplate('post.html');
  const layout = await readTemplate('layout.html');
  const body = replaceTokens(template, {
    title: escapeHtml(post.title),
    dateISO: post.dateISO,
    dateText: escapeHtml(post.dateText),
    readingTime: escapeHtml(post.readingTime),
    categories: post.categories.map(categoryLink).join(''),
    tags: post.tags.map(tagLink).join(''),
    tableOfContents: renderTableOfContents(post.toc),
    content: post.html,
    relatedPosts: renderRelatedPosts(relatedPosts)
  });

  return renderLayout(layout, {
    title: `${post.title} - ${config.title}`,
    headline: post.title,
    description: post.description,
    canonical: post.url,
    image: post.cover,
    publishedTime: post.dateISO,
    type: 'article',
    body
  }, config);
}

export async function renderSearchPage(config) {
  const template = await readTemplate('search.html');
  const layout = await readTemplate('layout.html');
  return renderLayout(layout, {
    title: `搜索 - ${config.title}`,
    description: '搜索博客文章标题、摘要、正文、标签和分类。',
    canonical: '/search/',
    body: template
  }, config);
}
