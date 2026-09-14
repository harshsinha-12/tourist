import { LandingPage } from "../components/LandingPage";
import { loadLocalRepositoryReport } from "../lib/fixture-report";

export const dynamic = "force-static";
export const revalidate = false;

export default async function HomePage() {
  const report = await loadLocalRepositoryReport();
  return <LandingPage snapshot={report.snapshot} localCityHref={`/reports/${report.id}`} />;
}
