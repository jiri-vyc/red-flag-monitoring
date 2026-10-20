import { FauReportScreen } from "@/features/fauReports/components/FauReportScreen";

export default async function FauReportPage({ params }: PageProps<"/fau-reports/[reportId]">) {
  const { reportId } = await params;
  return <FauReportScreen reportId={reportId} />;
}
