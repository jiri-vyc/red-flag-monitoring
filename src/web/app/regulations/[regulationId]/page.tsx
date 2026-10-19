import { RegulationDetailScreen } from "@/features/regulations/components/RegulationDetailScreen";

export default async function RegulationDetailPage({ params }: PageProps<"/regulations/[regulationId]">) {
  const { regulationId } = await params;
  return <RegulationDetailScreen regulationId={regulationId} />;
}
