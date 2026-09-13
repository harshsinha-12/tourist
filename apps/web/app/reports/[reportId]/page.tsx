import { notFound } from "next/navigation";
import { TouristShell } from "../../../components/TouristShell";
import { fixtureReport } from "../../../lib/fixture-report";

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const { reportId } = await params;
  if (reportId !== fixtureReport.id) notFound();
  return <TouristShell report={fixtureReport} />;
}
