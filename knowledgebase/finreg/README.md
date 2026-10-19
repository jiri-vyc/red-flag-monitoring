# FINREG PARTNERS – AML challenge briefing

Summary of the challenge briefing slides by FINREG PARTNERS (Track 5 · Compliance and RegTech copilots). Prize: CZK 40,000 in FINREG legal services. Source photos are in this folder; each section links to its slide.

## The question

[Slide 06](06-challenge-triage-escalation.jpg)

AML transaction monitoring produces far more red flags than AML staff can process. Many are false positives, and the real ones must reach the right person in time without conflicts of interest.

> Can an automated system save AML staff time, relay important flags to the right people, and keep every decision explainable, justified and auditable?

## What to build

An automated system that:

1. **Generates red flags** under the ruleset (rules A–C below, plus any further flags we identify).
2. **Sorts, rates and escalates** each red flag. For every flag it must:

| # | Step | Requirement |
| --- | --- | --- |
| 01 | Triage decision | `FP` (false positive) or `REVIEW` (requires human oversight). Justify by specific grounds: client profile, client history, AML risk score, client type, relationship specifics. No flag is decided without a decision log. |
| 02 | Priority (0–100) | Risk factors: AML risk score, PEP, country, amount/volume, client conduct discrepancies, length of relationship, form of contract conclusion, several flags on the same client. |
| 03 | Responsible person | The person who ultimately decides on the flag, per the escalation matrix and conflict-of-interest rules. |
| 04 | Final decision log | Who, when, why. This is the basis of the audit log. |

Scope: the challenge covers steps 03–05 of the control loop (Review → Escalate → Audit), see [slide 03](03-tm-ruleset-control-loop.jpg).

## Red flag identification ruleset

[Slide 08](08-red-flag-ruleset.jpg)

