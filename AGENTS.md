# AGENTS.md

Guidance for Codex and other coding agents working in this repository.

## Project intent

This is a small hobby/demo project for experimenting with UK Parliament RDF data, graph visualisation, and coding-agent workflows. Keep changes pragmatic, understandable, and easy to undo.

Prefer YAGNI and KISS over premature architecture.

## Spec-driven workflow

This repo uses lightweight spec-driven development.

Before changing app behaviour or architecture:

1. Read `docs/spec.md`.
2. Check whether the requested change fits the current spec.
3. If the change alters intended behaviour, update `docs/spec.md` in the same PR/commit.
4. Keep the implementation as small as possible while satisfying the spec.

For intended product behaviour, `docs/spec.md` is the source of truth. This file describes how agents should work; it should not duplicate detailed product requirements.

## Implementation principles

- Keep the app client-only unless the spec explicitly says otherwise.
- Prefer simple React/TypeScript code over extra abstractions.
- Do not add dependencies unless they clearly remove more complexity than they introduce.
- Preserve the current demo-style UI unless the spec asks for a visual change.
- Make RDF concepts visible and inspectable rather than hiding them behind heavy product polish.
- Treat future ideas as non-goals until they are promoted into the current scope section of the spec.

## Useful commands

Install dependencies:

```bash
npm install
```

Run locally:

```bash
npm run dev
```

Verify before considering work complete:

```bash
npm run verify
```

`npm run verify` runs linting, TypeScript/build checks, and a high-severity npm audit.

## Working style

When making a change, include a short summary that covers:

- What changed
- Which part of `docs/spec.md` it implements or updates
- How it was verified

If verification cannot be run, say why.
