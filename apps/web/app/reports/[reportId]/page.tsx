import { notFound } from "next/navigation";
import { TouristShell } from "../../../components/TouristShell";
import { loadLocalRepositoryReport } from "../../../lib/fixture-report";

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const report = await loadLocalRepositoryReport();
  const { reportId } = await params;
  if (reportId !== report.id) notFound();
  return <TouristShell report={report} />;
}
