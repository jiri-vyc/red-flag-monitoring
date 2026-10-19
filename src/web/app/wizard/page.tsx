import { WizardScreen } from "@/features/wizard/components/WizardScreen";

export default async function WizardPage({ searchParams }: PageProps<"/wizard">) {
  const { regulationId } = await searchParams;
  return <WizardScreen regulationId={typeof regulationId === "string" ? regulationId : null} />;
}
