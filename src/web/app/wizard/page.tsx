import { WizardScreen } from "@/features/wizard/components/WizardScreen";

const readParam = (value: string | string[] | undefined) => (typeof value === "string" ? value : null);

export default async function WizardPage({ searchParams }: PageProps<"/wizard">) {
  const { regulationId, jobId } = await searchParams;
  return <WizardScreen regulationId={readParam(regulationId)} jobId={readParam(jobId)} />;
}
