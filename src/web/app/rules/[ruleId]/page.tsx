import { RuleDetailScreen } from "@/features/rules/components/RuleDetailScreen";
import { readReturnPath, RETURN_PATH_PARAM } from "@/lib/returnPath";

export default async function RuleDetailPage({ params, searchParams }: PageProps<"/rules/[ruleId]">) {
  const { ruleId } = await params;
  const { [RETURN_PATH_PARAM]: returnPath } = await searchParams;
  return <RuleDetailScreen ruleId={ruleId} returnPath={readReturnPath(returnPath)} />;
}
