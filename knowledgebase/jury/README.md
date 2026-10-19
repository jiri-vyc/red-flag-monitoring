# Hackathon jury – who scores our pitch

High-level profiles of the 8 jury members of The FinTechers hackathon (Prague, 19–20 October 2026), for reviewing our presentation. The goal: every juror understands the pitch and hears an answer to the question their role makes them ask.

Source: [thefintechers.com/hackathon](https://thefintechers.com/hackathon) (section Mentors / Jury), plus public professional sources (company sites, press releases). Researched 2026-10-19. Only public professional information; no contact details.

## Pitch format and scoring

- Live on stage: **4 min demo + 3 min jury questions**. The live pitch is the demo; no video or one-pager.
- Code freeze 13:30, live demos 15:00–17:00, jury deliberation 17:00–17:30.
- One ranking across all categories and tracks. Every team is scored by the same jury on the same criteria:

| Criterion | Weight | Jury question |
| --- | --- | --- |
| Impact and relevance | 25 % | Does it solve a real financial-services problem, on the chosen track? |
| Technical execution | 25 % | Does it work, and is gen AI doing real work inside it? |
| Innovation, beyond a GPT wrapper | 20 % | Is it more than a thin GPT wrapper? |
| Responsible AI and compliance | 15 % | Could you explain it, handle its data safely and defend it to a regulator? |
| Business viability and pitch | 15 % | Would anyone pay for it, and did you make the case? |

## Jury at a glance

| Juror | Organisation | Role | Lens |
| --- | --- | --- | --- |
| Jan Bridzik | Czech National Bank (ČNB) | Director of ICT Risk Control and AML/CFT Supervision | Regulator, AML + ICT risk |
| Jiří Raška | Partners Banka | CTO & Co-Founder | Bank tech leader |
| Martin Gerneš | Komerční banka | Data platform tribe lead | Bank data platform |
| Kamil Olszynski | Deloitte | Partner, bank transformation | Consulting, business case |
| Tomáš Bubeník | Deloitte | Director, Technology Transformation Consulting, AWS Alliance Central Europe | Consulting, cloud/AI delivery |
| Vyasaraj Kulkarni | AWS | Enterprise Technology and AI leader for AI partners, EMEA | Hyperscaler, gen AI architecture |
| Ondřej Kováč | Mastercard | Cyber Security Lead | Security, payments |
| Annalisa Mortellaro | Elevator Ventures | Investment Manager | VC, fintech |

Lens split: 1 regulator, 2 bank practitioners, 2 consultants, 1 hyperscaler, 1 security, 1 investor. Only Bridzik is an AML specialist. The other seven know banking or tech, not AML triage detail.

## Profiles

### Jan Bridzik – Czech National Bank

- **Role:** Director of the ICT and AML/CFT Risk Management Supervision Division (Financial Market Supervision Department II), appointed April 2024. Supervises how regulated institutions manage ICT risk and AML/CFT.
- **Background:** IT by education (University of Defence), Certified Information Systems Auditor (CISA). Auditor/supervisor mindset.
- **Also at the event:** jury + mentor; runs the "Regulatory-change radar" session for Track 5.
- **Domain:** AML/CFT supervision, ICT risk (DORA), IT audit, regulatory expectations on controls.
- **Likely to probe:** Is every decision explainable and auditable? Where is the human in the loop? Who is accountable? How do you prevent the system from auto-closing a real case? Data protection, logging, model risk, how it fits AML Act obligations.
- **For our pitch:** The single most relevant juror for our challenge. Show the decision log and audit trail, not only the UI. Say clearly that the output is a decision aid, the final decision stays with a human. Use correct terms (red flag, false positive, escalation, responsible person, conflict of interest). Do not overclaim regulatory compliance.

### Jiří Raška – Partners Banka

- **Role:** CTO and co-founder of Partners Banka (Czech digital bank, launched 2023). Builds and runs the bank's technology from scratch.
- **Domain:** Modern digital banking architecture, core banking, cloud, delivery speed in a regulated bank.
- **Likely to probe:** How does it plug into an existing transaction-monitoring system and core banking? What does it cost to run per flag? Latency and scale? What would a bank need to change to deploy it?
- **For our pitch:** Show a realistic integration story (input = flags/transactions from existing TM, output = triage + escalation + log). One slide/sentence on architecture and running cost is enough.

### Martin Gerneš – Komerční banka

- **Role:** Data platform tribe lead at Komerční banka (large Czech bank, Société Générale group). Runs data platform teams in an agile tribe setup.
- **Domain:** Enterprise data platforms, data pipelines, data quality, data products at bank scale.
- **Likely to probe:** Where does the data come from, how clean is it, how do you handle data quality and lineage? Does it scale to millions of transactions?
- **For our pitch:** Be explicit about the data flow (dataset → features → rules → LLM triage). Mention data quality handling and that the rule engine is deterministic where it should be.

### Kamil Olszynski – Deloitte

- **Role:** Partner at Deloitte Czech Republic (since October 2023), Consulting, responsible for bank transformation projects (Core Business Operations). Programme lead of Deloitte's Digital Banking Maturity study.
- **Background:** ~18 years in financial services; previously Komerční banka, Accenture, PwC.
- **Domain:** Large bank transformations, operating models, business cases, vendor selection.
- **Likely to probe:** What is the business case (FTE hours saved, false-positive reduction)? Who is the buyer inside a bank? How long to roll out?
- **For our pitch:** Quantify the benefit, even as an estimate with stated assumptions. Name the buyer (Head of AML / MLRO, Compliance) and the pain (alert backlog, cost of analysts, regulatory pressure).

### Tomáš Bubeník – Deloitte

- **Role:** Director, Technology Transformation Consulting; leads the Deloitte–AWS alliance for Central Europe (18 countries). Previously Senior Manager in Deloitte AI & Data, before that AWS alliance lead at ALEF.
- **Domain:** Cloud migrations, data and analytics, AI delivery on AWS, partner go-to-market.
- **Likely to probe:** Is the AWS architecture production-grade? How would a consultancy/integrator deliver it to a bank client?
- **For our pitch:** Show the AWS stack (Bedrock, Lambda, Aurora) and why it is AWS-native. Path from hackathon to a client PoC.

### Vyasaraj Kulkarni – AWS

- **Role:** Enterprise Technology and AI leader for AI partners, EMEA at AWS. Works with AWS's AI partner ecosystem.
- **Background:** Not verified from public sources. Possibly earlier in financial-services software (unconfirmed, do not rely on it).
- **Domain:** Gen AI on AWS, Bedrock, agentic architectures, partner solutions.
- **Likely to probe:** What is the model actually doing? Why gen AI and not just rules? How do you evaluate quality and control hallucinations? Is it more than a GPT wrapper?
- **For our pitch:** Clear split of what rules do vs. what the LLM does. Mention evaluation (test set, accuracy vs. known outcomes) and guardrails. Non-Czech speaker: pitch in English, no Czech-only terms or untranslated legal abbreviations.

### Ondřej Kováč – Mastercard

- **Role:** Cyber Security Lead (Business Development, CZ & SK) at Mastercard. Background in security sales/consulting (XDR, SIEM, SOAR, ISO 27001, NIST 800-53).
- **Domain:** Cyber security, security operations, fraud prevention in payments, security compliance.
- **Likely to probe:** Data security and access control, prompt injection, who can see what, tamper-proof audit log, analogy to a SOC alert-triage workflow.
- **For our pitch:** AML alert triage is the same problem as SOC alert fatigue; this analogy lands with him. One line on security: data stays in AWS account, IAM auth, no data leaves to external LLM APIs.

### Annalisa Mortellaro – Elevator Ventures

- **Role:** Investment Manager (previously Associate) at Elevator Ventures, the corporate VC of Raiffeisen Bank International (>€100M, fintech and beyond-banking). Based in Vienna. Education: Politecnico di Milano.
- **Also at the event:** jury + mentor.
- **Domain:** Early-stage fintech investing, bank–startup partnerships (Raiffeisen network).
- **Likely to probe:** Market size, who pays and how much, why now, differentiation vs. existing AML vendors, team and path after the hackathon.
- **For our pitch:** One crisp problem/market statement, the buyer, a pricing idea, and why AMLA/regulatory pressure makes this urgent now. Non-Czech speaker: English, explain AML basics in one sentence.

## Implications for our presentation

1. **English, plain words.** At least two jurors are not Czech speakers, and seven of eight are not AML specialists. Explain "red flag", "false positive" and "escalation" in one sentence each at the start.
2. **Open with the pain in numbers.** Alert volume vs. analyst capacity, share of false positives, time per alert. This serves Olszynski, Mortellaro and Raška (impact + business viability = 40 %).
3. **Show the audit trail live.** Decision log with who/when/why, human sign-off, responsible person per escalation matrix. This is what Bridzik and Kováč look for (responsible AI and compliance = 15 %, and Bridzik's opinion carries weight on our track).
4. **Make the gen AI part visible.** Rules generate flags deterministically; the LLM triages, justifies and drafts. Show one flag end-to-end with the model's reasoning. This answers "beyond a GPT wrapper" for Kulkarni and Bubeník (20 %).
5. **One architecture slide.** AWS-native (Bedrock, Lambda, Aurora), data stays in the account, IAM auth. Serves Raška, Gerneš, Bubeník, Kulkarni, Kováč.
6. **Decision aid, not a decision maker.** Say it explicitly. Never claim the tool makes compliance decisions or guarantees regulatory compliance.
7. **Prepare Q&A answers** for the 3 minutes, one per lens:
   - Regulator: "How do you prove to ČNB why a flag was closed?"
   - Bank tech: "How does it integrate with our TM system and what does it cost per alert?"
   - Data: "How do you handle bad or missing data?"
   - Gen AI: "How do you measure accuracy and stop hallucinations?"
   - Security: "Where does client data go?"
   - Business: "Who pays, how much, and why would they switch?"

## Not on the jury, but relevant

- **Cedric Maloux** (StartupYard partner, founder of The FinTechers) – master of ceremonies and mentor; runs the pitch clinic on day 2 (13:30–14:30, comes to the table).
- **Oliver Zrno** (FINREG PARTNERS, crypto-assets and financial innovation) – mentor from the challenge owner.
- **Jan Koník, Václav Tětek** (ČNB) – mentors.

## Sources

- [The FinTechers – hackathon page](https://thefintechers.com/hackathon)
- [ČNB – management changes in Financial Market Supervision Department II](https://www.cnb.cz/en/cnb-news/press-releases/Management-changes-innbspFinancial-Market-Supervision-Department-II-divisions)
- [Deloitte – Tomáš Bubeník profile](https://www.deloitte.com/ce/en/about/people/profiles.tbubenik+b672bb3d.html)
- [Deloitte – Kamil Olszynski appointed partner (press release)](https://www.deloitte.com/cz-sk/cs/about/press-room/consulting-v-deloitte-posiluje-novy-partner-kamil-olszynski-bude-zodpovidat-za-transformacni-projekty-bank.html)
- [Partners Banka – press release mentioning CTO Jiří Raška](https://www.partnersbanka.cz/userfiles/tz-novy-cio-partners-7e64e33e.pdf)
- [Dealroom – Elevator Ventures by Raiffeisen Bank International](https://app.dealroom.co/companies/elevator_ventures_by_raiffeisen_bank_international)
- LinkedIn profiles linked from the hackathon page (roles of Gerneš, Kováč, Kulkarni, Mortellaro)
