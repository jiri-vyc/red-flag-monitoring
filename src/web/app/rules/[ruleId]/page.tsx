import { RuleDetailScreen } from "@/features/rules/components/RuleDetailScreen";

export default async function RuleDetailPage({ params }: PageProps<"/rules/[ruleId]">) {
  const { ruleId } = await params;
  return <RuleDetailScreen ruleId={ruleId} />;
}
