import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import chokidar from 'chokidar';
import { build } from './build.js';
import { distDir, rootDir } from './utils.js';

const preferredPort = Number(process.env.PORT || 3000);
let building = false;
let pending = false;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

async function rebuild(reason = 'startup') {
  if (building) {
    pending = true;
    return;
  }

  building = true;
  try {
    const result = await build();
    console.log(`[${new Date().toLocaleTimeString()}] rebuilt after ${reason}: ${result.posts} posts in ${result.duration}ms`);
  } catch (error) {
    console.error(`[${new Date().toLocaleTimeString()}] rebuild failed: ${error.message}`);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      await rebuild('queued change');
    }
  }
}

function normalizeRequestPath(requestUrl) {
  const url = new URL(requestUrl, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  return pathname.replace(/^\/+/, '');
}

async function serveFile(req, res) {
  try {
    const requestPath = normalizeRequestPath(req.url);
    const target = path.resolve(distDir, requestPath);

    if (!target.startsWith(path.resolve(distDir))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    let filePath = target;
    const stat = await fs.stat(filePath).catch(() => null);
    if (!stat || stat.isDirectory()) {
      filePath = path.join(target, 'index.html');
    }

    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not Found');
  }
}

await rebuild();

chokidar
  .watch([path.join(rootDir, 'content'), path.join(rootDir, 'themes'), path.join(rootDir, 'public'), path.join(rootDir, 'src')], {
    ignoreInitial: true,
    ignored: /(^|[/\\])\../
  })
  .on('all', (event, file) => {
    rebuild(`${event} ${path.relative(rootDir, file)}`);
  });

function listen(port, attempts = 0) {
  const server = http.createServer(serveFile);
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && attempts < 20) {
      listen(port + 1, attempts + 1);
      return;
    }

    console.error(`Preview server failed: ${error.message}`);
    process.exitCode = 1;
  });

  server.listen(port, () => {
    console.log(`Preview server: http://localhost:${port}`);
  });
}

listen(preferredPort);
