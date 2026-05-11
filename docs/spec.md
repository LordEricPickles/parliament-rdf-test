# Parliament RDF Graph Viewer Spec

## Purpose

A small personal demo application for exploring UK Parliament RDF and linked data in the browser.

The project exists to:

- Experiment with RDF and JSON-LD
- Explore graph visualisation techniques
- Learn how coding agents like Codex behave in a spec-driven workflow
- Keep implementation intentionally lightweight and understandable

This is not intended to become a large production application.

---

# Current scope

The current version of the app should:

1. Search for parliamentarians using Parliament APIs.
2. Resolve a selected result to an RDF resource URI.
3. Fetch and parse RDF/JSON-LD client-side.
4. Render the RDF graph visually.
5. Allow node inspection.
6. Display relevant metadata and triples.

The app currently focuses on MPs/parliamentarians, but future experiments may include other Parliament RDF resources.

The app should render one fetched graph at a time.

---

# Non-goals

The app does not currently need:

- Authentication
- User accounts
- Persistent storage
- Server-side infrastructure
- Complex state management
- Real-time collaboration
- Recursive graph crawling
- Multi-resource graph merging
- Enterprise-scale architecture

Future ideas should remain out of scope until explicitly promoted into the current scope section.

---

# Technical direction

Current stack:

- React
- TypeScript
- Vite
- RDFLib
- Cytoscape

The app should remain client-side/static unless there is a strong reason to introduce backend infrastructure.

Prefer:

- Simple components
- Clear data flow
- Minimal abstraction
- Small dependency footprint

Avoid introducing patterns that make the app harder to understand than the underlying RDF problem itself.

---

# UI direction

Keep the current demo/data-explorer aesthetic unless there is a specific reason to change it.

Prioritise:

- Readability
- Graph clarity
- Fast iteration
- Inspectability of RDF structures

Do not optimise for institutional branding or polished enterprise UX.

---

# Future experiments

Interesting future directions include:

- Generic RDF URI loading
- Additional Parliament RDF resource types
- Expanding linked resources from nodes
- Better graph filtering and clustering
- Export/share functionality
- RDF explanation/glossary helpers

These are exploratory ideas, not implementation requirements.

---

# Change process

When changing intended behaviour:

1. Update this spec first (or in the same commit).
2. Keep changes small and reversible.
3. Prefer incremental evolution over redesigns.
4. Run `npm run verify` before considering work complete.
