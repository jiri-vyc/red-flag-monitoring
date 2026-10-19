import { PolicyDetailScreen } from "@/features/policies/components/PolicyDetailScreen";

export default async function PolicyDetailPage({ params }: PageProps<"/policies/[policyId]">) {
  const { policyId } = await params;
  return <PolicyDetailScreen policyId={policyId} />;
}
