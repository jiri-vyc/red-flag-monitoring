import { BackendStatus } from "@/components/BackendStatus";
import { loadBackendHealth } from "@/lib/backendHealth";

import styles from "./page.module.css";

export default async function HomePage() {
  const backendHealth = await loadBackendHealth();

  return (
    <main className={styles.main}>
      <section className={styles.card}>
        <h1 className={styles.title}>Red-flag monitoring</h1>
        <p className={styles.lead}>
          AML transaction monitoring: rule evaluation, red-flag triage and escalation.
        </p>
        <BackendStatus health={backendHealth} />
      </section>
    </main>
  );
}
