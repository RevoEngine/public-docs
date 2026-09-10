#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { permitsHistoricalMethod } from './historical-release-policy.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ignoredDirectories = new Set(['.git', 'node_modules']);
const policyPages = [
  'resources/platform-terms-and-conditions.mdx',
  'resources/cloud-services-and-support-terms-and-conditions.mdx',
  'resources/privacy-policy-and-cookies.mdx',
  'resources/service-level-agreement-sla.mdx',
  'resources/support-policy.mdx',
];
const databaseWorkspacePages = [
  'operate/database-definitions',
  'operate/database-audit',
  'operate/database-views',
  'operate/materialized-views',
  'operate/database-cache',
];

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

function collectNavigationPages(value, pages = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectNavigationPages(entry, pages);
    return pages;
  }
  if (!value || typeof value !== 'object') return pages;
  for (const [key, entry] of Object.entries(value)) {
    if (key === 'pages' && Array.isArray(entry)) {
      for (const page of entry) {
        if (typeof page === 'string') pages.push(page);
        else collectNavigationPages(page, pages);
      }
    } else {
      collectNavigationPages(entry, pages);
    }
  }
  return pages;
}

function bodyWithoutFrontmatter(content) {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)?/, '').trim();
}

function frontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!match) return null;
  return Object.fromEntries(match[1]
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Za-z][\w-]*):\s*(.+?)\s*$/))
    .filter(Boolean)
    .map((entry) => [entry[1], entry[2].replace(/^['"]|['"]$/g, '')]));
}

function declarationClassBody(source, className) {
  const start = source.indexOf(`declare class ${className} {`);
  if (start === -1) return '';
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}' && --depth === 0) return source.slice(open + 1, index);
  }
  return '';
}

function deprecatedLowCodeMethods(source) {
  return ['api', 'storage', 'agent', 'util'].flatMap((global) => {
    const body = declarationClassBody(source, global);
    return [...body.matchAll(/\/\*\*([\s\S]*?)\*\/\s*static\s+([A-Za-z_$][\w$]*)/g)]
      .filter((match) => /@deprecated\b/i.test(match[1]))
      .map((match) => `${global}.${match[2]}`);
  });
}

function main() {
  const issues = [];
  const docs = JSON.parse(readFileSync(join(root, 'docs.json'), 'utf8'));
  const navigationPages = collectNavigationPages(docs);
  const navigationSet = new Set(navigationPages);
  const mdxFiles = filesUnder(root).filter((file) => extname(file) === '.mdx');
  const mdxPages = mdxFiles.map((file) => relative(root, file).replaceAll('\\', '/').replace(/\.mdx$/, ''));
  const mdxSet = new Set(mdxPages);

  for (const page of navigationPages) {
    if (!mdxSet.has(page)) issues.push(`Navigation page does not exist: ${page}.mdx`);
  }
  for (const page of mdxPages) {
    if (!navigationSet.has(page)) issues.push(`MDX page is missing from docs.json navigation: ${page}.mdx`);
  }
  for (const page of new Set(navigationPages.filter((page, index) => navigationPages.indexOf(page) !== index))) {
    issues.push(`Navigation page is listed more than once: ${page}.mdx`);
  }
  const databaseWorkspacePositions = databaseWorkspacePages.map((page) => navigationPages.indexOf(page));
  if (
    databaseWorkspacePositions.some((position) => position === -1)
    || databaseWorkspacePositions.some((position, index) => index > 0 && position !== databaseWorkspacePositions[index - 1] + 1)
  ) {
    issues.push(`Database workspace pages must follow the product UI order: ${databaseWorkspacePages.join(' -> ')}.`);
  }
  for (const file of mdxFiles) {
    const content = readFileSync(file, 'utf8');
    const metadata = frontmatter(content);
    if (!metadata) {
      issues.push(`MDX page has no frontmatter: ${relative(root, file)}`);
    } else {
      for (const field of ['title', 'description', 'icon']) {
        if (!metadata[field]?.trim()) {
          issues.push(`MDX page has no ${field} in frontmatter: ${relative(root, file)}`);
        }
      }
    }
    if (!bodyWithoutFrontmatter(content)) issues.push(`MDX page has no body content: ${relative(root, file)}`);
    if (/\bRun API\b/i.test(content)) issues.push(`Legacy product name "Run API" found in ${relative(root, file)}.`);
  }

  for (const policyPage of policyPages) {
    const content = readFileSync(join(root, policyPage), 'utf8');
    const metadata = frontmatter(content);
    if (!metadata?.icon) issues.push(`Policy page has no navigation icon: ${policyPage}.`);
    if ((content.match(/^<Note>$/gm) ?? []).length !== 1) {
      issues.push(`Policy page must contain exactly one top-level revision Note: ${policyPage}.`);
    }
    if (!/^## Revision History$/m.test(content) || !/^\| Version \| Date \| Status \| Changes \|$/m.test(content)) {
      issues.push(`Policy page does not use the canonical revision history format: ${policyPage}.`);
    }
    if (/^## Definitions?$/m.test(content) && !/^## Definitions$/m.test(content)) {
      issues.push(`Policy page must use the canonical "Definitions" heading: ${policyPage}.`);
    }
  }

  const declarationSnapshot = join(root, 'low-code', 'reference', 'source', 'api.public.d.ts');
  const deprecatedMethods = deprecatedLowCodeMethods(readFileSync(declarationSnapshot, 'utf8'));
  for (const method of deprecatedMethods) {
    const pattern = new RegExp(`\\b${method.replace('.', '\\.')}(?![A-Za-z0-9_$])`);
    for (const file of mdxFiles) {
      const content = readFileSync(file, 'utf8');
      if (pattern.test(content) && !permitsHistoricalMethod(relative(root, file).replaceAll('\\', '/'), method, content)) {
        issues.push(`Deprecated low-code method ${method} is published in ${relative(root, file)}.`);
      }
    }
  }

  const generatedReference = join(root, 'api-reference', 'openapi.json');
  if (statSync(generatedReference).isFile() && /\bRun API\b/i.test(readFileSync(generatedReference, 'utf8'))) {
    issues.push('Legacy product name "Run API" found in api-reference/openapi.json.');
  }

  if (issues.length > 0) throw new Error(`Content quality gate failed:\n- ${issues.join('\n- ')}`);
  console.log(`Content quality passed: ${mdxFiles.length} non-empty MDX pages, complete navigation, current terminology.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
