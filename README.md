# RevoEngine public documentation

This repository contains the public RevoEngine documentation built with the current Mintlify `docs.json` format.

Current product documentation: **RevoEngine 1.5.8**, including Node.js SDK **1.5.8**.

## Local preview

Requirements: Node.js 20 or newer.

```bash
npm run dev
```

The preview is available at `http://localhost:3010`. If port 3010 is occupied,
the command exits instead of starting on another port.

## Quality checks

```bash
npm run check
```

Focused checks are also available as `npm run test:openapi`,
`npm run check:platform-contracts`, `npm run check:content`, `npm run validate`,
`npm run check:links`, and `npm run check:a11y`.

## Content model

- `platform/` explains the product, UI, architecture, environments, and governance.
- `build/` and `low-code/` document authoring and runtime programming models.
- `operate/` covers endpoints, data, storage, automation, realtime, and operations.
- `ai/` covers the Assistant, agentic coding, autonomous Agents, tools, skills, plugins, memory, and approvals.
- `developers/` covers API boundaries, the Node.js SDK, and the CLI.
- `api-reference/openapi.json` is the generated Platform API contract used by Mintlify.
- `api-reference/source/platform.openapi.json` is the script-managed, sanitized public snapshot derived from the release contract. Do not edit either OpenAPI file manually.
- `platform-contracts.json` records the public snapshots, generated artifacts, and Platform API operation count without embedding private source metadata.
- `resources/` contains legal and support documents.

## Source-of-truth rules

Product guides explain stable, customer-visible behavior. Exact request and response fields belong to the generated OpenAPI reference. Never copy credentials, internal infrastructure identifiers, private prompts, provider payloads, or source code into this repository.

When a platform contract changes, update the implementation, generated OpenAPI, relevant SDK or CLI README, and the matching public guide together.

## Platform contract synchronization

The public API and Low-Code reference are one release contract. The release pipeline
must explicitly provide both canonical inputs through `REVOENGINE_PLATFORM_OPENAPI`
and `REVOENGINE_LOW_CODE_DECLARATIONS`; this public repository does not assume or
publish a private source-tree layout. Refresh both sanitized snapshots, generated
references, and `platform-contracts.json` with:

```bash
npm run sync:platform-contracts
```

Individual generators remain available for focused development:

```bash
npm run sync:openapi -- --source /path/to/platform.openapi.json
npm run sync:low-code-reference -- --source /path/to/api.public.d.ts
```

The OpenAPI generator first builds a deterministic, commit-safe public projection and
writes that projection as the source snapshot. It then applies documentation
enrichment to the published contract. The projection and enrichment:

- publish only `/api/v1/*` operations from the supplied contract;
- replaces the local server with the production Platform API origin;
- removes build provenance, private extensions, environment-only branches, provider details, and non-public runtime diagnostics before either OpenAPI artifact is written;
- records only public artifact paths and the published operation count in `platform-contracts.json`;
- adds reviewed summaries for controller operations whose Swagger decorators are incomplete;
- adds scoped descriptions to every operation missing one;
- declares and describes every used OpenAPI tag;
- adds bearer security metadata to protected Agent and Agent Memory operations whose controllers enforce `GlobalGuard` and `RolesGuard` but do not emit `@ApiBearerAuth()` metadata;
- documents the approved per-instance Job ceilings of 3540 seconds and 4096 MiB while runtime/UI enforcement is aligned separately.

`npm run check:platform-contracts` regenerates both contracts in memory from their
checked-in public snapshots and verifies the manifest. It also sanitizes and compares
explicitly supplied canonical inputs whenever they are available. The OpenAPI gate
rejects non-public metadata, missing summaries, descriptions or explicit security
metadata, unknown security schemes, duplicate operation IDs, missing tag descriptions,
and path/method drift.

Before any documentation publication, the release pipeline **must** run:

```bash
npm run check:platform-contracts:source
```

That source-backed gate fails if either canonical release input is unavailable or
its snapshot has drifted. Public-repository CI runs the snapshot-to-generated
`check:platform-contracts` gate. The
`Platform contract synchronization` dispatch workflow provides the same credential-free
verification on demand; it does not replace the mandatory source-backed publication
gate.

`npm run check:content` rejects empty MDX pages, incomplete or invalid navigation,
duplicate navigation entries, and the retired `Run API` product name in published
content or the generated OpenAPI reference.
