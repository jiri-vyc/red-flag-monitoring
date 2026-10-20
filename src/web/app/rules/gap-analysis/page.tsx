import { GapAnalysisScreen } from "@/features/ruleReviews/components/GapAnalysisScreen";

const REVIEW_ID_PATTERN = /^[0-9a-f-]{36}$/;

export default async function GapAnalysisPage({ searchParams }: PageProps<"/rules/gap-analysis">) {
  const { review } = await searchParams;
  return (
    <GapAnalysisScreen
      requestedReviewId={typeof review === "string" && REVIEW_ID_PATTERN.test(review) ? review : null}
    />
  );
}
