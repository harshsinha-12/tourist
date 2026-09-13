import { TouristShell } from "../components/TouristShell";
import { fixtureReport } from "../lib/fixture-report";

export default function HomePage() {
  return <TouristShell report={fixtureReport} />;
}