| Rule | Name | Alert granularity | Trigger | Note from FINREG |
| --- | --- | --- | --- | --- |
| **A** | Discrepancy of client profile | one alert per client | Any of: (a) daily volume in July 2026 > 25 % of projected monthly volume; (b) daily volume > 3× average daily volume of Q2 2026; (c) single transaction > 2× the maximum transaction of Q2 2026. Clients inactive in Q2 2026 are compared with projected volumes only. | Most alerts, highest false-positive share. Tests triage against the client profile. |
| **B** | Shady jurisdiction / PEP | one alert per transaction | Any of: (a) transaction > CZK 10,000 where the payer, payee or client country is on the EU or FATF high-risk jurisdiction list; (b) outgoing transaction of a PEP client > CZK 100,000 (a transaction with unclear direction counts as outgoing). | Few alerts, high severity. Tests prioritisation and escalation to the right level. |
| **C** | Flow-through account | one alert per client | Within 24 h the client receives incoming payments > CZK 100,000, and within 6 h sends outgoing payments of at least 80 % of that amount to another account (not the payer's). | Typical mule pattern. Tests intraday flows and combining risk factors. |

- If we find further red flags, include them as well.
- FINREG recommendation: use AI for decision-making and ruleset navigation, **not** for analysing every row of data. Rule detection is deterministic code; the LLM triages, prioritises and justifies.

## Data

[Slide 07](07-data.jpg)

**Payment transaction log** (July 2026, approx. 400,000 rows)
- Transaction ID, client ID
- Date, time
- Volume, currency
- Payer country, payee country
- Anonymised payer and payee account numbers
- Transaction type

**Client log** (one row per client)
- Client ID, client country
- Date and form of contract conclusion
- PEP (yes/no)
- Client type: natural person / natural person in a business capacity / legal person
- Projected volume (CZK) and number of transactions at contract conclusion
- Actual volume (CZK), number and maximum transaction amount, Q2 2026
- AML risk score; other statistical data (e.g. MCC), if available

**Conventions** (unless the briefing says otherwise)
- Convert all transaction volumes to CZK.
- Client volume = sum of all the client's transactions regardless of direction (in + out).
- Escalation matrix and conflict-of-interest rules are provided at the initial briefing.
- Public sources: EU and FATF high-risk jurisdiction lists.

## Output and deliverables

[Slide 09](09-deliverables-evaluation.jpg)

**Mandatory CSV, one row per alert:**

| Column | Meaning |
| --- | --- |
| `alert_id`, `alert_type`, `client_id`, `transaction_id` | Identification |
| `triage` | `FP` / `REVIEW` |
| `priority` | 0–100 |
| `executive_role`, `executive_person` | Who decides |
| `approver` | Second pair of eyes (4-eyes principle) |
| `reason` | Justification (text) |
| `log` | Decision log |

**Deliver with the CSV:**
- Code and the mandatory CSV
- Demo, max. 5 minutes
- Description of the decision logic, supported by the data used, focused on points 01–04 above. Max. 2 pages.

## Evaluation

| Weight | Criterion | How judged |
| --- | --- | --- |
| **40 %** | Triage and priority correctness | Sample of 30–45 alerts (10–15 per type) |
| **20 %** | Correctness of escalation | Compared with the escalation matrix and conflict-of-interest rules |
| **25 %** | Decision justification | Sample of alerts |
| **15 %** | Audit log, demo and solution | Traceable decisions, working demo, understandable solution |

## Design principles from FINREG

[Slide 05](05-builders-keep-in-mind.jpg), [slide 03](03-tm-ruleset-control-loop.jpg), [slide 04](04-maintaining-tm-ruleset.jpg)

**What builders should keep in mind**
1. **Context matters.** A low-risk flag is not the end of the story; other client information may reveal its significance.
2. **Escalate what matters.** Meaningless alerts divert attention from the important ones.
3. **No self-review.** Nobody supervises their own decisions or reviews their own clients.
4. **Log the reasoning.** Record why every decision was taken.
5. **Prioritise by behaviour.** Assess priority in light of client behaviour and all available client information.
6. **See the whole story.** Look for patterns across the client, not isolated transactions.

**Control loop:** 01 Risk (client + overall risk) → 02 Detect (potential red flags) → 03 Review (filter false positives) → 04 Escalate (to the right person) → 05 Audit (traceable actions). Steps 03–05 are the hackathon scope.

**Core operating principles**
- Built on overall and client-level risk metrics.
- Detects potential red flags and rules out false positives.
- Only material flags reach a human.
- Escalates to the right person, never to someone reviewing their own clients or decisions.
- Fully auditable: every decision is logged with its reasoning.

**Maintaining the ruleset**
1. Keep the ruleset fully auditable; log and trace every decision.
2. Justify every rule and align it with internal risk scoring.
3. Personnel resolving escalated flags must justify each decision.
4. Ensure supervision of flag resolution.
5. Periodically verify that red flags are identified correctly.
6. Periodically assess whether the ruleset captures all relevant flags.

**Internal AML framework** ([slide 02](02-internal-aml-framework.jpg)): 01 Risk assessment · 02 Internal policy framework · 03 Client risk metrics · 04 Transaction monitoring ruleset · 05 Escalation process · 06 Suspicious transaction reporting.

## Regulatory sources

[Slide 01](01-regulatory-sources.jpg)

**Czech baseline**
- Act No. 253/2008 Coll. (AML Act): § 6 suspicious transaction, § 18 reporting to the FAÚ, § 21 internal policies, §§ 22–22a contact and designated person.
- CNB Decree No. 67/2018 Coll.: detailed requirements on internal policies, procedures and controls in the financial sector.
- FAÚ methodological guidance: indicators of suspicious transactions and reporting practice.

**EU framework**
- Regulation (EU) 2024/1624 (AMLR): single rulebook, applies from 10 July 2027; Art. 11 compliance manager and compliance officer.
- Directive (EU) 2015/849 (AMLD), as amended by 2018/843: current directive, transposed in the AML Act; replaced by AMLD6 (2024/1640) from 10 July 2027.
- Regulation (EU) 2023/1113 (TFR): information accompanying transfers of funds and crypto-assets.

**Guidance**
- FATF Recommendations: R.10 CDD, R.20 reporting.
- EBA Guidelines: EBA/GL/2021/02 (ML/TF risk factors), EBA/GL/2022/05 (role of the AML/CFT compliance officer).
- CNB Supervisory Benchmark 2/2023: customer due diligence through transaction monitoring systems.

## Open questions for our implementation

Not answered on the slides. Clarify with FINREG or decide and document in the decision-logic description.

- **Escalation matrix and conflict-of-interest rules**: "provided at the initial briefing". We need the actual document; 20 % of the score depends on it.
- **Average daily volume of Q2 2026** (rule A b): divide by calendar days (91) or by active days? Q2 data is aggregated per client, so calendar days is the likely reading.
- **"Daily volume > 25 % of projected monthly volume"** (rule A a): the client log has a projected volume at contract conclusion. Confirm whether it is monthly or needs conversion.
- **FX rates** for CZK conversion: which source and date (ČNB daily fixing per transaction date is the natural choice).
- **Direction of a transaction**: derive from transaction type and/or payer/payee account. Rule B treats unclear direction as outgoing.
- **Rule C windows**: 24 h rolling window for incoming and 6 h after the incoming payment(s) for outgoing. Define anchor points precisely.
- **High-risk lists**: pin the version of the EU list (Delegated Regulation (EU) 2016/1675, as amended) and the FATF lists ("black" and "grey") that we use, with date.

> Compliance note: the system output is a decision aid, not a final AML determination. Escalation logic and FP auto-closure rules need review by a compliance officer before any real use.
