import fs from 'node:fs/promises';
import path from 'node:path';
import { rootDir } from './utils.js';

const defaultConfig = {
  title: 'My Blog',
  description: '一个简洁、清晰、适合阅读技术文章的内容站。',
  siteUrl: '',
  author: '',
  language: 'zh-CN',
  googleAnalyticsId: '',
  defaultImage: ''
};

function normalizeSiteUrl(siteUrl = '') {
  return String(siteUrl).trim().replace(/\/+$/, '');
}

export async function loadConfig() {
  const configPath = path.join(rootDir, 'blog.config.json');
  let userConfig = {};

  try {
    userConfig = JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw new Error(`配置文件 blog.config.json 解析失败：${error.message}`);
    }
  }

  return {
    ...defaultConfig,
    ...userConfig,
    siteUrl: normalizeSiteUrl(userConfig.siteUrl || defaultConfig.siteUrl)
  };
}
