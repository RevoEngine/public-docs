export async function readDocsIndex(origin, rootPath, readText) {
  const indexPaths = new Set([rootPath]);
  const pages = new Set();

  // A Set iterator also visits subindexes added while reading the current index.
  for (const indexPath of indexPaths) {
    const index = await readText(indexPath);
    const base = new URL(indexPath, origin);
    for (const [, href] of index.matchAll(/^\s*[-*+] \[[^\]]+\]\(([^)\s]+)\)/gm)) {
      const { origin: linkOrigin, pathname } = new URL(href, base);
      if (linkOrigin !== base.origin) continue;
      if (pathname.startsWith('/_llms/') && /\.(?:txt|md)$/.test(pathname)) {
        indexPaths.add(pathname);
      } else if (pathname.endsWith('.md')) {
        pages.add(pathname.slice(0, -3));
      }
    }
  }

  return { indexPaths, pages };
}
