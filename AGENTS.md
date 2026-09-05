# RevoEngine public documentation guidelines

This repository documents customer-visible RevoEngine behavior. Write for builders and operators first; use implementation details only to explain a stable contract, failure boundary, or operational decision.

## Source precedence

When updating a page, verify the behavior in this order:

1. current controller or public entry point;
2. owning service and guards/policy;
3. focused tests for validation, errors, and lifecycle behavior;
4. generated OpenAPI, SDK types, or CLI command implementation;
5. internal architecture documents and existing public prose.

OpenAPI is the source for exact HTTP operations and request schemas. Handwritten pages explain mental models, workflows, lifecycle, tradeoffs, and examples.

## Current terminology

- Say **Platform API** for the control-plane API.
- Say **Endpoint runtime** for the HTTP execution surface formerly called Run API.
- Say **Sandbox** for transient/stored component execution, debugging, validation, editor types, SDK runtime calls, and plugin tests.
- Say **Database**, **View**, **Storage**, **Component**, **Endpoint**, **Automation**, **Assistant**, and **Agent** for current product domains.
- Do not reintroduce generic **Resources** or top-level **Schemas** as the platform model.
- Use **Execution ID** for one runtime execution. Mention the deprecated `getJobId()` alias only in compatibility notes.
- Capitalize **Assistant**, **Agent**, **Platform API**, **Storage**, **Sandbox**, and **Web IDE** when referring to RevoEngine products.

## Page structure

Each guide should answer, in this order when applicable:

1. What is this and when should I use it?
2. How does it fit with adjacent RevoEngine features?
3. What is the normal end-to-end workflow?
4. What contract or example does a developer need?
5. What permissions, limits, failure modes, or retry risks matter?
6. Where should the reader go next?

Prefer one useful diagram, table, or example over decorative sections. Do not duplicate generated parameter tables.

## Public boundary

Do not publish:

- source file paths, private prompts, internal tool payloads, or provider request bodies;
- build fingerprints, source hashes, local-only modes, private schema fields, or repository topology;
- infrastructure project names, service credentials, private hostnames, tokens, or signed URLs;
- replaceable infrastructure, library, model, or provider names when they are not a required customer contract;
- internal Agent tool identifiers, routing heuristics, capability-selection algorithms, or rollout mechanics;
- secret values, authorization headers, customer identifiers, or production payloads;
- speculative roadmap behavior presented as available;
- raw implementation details that do not define a customer-visible contract.

Describe stable product abstractions instead: managed V8 runtime, instance cache,
managed concurrent refresh, transcription service, model selected by instance
policy, governed capability families, and public execution lifecycle. A public
Assistant report is user feedback delivered to the RevoEngine team to improve
the Agentic System; never document local report exports or diagnostic capture.

Canonical private sources must be transformed into a public contract before
they are stored in this repository. Never commit a raw internal OpenAPI or
editor declaration merely because its generated customer-facing page is
sanitized.

It is appropriate to explain control-plane versus execution-plane ownership, durable versus transient state, approval boundaries, idempotency, retries, version activation, and trust models.

## Examples

- Use neutral identifiers such as `customer-1`, `orders`, and `https://example.com`.
- Read credentials from environment variables and never show realistic tokens.
- Keep examples minimal but executable against the documented contract.
- Use structured filters and current `storage.*` methods.
- Use the canonical `lib.Category.Name.ElementKey.X` path for active low-code
  libraries. `Category`, `Name`, and `ElementKey` are required namespace
  segments; `X` is the exported function, class, constant, or other public
  symbol. Do not publish shortened `lib.Name.X` or `libs.*` examples.
- Prefer `api.getExecutionId()` over deprecated `api.getJobId()`.
- Note when a sample is illustrative and its exact DTO comes from OpenAPI or generated editor types.

## Required checks

Before merging documentation changes, run the complete repository gate:

```bash
npm run check
```

Before publication from a monorepo checkout, also require the canonical sources:

```bash
npm run check:platform-contracts:source
```

For a changed public API contract, refresh `api-reference/openapi.json` from the generated platform specification and verify that the relevant handwritten workflow page still matches it.

For a changed public API or low-code declaration, run
`npm run sync:platform-contracts` from a checkout that can read both canonical
monorepo sources. It refreshes the checked-in snapshots, generated public
references, and fingerprint manifest. Commit the generated output; CI verifies
snapshot-to-output parity, while the publication pipeline must run the
source-backed gate above to prevent source drift.
