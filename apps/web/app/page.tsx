import { TouristShell } from "../components/TouristShell";
import { loadLocalRepositoryReport } from "../lib/fixture-report";

export default async function HomePage() {
  return <TouristShell report={await loadLocalRepositoryReport()} />;
}
