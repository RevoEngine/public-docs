#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const referenceRoot = join(root, 'low-code', 'reference');
const snapshot = join(referenceRoot, 'source', 'api.public.d.ts');
const surfaces = [
  ['api', 'api reference', 'Execution, platform, Database, HTTP, automation, and compatibility methods.'],
  ['storage', 'storage reference', 'Explorer Storage folders, objects, sessions, downloads, retention, and lifecycle methods.'],
  ['transport', 'transport reference', 'Storage-only protocol adapters with Secret-backed connections.'],
  ['agent', 'agent reference', 'Durable Agent, inbox, run, plugin, and Assistant-thread methods.'],
  ['util', 'util reference', 'Validation, timing, identifiers, encoding, hashing, signatures, JWT, and crypto helpers.'],
];

function replaceMethodDocumentation(source, methodName, documentation) {
  const signatureStart = source.indexOf(`static ${methodName}`);
  if (signatureStart === -1) return source;
  const docsStart = source.lastIndexOf('/**', signatureStart);
  const docsEnd = source.indexOf('*/', docsStart);
  if (docsStart === -1 || docsEnd === -1 || docsEnd > signatureStart) return source;
  if (/@deprecated\b/i.test(source.slice(docsStart, docsEnd))) return source;
  const formatted = documentation
    .trim()
    .split('\n')
    .map((line) => ` *${line ? ` ${line}` : ''}`)
    .join('\n');
  return `${source.slice(0, docsStart)}/**\n${formatted}\n */${source.slice(docsEnd + 2)}`;
}

function publicMethodContract(source) {
  const classes = surfaces
    .filter(([global]) => source.includes(`declare class ${global} {`))
    .map(([global]) => {
    const declarations = methods(source, global).map((method) => {
      const documentation = `/**${method.docs}*/`
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      const signature = method.signature
        .split('\n')
        .map((line) => `  ${line}`)
        .join('\n');
      return `${documentation}\n${signature}`;
    });
    return `declare class ${global} {\n${declarations.join('\n\n')}\n}`;
    });

  return `/**\n * Generated public low-code method contract used by the documentation reference.\n */\n${classes.join('\n\n')}\n`;
}

/**
 * The canonical declaration also feeds private editor and runtime tooling. Keep
 * its public type contract while removing build topology and replaceable
 * implementation choices before committing a documentation snapshot.
 */
export function sanitizeDeclarationSource(source) {
  let output = source
    .replace(/^\/\*\*[\s\S]*?Canonical public low-code API declarations[\s\S]*?\*\/\s*/i, '')
    .replace(/^\/\/\/\s*<reference\s+path=["'][^"']+["']\s*\/?>\s*$/gm, '')
    .replace(/The backend fetches one extra row internally to determine next-page availability\./g, 'Pagination reports whether more rows are available.')
    .replace(/Full internal query shape used by the ORM service\.\s*\n\s*\* Unlike SelectInput, this includes from\.definition metadata\./g, 'Complete structured query shape, including source definition metadata.')
    .replace(/The Swagger DTO requires/g, 'The public contract requires')
    .replace(/\n{3,}/g, '\n\n');

  output = replaceMethodDocumentation(output, 'getContext', `
Returns the current execution context.

Example:
const ctx = api.getContext();`);
  output = replaceMethodDocumentation(output, 'executeComponent', `
Executes another active component in the managed RevoEngine runtime and returns its execution result.

Notes:
- Supports CODE_JS, CODE_TS, and CUSTOM_NODEJS components.
- CODE_JS and CODE_TS run in a fresh isolated execution on the current host by default.
- Set options.executionHost to "remote" to use the separate Sandbox host.
- CUSTOM_NODEJS runs in its governed RevoEngine component environment.
- If timeoutMs is omitted, the child receives the parent execution's remaining timeout budget.
- A larger timeoutMs is clamped to that remaining budget.
- Nesting is limited to five levels across local, remote and custom component calls.
- At least 1 second of parent budget is required for remote Sandbox calls.
- Promise.all() starts independent child component executions.

Example:
const [pricing, taxes] = await Promise.all([
  api.executeComponent({ componentId: pricingComponentId, inputs: { customerId }, timeoutMs: 9000 }),
  api.executeComponent({ componentId: taxComponentId, inputs: { customerId }, timeoutMs: 9000 }),
]);`);
  output = replaceMethodDocumentation(output, 'acquireIdempotencyKey', `
Acquires an idempotency key in the instance-scoped managed cache.

Notes:
- No-op in debug mode.

Example:
const first = await api.acquireIdempotencyKey('orders:123', 600, { state: 'running' });`);
  output = replaceMethodDocumentation(output, 'sftpPut', `
Streams an Explorer Storage entry directly to SFTP without loading file bytes into low-code memory.

Notes:
- No-op in debug mode.
- Prefer { storageEntryId } for Explorer Storage files. String inputs are legacy fileIds.
- SFTP references use Explorer Storage; namespace is not part of this API.

Example:
await api.sftpPut({ storageEntryId }, '/outbound/report.csv', connection);`);
  output = replaceMethodDocumentation(output, 'sftpGet', `
Streams an SFTP file directly into Explorer Storage and returns the finalized Storage entry.

Notes:
- No-op in debug mode.
- Use { storage: ... } to create an entry or { storageEntryId, replace: true } to replace one.
- Repeated finalization signals are idempotent.
- For text files, computeStats: 'sync' makes line statistics available immediately.

Example:
const result = await api.sftpGet({
  storage: {
    name: 'daily.csv',
    parentStorageEntryId: folderId,
    contentTypeHint: 'text/csv',
    computeStats: 'sync',
    retention: { ttlSeconds: 604800 },
  },
}, '/incoming/report.csv', connection);`);

  return publicMethodContract(output.trimStart());
}

