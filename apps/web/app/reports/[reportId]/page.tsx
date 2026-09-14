import { notFound } from "next/navigation";
import { TouristShell } from "../../../components/TouristShell";
import { LOCAL_REPORT_ID, loadLocalRepositoryReport } from "../../../lib/fixture-report";

export const dynamic = "force-static";
export const revalidate = false;
export const dynamicParams = false;

export function generateStaticParams() {
  return [{ reportId: LOCAL_REPORT_ID }];
}

export default async function ReportPage({ params }: { params: Promise<{ reportId: string }> }) {
  const report = await loadLocalRepositoryReport();
  const { reportId } = await params;
  if (reportId !== report.id) notFound();
  return <TouristShell report={report} />;
}
