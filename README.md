# MP RDF Graph Viewer

Static React/Vite prototype for exploring UK Parliament linked data in the browser.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Verification

```bash
npm run audit:high
npm run verify
```

`npm run build` only compiles the app. `npm run verify` matches the GitHub Pages workflow and runs lint, build, and a high-severity npm audit over the installed dependency tree.

## Data sources

- `https://members-api.parliament.uk/api/Members/Search`
- `https://members-api.parliament.uk/api/Members/{id}/PortraitUrl`
- `https://api.parliament.uk/odata/Member`
- `https://api.parliament.uk/query/resource?uri=...&format=application/ld+json`
