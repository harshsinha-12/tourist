import { PublicReportSchema, type RepositoryFile } from "@tourist/protocol";
import { generateCitySnapshot } from "@tourist/world-generator";

const files: RepositoryFile[] = [
  { path: "apps/web/app/page.tsx", language: "TypeScript", kind: "source", linesOfCode: 94, changeFrequency: 6, state: "modified" },
  { path: "apps/web/components/CityCanvas.tsx", language: "TypeScript", kind: "source", linesOfCode: 286, changeFrequency: 9, state: "added" },
  { path: "apps/web/components/TouristShell.tsx", language: "TypeScript", kind: "source", linesOfCode: 138, changeFrequency: 5, state: "added" },
  { path: "apps/web/app/styles.css", language: "CSS", kind: "source", linesOfCode: 312, changeFrequency: 4, state: "modified" },
  { path: "apps/web/lib/fixture-report.ts", language: "TypeScript", kind: "data", linesOfCode: 75, changeFrequency: 2, state: "added" },
  { path: "packages/protocol/src/index.ts", language: "TypeScript", kind: "source", linesOfCode: 168, changeFrequency: 8, state: "added" },
  { path: "packages/protocol/test/contracts.test.ts", language: "TypeScript", kind: "test", linesOfCode: 27, changeFrequency: 2, state: "added" },
  { path: "packages/world-generator/src/index.ts", language: "TypeScript", kind: "source", linesOfCode: 244, changeFrequency: 8, state: "added" },
  { path: "packages/world-generator/test/generator.test.ts", language: "TypeScript", kind: "test", linesOfCode: 52, changeFrequency: 2, state: "added" },
  { path: "README.md", language: "Markdown", kind: "documentation", linesOfCode: 342, changeFrequency: 3, state: "idle" },
  { path: "prd.md", language: "Markdown", kind: "documentation", linesOfCode: 2712, changeFrequency: 7, state: "idle" },
  { path: "plan.md", language: "Markdown", kind: "documentation", linesOfCode: 294, changeFrequency: 6, state: "modified" },
  { path: "package.json", language: "JSON", kind: "config", linesOfCode: 19, changeFrequency: 2, state: "added" },
  { path: "tsconfig.base.json", language: "JSON", kind: "config", linesOfCode: 17, changeFrequency: 1, state: "added" },
];

const changedPaths = [
  "apps/web/components/CityCanvas.tsx",
  "packages/protocol/src/index.ts",
  "packages/world-generator/src/index.ts",
];

const snapshot = generateCitySnapshot({
  id: "tourist-foundation-v1",
  repository: { name: "tourist", revision: "city-foundation" },
  generatedAt: "2026-09-11T12:00:00.000Z",
  files,
  report: { changedPaths, includeTests: true, includePullRequest: true },
});

export const fixtureReport = PublicReportSchema.parse({
  id: "tourist-city-foundation",
  title: "The city has its first streets",
  summary: "A deterministic repository map now turns folders into sectors, files into buildings, and engineering evidence into places you can visit.",
  createdAt: "2026-09-11T12:00:00.000Z",
  snapshot,
  sections: [
    {
      id: "section-viewer",
      eyebrow: "City viewer",
      title: "A real place for every file",
      body: "The supplied pixel-art island is now the visual baseline, with repository files and evidence mapped onto its engineering districts.",
      status: "success",
      anchorId: "anchor-file-apps-web-components-citycanvas-tsx",
    },
    {
      id: "section-contract",
      eyebrow: "World contract",
      title: "Snapshots stay useful outside the live app",
      body: "Versioned schemas keep sectors, buildings, landmarks, pawns, and report anchors portable between live runs and public reports.",
      status: "success",
      anchorId: "anchor-file-packages-protocol-src-index-ts",
    },
    {
      id: "section-tests",
      eyebrow: "Verification",
      title: "The generator is deterministic",
      body: "Tests cover stable output, unique plots, folder mapping, changed-file state, and report anchor creation.",
      status: "success",
      anchorId: "anchor-tests",
    },
    {
      id: "section-pr",
      eyebrow: "Delivery",
      title: "Ready for the report-to-PR bridge",
      body: "The harbor anchor is reserved for the later real agent run, without pretending that live GitHub execution exists yet.",
      status: "neutral",
      anchorId: "anchor-pull-request",
    },
  ],
});
