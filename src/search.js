export function createSearchIndex(posts) {
  return posts.map((post) => ({
    title: post.title,
    excerpt: post.excerpt,
    content: post.plainText,
    tags: post.tags,
    categories: post.categories,
    url: post.url,
    date: post.dateISO
  }));
}

