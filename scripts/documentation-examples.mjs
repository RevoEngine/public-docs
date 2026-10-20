import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { permitsHistoricalMethod } from './historical-release-policy.mjs';

export function codeExamples(text) {
  return [...text.matchAll(/^```(js|javascript|ts|typescript)(?:[ \t][^\n]*)?\n([\s\S]*?)^```/gm)]
    .map(match => ({ language: match[1], code: match[2], line: text.slice(0, match.index).split('\n').length + 1 }));
}

export function exampleSyntaxIssues(text) {
  return codeExamples(text).flatMap(example => {
    const signature = /^\s*static\s/.test(example.code);
    const code = signature ? `declare class Signature {\n${example.code}\n}` : example.code;
    const file = ts.createSourceFile('example.ts', code, ts.ScriptTarget.Latest, true,
      example.language.startsWith('t') ? ts.ScriptKind.TS : ts.ScriptKind.JS);
    return file.parseDiagnostics.map(diagnostic => ({
      line: example.line + file.getLineAndCharacterOfPosition(diagnostic.start).line - Number(signature),
      message: ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
    }));
  });
}

export function publicMemberIssues(text, declarations, page) {
  const source = ts.createSourceFile('public.d.ts', declarations, ts.ScriptTarget.Latest, true);
  const classes = new Map();
  source.forEachChild(node => {
    if (ts.isClassDeclaration(node) && node.name) classes.set(node.name.text,
      new Set(node.members.map(member => member.name?.getText(source))));
  });
  const issues = [];
  for (const example of codeExamples(text)) {
    const file = ts.createSourceFile('example.ts', example.code, ts.ScriptTarget.Latest, true);
    const visit = node => {
      if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)
        && ts.isIdentifier(node.expression.expression)) {
        const namespace = node.expression.expression.text, method = node.expression.name.text;
        const name = `${namespace}.${method}`;
        if (classes.has(namespace) && !classes.get(namespace).has(method)
          && !permitsHistoricalMethod(page, name, text)) issues.push({
          line: example.line + file.getLineAndCharacterOfPosition(node.getStart(file)).line,
          message: `${name} is absent from the public declaration.`,
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(file);
  }
  return issues;
}

export function documentationPages(root) {
  const walk = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['.git', 'node_modules', '.mintlify'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : path.endsWith('.mdx') ? [path] : [];
  });
  return walk(root).sort();
}

export function auditExamples(root) {
  const pages = documentationPages(root);
  const declarations = readFileSync(join(root, 'low-code/reference/source/api.public.d.ts'), 'utf8');
  let examples = 0;
  const issues = [];
  for (const path of pages) {
    const text = readFileSync(path, 'utf8');
    examples += codeExamples(text).length;
    for (const issue of [...exampleSyntaxIssues(text), ...publicMemberIssues(text, declarations, relative(root, path))]) {
      issues.push({ page: relative(root, path), ...issue });
    }
  }
  return { pages: pages.length, examples, issues };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = auditExamples(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  if (result.issues.length) {
    for (const issue of result.issues) console.error(`${issue.page}:${issue.line}: ${issue.message}`);
    process.exitCode = 1;
  } else console.log(`Example syntax and public members passed: ${result.examples} JavaScript/TypeScript blocks across ${result.pages} pages, including generated signatures.`);
}
