import { notFound } from "next/navigation";
import { BrandMark } from "../../../components/BrandMark";
import { TouristShell } from "../../../components/TouristShell";
import { GitHubImportError, loadGitHubRepositoryReport } from "../../../lib/github-report";
import { parseGitHubRepo } from "../../../lib/github-repo";
import Link from "next/link";

export default async function GitHubCityPage({ params }: { params: Promise<{ owner: string; repo: string }> }) {
  const { owner, repo } = await params;
  const parsed = parseGitHubRepo(`${owner}/${repo}`);
  if (!parsed) notFound();
  try {
    return <TouristShell report={await loadGitHubRepositoryReport(parsed.owner, parsed.repo)} />;
  } catch (error) {
    const message = error instanceof GitHubImportError ? error.message : "Tourist could not map that repository.";
    return (
      <main className="landing-error">
        <a className="brand" href="/"><BrandMark /><span>TOURIST</span></a>
        <h1>{parsed.owner}/{parsed.repo}</h1>
        <p>{message}</p>
        <Link href="/">Back to the landing island</Link>
      </main>
    );
  }
}