function canonicalSource(sourceArg) {
  return [
    sourceArg,
    process.env.REVOENGINE_LOW_CODE_DECLARATIONS,
  ].filter(Boolean).find(existsSync);
}

function sourceFlagValue(argv) {
  const index = argv.indexOf('--source');
  return index === -1 ? undefined : argv[index + 1];
}

function classBody(source, className) {
  const start = source.indexOf(`declare class ${className} {`);
  if (start === -1) throw new Error(`Missing low-code global: ${className}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (!depth) return source.slice(open + 1, index);
    }
  }
  throw new Error(`Unclosed low-code global: ${className}`);
}

function methodEnd(body, start) {
  const depths = { parens: 0, brackets: 0, braces: 0 };
  let quote = null;
  for (let index = start; index < body.length; index += 1) {
    const char = body[index];
    if (quote) {
      if (char === quote && body[index - 1] !== '\\') quote = null;
      continue;
    }
    if (`'\"\``.includes(char)) { quote = char; continue; }
    if (char === '(') depths.parens += 1;
    if (char === ')') depths.parens -= 1;
    if (char === '[') depths.brackets += 1;
    if (char === ']') depths.brackets -= 1;
    if (char === '{') depths.braces += 1;
    if (char === '}') depths.braces -= 1;
    if (char === ';' && !depths.parens && !depths.brackets && !depths.braces) return index + 1;
  }
  throw new Error('Unclosed low-code method signature');
}

function methods(source, global) {
  const body = classBody(source, global);
  const found = [];
  const pattern = /\/\*\*([\s\S]*?)\*\/\s*static\s+([A-Za-z_$][\w$]*)(?:<[\s\S]*?>)?\s*\(/g;
  for (const match of body.matchAll(pattern)) {
    const start = match.index + match[0].lastIndexOf('static');
    found.push({ name: match[2], docs: match[1], signature: body.slice(start, methodEnd(body, start)).trim() });
  }
  return found;
}

function publicMethods(source, global) {
  return methods(source, global).filter((method) => !/@deprecated\b/i.test(method.docs));
}

function clean(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/^\s*\* ?/, '').trimEnd())
    .join('\n')
    .trim();
}

function methodAnchor(global, name) {
  return `${global}-${name}`;
}

function renderMethod(global, method) {
  const docs = clean(method.docs);
  const [description = '', example] = docs.split(/\n\s*Example:\s*\n/i);
  const prose = description
    .replace(/@deprecated\s*/g, '')
    .replace(/\n\s*Migration:\s*[\s\S]*$/i, '')
    .split('\n')
    .filter((line) => !/\bdeprecated\b/i.test(line))
    .join('\n')
    .trim()
    .replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Declaration prose can contain unfenced object examples. Escape JSX delimiters
    // so a JSDoc note can never make the generated MDX invalid.
    .replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
  const exampleSection = example?.trim()
    ? `\n### Example\n\n\`\`\`ts\n${example.trim()}\n\`\`\`\n`
    : '\n<Note>No dedicated example is encoded in the current editor declaration. The signature is authoritative.</Note>\n';
  return `<span id="${methodAnchor(global, method.name)}" aria-hidden="true"></span>\n\n## \`${global}.${method.name}()\`\n\n${prose}\n\n### Signature\n\n\`\`\`ts\n${method.signature}\n\`\`\`${exampleSection}`;
}

