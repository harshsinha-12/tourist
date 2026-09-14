import { generateCitySnapshot } from "@tourist/world-generator";
import { TouristShell } from "../../components/TouristShell";
import { createRepositoryReport } from "../../lib/fixture-report";

export default async function QACity({ searchParams }: { searchParams: Promise<{ count?: string }> }) {
  const count = Math.min(1000, Number((await searchParams).count ?? 277));
  const types = [["ts", "TypeScript"], ["py", "Python"], ["css", "CSS"], ["go", "Go"], ["md", "Markdown"], ["json", "JSON"]] as const;
  const snapshot = generateCitySnapshot({ id: "visual-qa", repository: { name: `Visual QA · ${count} files`, revision: "synthetic fixture" },
    files: Array.from({ length: count }, (_, i) => ({ path: `package-${i % 7}/module-${i % 13}/file-${i}.${types[i % types.length]![0]}`,
      language: types[i % types.length]![1], kind: "source" as const, linesOfCode: 100, changeFrequency: 0, state: "idle" as const })) });
  return <TouristShell report={createRepositoryReport({
    id: "visual-qa",
    title: `Visual QA · ${count} files`,
    summary: "Synthetic city used to stress layout, streets, and decorations.",
    createdAt: "2026-09-11T12:00:00.000Z",
    snapshot,
    sections: [],
  })} />;
}
