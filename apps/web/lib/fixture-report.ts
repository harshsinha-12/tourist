import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { PublicReportSchema, type PublicReport } from "@tourist/protocol";
import { generateCitySnapshot } from "@tourist/world-generator";
import { scanLocalRepository } from "./scan-local-repo";

const execFileAsync = promisify(execFile);
const REPORT_ID = "tourist-city-foundation";

export async function loadLocalRepositoryReport(): Promise<PublicReport> {
  const root = await repositoryRoot();
  const { name, revision, files, changedPaths } = await scanLocalRepository(root);
  const snapshot = generateCitySnapshot({
    id: "tourist-local-v1",
    repository: { name, revision },
    files,
    report: {
      changedPaths,
      anchorPaths: [
        "apps/web/components/CityCanvas.tsx",
        "packages/protocol/src/index.ts",
        "scripts/prepare-building-sprites.py",
      ],
      includeTests: true,
      includePullRequest: true,
    },
  });
  const sectors = snapshot.sectors.map((sector) => sector.name).join(", ");
  return PublicReportSchema.parse({
    id: REPORT_ID,
    title: `${name} as a city`,
    summary: `${snapshot.buildings.length} source files are on the island, grouped into ${snapshot.sectors.length} sectors (${sectors || "root"}). Gitignored paths, images, and generated sprites stay off the map.`,
    createdAt: new Date().toISOString(),
    snapshot,
    sections: [
      {
        id: "section-viewer",
        eyebrow: "City viewer",
        title: "Every kept file has a plot",
        body: "The island is generated from this repository’s source tree. Scripts, packages, apps, and docs become buildings; images and generated assets do not.",
        status: "success",
        anchorId: snapshot.anchors.find((anchor) => anchor.id.includes("citycanvas"))?.id ?? "anchor-tests",
      },
      {
        id: "section-scripts",
        eyebrow: "Scripts",
        title: "Prepare jobs live on the island too",
        body: "Python and Node scripts under scripts/ are first-class buildings, the same as application source.",
        status: "success",
        anchorId: snapshot.anchors.find((anchor) => anchor.id.includes("prepare-building-sprites"))?.id ?? snapshot.anchors[0]?.id ?? "anchor-tests",
      },
      {
        id: "section-tests",
        eyebrow: "Verification",
        title: "The generator is deterministic",
        body: "Tests cover stable output, unique plots, folder mapping, and the inventory filters that drop media and ignored paths.",
        status: "success",
        anchorId: "anchor-tests",
      },
      {
        id: "section-pr",
        eyebrow: "Delivery",
        title: "Ready for a public GitHub URL",
        body: "The same inventory rules can later accept a GitHub tree listing. This stage maps only the local working copy.",
        status: "neutral",
        anchorId: "anchor-pull-request",
      },
    ],
  });
}

export function createRepositoryReport(report: PublicReport): PublicReport {
  return PublicReportSchema.parse(report);
}

async function repositoryRoot(): Promise<string> {
  const start = process.cwd();
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd: start, encoding: "utf8" });
    return stdout.trim() || start;
  } catch {
    return start;
  }
}