function renderSurface([global, title, description], source) {
  const list = publicMethods(source, global);
  const index = list.map(({ name }) => `- [\`${global}.${name}()\`](#${methodAnchor(global, name)})`).join('\n');
  return `---
title: ${title}
description: ${description}
icon: brackets-curly
---

<Note>
  Generated from the same public contract that feeds the Monaco editor. Declaration-marked deprecated compatibility methods are intentionally excluded. Do not edit this page manually.
</Note>

This page contains **${list.length} methods**. Search the docs for an exact method name, or use this index:

${index}

${list.map((method) => renderMethod(global, method)).join('\n')}`;
}

function renderIndex(source) {
  const rows = surfaces.map((surface) => `| [\`${surface[0]}\`](/low-code/reference/${surface[0]}) | ${publicMethods(source, surface[0]).length} | ${surface[2]} |`).join('\n');
  return `---
title: Low-code runtime reference
description: Generated, searchable reference for every public global and method available in the Monaco editor.
icon: book-open
---

The low-code runtime is an isolated execution environment, not Node.js or a browser. This reference is generated from the same canonical declaration source used to create Monaco editor types. It contains only supported public methods, with their current signature, behavior notes, and declaration-provided usage example.

<Tip>
  Search this documentation for an exact method, for example \`api.httpCall\`, \`storage.putObject\`, \`transport.sftpImport\`, \`agent.startRun\`, or \`util.validate\`.
</Tip>

| Global | Methods | Use it for |
| --- | ---: | --- |
${rows}

## Runtime globals

- \`api\` is the main execution and platform surface. Only active methods are published.
- \`storage\` is the canonical Explorer Storage surface for files and objects.
- \`transport\` owns Storage-only protocol adapters. Its SFTP methods resolve connection details from an active Secret reference, so credentials never enter low-code source.
- \`agent\` owns Agent, inbox, run, plugin, and Assistant lifecycle operations. Availability depends on instance policy.
- \`util\` owns validation and security helpers, including hashing, cryptography, encoding, and identifiers.
- Active library declarations are resolved through \`lib.Category.Name.ElementKey.X\`, where \`X\` is an exported function, class, constant, or other public symbol. \`inject()\` reads an earlier element in the same ordered component.

Refresh after a declaration change with \`npm run sync:low-code-reference\`.`;
}

function expected(source) {
  return new Map([
    [join(referenceRoot, 'index.mdx'), renderIndex(source)],
    ...surfaces.map((surface) => [join(referenceRoot, `${surface[0]}.mdx`), renderSurface(surface, source)]),
  ]);
}

export function run(argv = process.argv.slice(2)) {
  const args = new Set(argv);
  const source = canonicalSource(sourceFlagValue(argv));
  if (args.has('--require-source') && !source) {
    throw new Error('Canonical low-code declaration is required but was not found. Pass --source or set REVOENGINE_LOW_CODE_DECLARATIONS.');
  }
  if (args.has('--sync')) {
    if (!source) throw new Error('No canonical low-code declaration found. Pass --source or set REVOENGINE_LOW_CODE_DECLARATIONS.');
    mkdirSync(dirname(snapshot), { recursive: true });
    writeFileSync(snapshot, sanitizeDeclarationSource(readFileSync(source, 'utf8')));
  }
  if (!existsSync(snapshot)) throw new Error('Missing declaration snapshot. Run npm run sync:low-code-reference.');

  let stale = false;
  if (args.has('--check')) {
    if (source && readFileSync(snapshot, 'utf8') !== sanitizeDeclarationSource(readFileSync(source, 'utf8'))) {
      console.error(`Stale declaration snapshot: ${snapshot}. Run npm run sync:low-code-reference.`);
      stale = true;
    }
  }
  for (const [file, content] of expected(readFileSync(snapshot, 'utf8'))) {
    if (args.has('--check')) {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== content) { console.error(`Stale generated reference: ${file}`); stale = true; }
    } else {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file, content);
    }
  }
  if (stale) process.exitCode = 1;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
