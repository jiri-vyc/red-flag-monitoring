# Red-flag monitoring – high-level specifikace

- **Verze:** 0.2, 2026-10-19
- **Zdroje:**
  - `P1`, `P2`: rozhovor týmu, [přepis](transcript/transcript.md). Citace `P1 05:04` znamená část 1, čas 05:04.
  - `N`: Notion stránka [RedFlag tool spec](https://app.notion.com/p/3fe931fc277e8059bc51c2d5894ecbf3) (stav k 2026-10-19 13:37). Odkazovaný Miro board s architekturou je privátní a není zde zapracovaný.
- **Kontext challenge:** [knowledgebase/finreg/README.md](../knowledgebase/finreg/README.md)

## Jak číst tento dokument

Každý bod má jeden z typů:

- **Rozhodnutí**: tým se shodl v rozhovoru nebo v Notionu.
- **Návrh**: doplněno při sepisování, tým to zatím neschválil.
- **Otevřená otázka**: nerozhodnuto, viz [sekci 10](#10-otevřené-otázky).

Požadavky používají `musí`, `nesmí`, `měl by`, `může`.

## 1. Cíl

Systém vyhodnocuje platební transakce podle sady pravidel a vytváří AML události (red flags). Každou událost roztřídí, prioritizuje, eskaluje na správnou osobu a zapíše do auditovatelného logu.

Pravidla vznikají z interních předpisů, které vycházejí z regulací. Uživatel je může nechat vygenerovat průvodcem (wizardem) ze seznamu regulací a popisu businessu, nebo je vytvořit ručně. Každé pravidlo schvaluje člověk.

Hackathonová challenge pokrývá kroky Review → Escalate → Audit. Náš systém navíc řeší správu pravidel: jejich vznik, verze, schválení a aktualizaci při změně regulace.

## 2. Klíčová rozhodnutí

| # | Rozhodnutí | Zdroj |
| --- | --- | --- |
| D1 | Hierarchie: **regulace → interní předpis → pravidlo**. Předpis má FK na regulaci, pravidlo má FK na předpis. | N; upřesňuje P1 00:31 |
| D2 | Pravidla mají dva typy: **deterministické** (kód s jasným kontraktem vstupů a výstupů) a **agentní** (text pravidla, který vyhodnocuje LLM agent nad dostupnými daty). | P1 01:30, 02:31; N |
| D3 | Pravidlo vrací **skóre 0–100** a **trace** (log odůvodnění). Výstup true/false je možný až v budoucnu. | P1 03:20–03:48 |
| D4 | Vyhodnocení má dvě úrovně: **vyhodnocení transakce** obsahuje 1:N **vyhodnocení pravidel**. Vyhodnocení transakce je jeden run nad transakcí v daném čase. Každé vyhodnocení pravidla má vlastní kontext. | P1 07:19–07:49; N |
| D5 | Každá transakce se v MVP vyhodnotí **jednou**. Batching a optimalizace přijdou až po MVP. | P1 08:03 |
| D6 | Minimální kontext vyhodnocení tvoří **klient a celá jeho historie**. | P1 08:38, 09:51 |
| D7 | MVP pracuje v režimu **ex post** (zpětná detekce). Live prevention je směr do budoucna. | P1 10:19–11:26 |
| D8 | Deterministické pravidlo se ukládá jako **kód** a vedle něj **lidský přepis** v češtině. Právník schvaluje lidský přepis. Code review je volitelné. | P2 00:00–01:15; N |
| D9 | Pravidlo má **verze**. Změna navázané regulace vyvolá novou verzi a nové review. | P2 01:41–01:52; N |
| D10 | Pravidlo má **stav**: `draft`, `pending_for_review`, `update_for_review`, `active`, `inactive`. Přepínač on/off odpovídá stavům `active` a `inactive`. Platnost od–do se v MVP neřeší. | N; P2 01:52 |
| D11 | Pravidlo má **whitelist klientů**, na které se nevztahuje. | P2 03:03–03:15 |
| D12 | Klient má **risk profil**, který může být i neznámý. Pravidlo nativně určuje, pro které risk profily platí. | P2 03:34–04:54 |
| D13 | **Citlivost** je v MVP globální koeficient, kterým se násobí skóre pravidla. | P2 05:49 |
| D14 | Pravidla se zakládají **wizardem** (z regulací a popisu businessu) nebo **ručně**. | N |
| D15 | Systém eviduje **interní uživatele s rolemi** a vede **audit log**. | N |

## 3. Doménový model

```mermaid
erDiagram
    REGULACE ||--o{ INTERNI_PREDPIS : "je zdrojem"
    INTERNI_PREDPIS ||--o{ PRAVIDLO : "je zdrojem"
    PRAVIDLO ||--|{ VERZE_PRAVIDLA : "má"
    PRAVIDLO }o--o{ KLIENT : "whitelist"
    KLIENT ||--o{ TRANSAKCE : "provádí"
    TRANSAKCE ||--o{ VYHODNOCENI_TRANSAKCE : "je vyhodnocena v"
    VYHODNOCENI_TRANSAKCE ||--|{ VYHODNOCENI_PRAVIDLA : "obsahuje"
    VERZE_PRAVIDLA ||--o{ VYHODNOCENI_PRAVIDLA : "je spuštěna v"
    VYHODNOCENI_TRANSAKCE ||--o| AML_UDALOST : "může vytvořit"
    USER ||--o{ AML_UDALOST : "řeší / schvaluje"
    USER ||--o{ AUDIT_LOG : "je aktérem"
```

| Entita | Popis | Klíčové atributy |
| --- | --- | --- |
| **Regulace** | Právní předpis, např. AML zákon, AMLR nebo seznamy EU/FATF. | název, odkaz na zdroj, platná verze, datum poslední kontroly aktualizace |
| **Interní předpis** | Interní pravidlo instituce. Typicky vychází z regulace. | FK regulace, název, text, stav (draft / schválený) |
| **Pravidlo** | Kontrola, která se spouští nad transakcí. | FK předpis, typ (deterministické / agentní), stav, platné risk profily, whitelist klientů |
| **Verze pravidla** | Neměnný snapshot pravidla. | číslo verze, text pravidla (agentní) nebo kód + lidský přepis (deterministické), schválil, kdy |
| **Klient** | Klient instituce, data z client logu. | ID, země, typ, PEP, risk profil, AML risk score, projektované a historické objemy |
| **Transakce** | Platební transakce, data z transaction logu. | ID, klient, datum a čas, částka, měna, země plátce a příjemce, typ |
| **Vyhodnocení transakce** | Jeden run všech relevantních pravidel nad jednou transakcí v daném čase. | transakce, klient, čas runu, agregované skóre, odkazy na kontext |
| **Vyhodnocení pravidla** | Výsledek jedné verze pravidla v rámci vyhodnocení transakce. | verze pravidla, skóre 0–100, skóre po citlivosti, trace, použitý kontext |
| **AML událost** | Red flag k řešení. Odpovídá řádku výstupního CSV. | typ, priorita, triage, odpovědná osoba (user), schvalovatel (user), stav |
| **User (interní)** | Zaměstnanec instituce, např. AML analytik, compliance officer, právník nebo vedoucí. | jméno, role, přiřazení klienti (kvůli střetu zájmů) |
| **Audit log** | Neměnný záznam každé akce: kdo, kdy, co, proč. | aktér (user / systém / agent), akce, cílová entita, odůvodnění, čas |

Vazby a upřesnění:

- Transakci vždy provádí jeden klient. Metadata transakce mohou odkazovat na dalšího klienta, pokud je protistrana naším klientem (P1 04:35). **Návrh:** vyhodnocení transakce tento odkaz uloží jako kontext.
- **Návrh:** rozhodnutí o AML události (dříve samostatná entita Rozhodnutí) se zapisuje do audit logu. AML událost drží jen aktuální stav.
- **Návrh:** atribut User „přiřazení klienti“ slouží k pravidlu „nikdo nereviduje vlastní klienty ani vlastní rozhodnutí“ (FINREG, slide 05).

## 4. Pravidla

### 4.1 Typy a kontrakt

- Deterministické pravidlo **musí** mít jasný kontrakt vstupů a výstupů. Implementace může být například JavaScript. Technologie zatím není rozhodnutá.
- Agentní pravidlo je **text pravidla** v přirozeném jazyce. LLM agent ho vyhodnocuje nad daty, která má k dispozici. Výstup **musí** mít stejný tvar jako u deterministického pravidla.
- **Návrh kontraktu:**
  - Vstup: transakce, klient, historie transakcí klienta, konfigurace pravidla.
  - Výstup: `score` (0–100), `trace` (strukturované odůvodnění: které podmínky se splnily a nad jakými daty), `context_refs` (odkazy na použitá data).
- Detekce podle pravidel A–C ze zadání **měla by** být deterministická. LLM má třídit, prioritizovat a odůvodňovat, ne procházet jednotlivé řádky dat. Odpovídá to doporučení FINREG.

### 4.2 Vznik pravidel

**Wizard (předpisy → pravidla)** (N):

1. Uživatel zadá seznam regulací, které musí instituce splňovat, a/nebo obecný popis businessu.
2. Systém zavolá API a vytvoří draft interního předpisu.
3. Systém zavolá API a z předpisu vytvoří sadu pravidel ve stavu `draft`.
4. Pravidla jdou ke schválení. Reviewer vidí vedle sebe kód pravidla a jeho lidský přepis.

**Ruční tvorba** (N): uživatel zadá popis pravidla a odkaz na regulaci nebo předpis. Systém z popisu vygeneruje kód (deterministické) nebo text (agentní) a pravidlo jde ke schválení.

- **Návrh:** generování předpisů a pravidel běží přes Amazon Bedrock. Každý vygenerovaný artefakt **musí** odkazovat na konkrétní ustanovení zdrojové regulace, aby šel ověřit.

### 4.3 Stavy, verze a schválení

| Stav | Význam |
| --- | --- |
| `draft` | Rozpracované nebo vygenerované pravidlo. Nespouští se. |
| `pending_for_review` | Nové pravidlo čeká na schválení. Nespouští se. |
| `update_for_review` | Existující pravidlo má navrženou novou verzi, která čeká na schválení. **Návrh:** dosavadní schválená verze se dál spouští. |
| `active` | Schválené a zapnuté. Spouští se. |
| `inactive` | Vypnuté. Nespouští se. |

- Verze pravidla **musí** obsahovat kód a lidský přepis v češtině (deterministické), nebo text pravidla (agentní). Lidskému přepisu musí rozumět právník bez znalosti programování.
- Uložený zůstává i schválený lidský přepis, aby bylo jasné, co přesně právník schválil.
- Code review je **volitelný** krok procesu. Každá instituce si ho může zapnout.
- Systém **nesmí** spustit verzi pravidla, která neprošla schválením.
- **Aktualizace regulací** (N): tlačítko na dashboardu projde seznam regulací a zjistí, zda mají aktualizaci. Pro dotčená pravidla navrhne nové verze ve stavu `update_for_review`.
- **Nová regulace** (N): uživatel přidá regulaci ke splnění a systém vytvoří sadu pravidel stejně jako wizard.

### 4.4 Konfigurace pravidla

| Nastavení | Chování | Stav |
| --- | --- | --- |
| Stav `active` / `inactive` | Vypnuté pravidlo se nespouští. Datum platnosti se v MVP neřeší. | Rozhodnutí |
| Whitelist klientů | Pravidlo se nespouští pro vyjmenované klienty. | Rozhodnutí |
| Platné risk profily | Pravidlo se spouští jen pro klienty s uvedeným risk profilem (např. `high`, `low`, `unknown`). | Rozhodnutí |
| Citlivost | `skóre_po_citlivosti = min(100, skóre × citlivost)`. MVP: jeden globální koeficient. | Rozhodnutí (rozsah otevřený) |
| Citlivost per pravidlo nebo per risk profil | Jemnější nastavení citlivosti. | Mimo MVP |

## 5. Vyhodnocení

- Vyhodnocovací run zpracuje transakci jednou. Spustí všechna pravidla ve stavu `active` (případně jejich poslední schválenou verzi), která platí pro risk profil klienta a z jejichž whitelistu klient není vyjmutý.
- Každé vyhodnocení pravidla **musí** uložit vlastní kontext a trace. Compliance officer musí v detailu vidět, která pravidla prošla, která ne a s jakým skóre (P1 05:04, 06:49).
- Příklad: 100 transakcí a 10 pravidel dá 100 vyhodnocení transakce a 1 000 vyhodnocení pravidel.
- Systém **musí** zvládnout projít celý dataset challenge (~400 000 transakcí za červenec 2026).
- **Návrh:** AML událost vznikne, když agregované skóre vyhodnocení transakce překročí práh. LLM ji pak roztřídí (`FP` / `REVIEW`), přidělí prioritu 0–100 a odůvodní. Podle eskalační matice a rolí uživatelů ji přiřadí odpovědné osobě a schvalovateli.

### 5.1 Režimy

| Režim | Popis | Stav |
| --- | --- | --- |
| Ex post (batch) | Zpětná detekce nad historickými daty. Je to oborový standard. | MVP |
| Live prevention | Transakce se vyhodnotí před provedením a výsledek je schválit / zamítnout. | Po MVP |

## 6. Mapování na výstup challenge

Povinné CSV obsahuje jeden řádek na AML událost. Viz [knowledgebase](../knowledgebase/finreg/README.md#output-and-deliverables).

| Sloupec CSV | Zdroj v našem modelu | Stav |
| --- | --- | --- |
| `alert_id`, `alert_type`, `client_id`, `transaction_id` | AML událost + pravidlo | Návrh |
| `triage` (`FP`/`REVIEW`) | LLM nad vyhodnocením transakce | Návrh |
| `priority` (0–100) | Skóre po citlivosti + rizikové faktory klienta | Návrh |
| `executive_role`, `executive_person`, `approver` | User a role + eskalační matice + pravidla střetu zájmů | Návrh (matice chybí) |
| `reason`, `log` | Trace vyhodnocení pravidel + audit log | Návrh |

## 7. Uživatelské rozhraní

Dashboard (N) **musí** obsahovat:

- **Wizard** pro tvorbu předpisů a pravidel (viz [4.2](#42-vznik-pravidel)).
- **Pravidla:** výpis pravidel se stavem, odkazem na zdrojový předpis a regulaci, a tlačítkem pro vytvoření nového pravidla.
- **Detail pravidla:** kód a lidský přepis vedle sebe, akce schválit / zamítnout, historie verzí.
- **Regulace:** seznam regulací, tlačítko „zkontrolovat aktualizace“ a přidání nové regulace.

**Návrh** (z rozhovoru a challenge, v Notionu zatím není):

- **Detail vyhodnocení:** transakce, klient, jeho historie, výsledky všech pravidel se skóre a trace. Slouží jako podklad pro rozhodnutí o AML události.
- **Fronta AML událostí:** seznam událostí přiřazených přihlášenému uživateli, seřazený podle priority.

## 8. Nefunkční požadavky

- Stack: AWS, primárně Amazon Bedrock (viz [AGENTS.md](../AGENTS.md)).
- Audit: každé vyhodnocení, změna pravidla, schválení a rozhodnutí **musí** mít záznam v audit logu: kdo, kdy, co, proč a jaká verze pravidla.
- Data nesmí opustit hackathon prostředí bez schválení člověkem.
- Výkon není v MVP omezení (P1 11:26). Celý dataset ale musí doběhnout v čase použitelném pro demo.

## 9. Mimo rozsah MVP

- Live prevention mód.
- Batching nebo inkrementální vyhodnocení (např. jednou za hodinu per klient).
- Optimalizace nákladů (N).
- Caching chování per uživatel nebo entita (N).
- Časová platnost pravidel (datum od–do).
- Citlivost per pravidlo nebo per risk profil.
- Výstup pravidla jiný než skóre 0–100.

## 10. Otevřené otázky

1. **MVP scope.** Sekce v Notionu je prázdná. Které části (wizard, aktualizace regulací, ruční tvorba, vyhodnocení, fronta AML událostí) jsou nutné pro demo?
2. **FK předpis → regulace.** Je FK povinný? Rozhovor počítal i s čistě interním (custom) předpisem bez regulace (P1 00:31).
3. **Ruční pravidlo s odkazem na regulaci.** Notion u ruční tvorby uvádí „link na regulaci nebo předpis“, ale pravidlo má FK jen na předpis. Vznikne pro takové pravidlo implicitní předpis?
4. **Verze vs. stav.** Je `update_for_review` stav pravidla, nebo stav nové verze? Spouští se mezitím předchozí schválená verze?
5. **Granularita AML události.** Zadání požaduje u pravidel A a C jednu událost na klienta, u pravidla B jednu na transakci. Náš model vyhodnocuje per transakce. Jak se vyhodnocení transakcí agregují do událostí per klient?
6. **Vyhodnocení per transakce, nebo per klient.** Rozhovor se přiklonil k per transakce (P1 09:13–09:51). Varianta „vyhodnocení klienta v daném čase“ zůstala otevřená.
7. **Agregace skóre.** Jak se ze skóre pravidel spočítá skóre vyhodnocení transakce (max, vážený součet…) a jaký je práh pro vznik AML události?
8. **Rozsah citlivosti.** Jen 0–1 (pouze snižuje), nebo i > 1 (zvyšuje)? (P2 05:49)
9. **Technologie deterministických pravidel.** JavaScript, Python, nebo DSL? Kde a jak se kód spouští (sandbox)?
10. **Kontrola aktualizací regulací.** Z jakého zdroje systém zjistí, že regulace má novou verzi (EUR-Lex, e-Sbírka, seznamy FATF)?
11. **Eskalace a střet zájmů.** Eskalační matice a pravidla střetu zájmů zatím nemáme (20 % hodnocení). Jaké role musí mít entita User?
12. **Architektura.** Miro board z Notionu je privátní. Je potřeba ho zpřístupnit nebo převést do repa.
13. **Otevřené otázky k datům** z [knowledgebase](../knowledgebase/finreg/README.md#open-questions-for-our-implementation): FX kurzy, směr transakce, okna pravidla C, verze seznamů vysoce rizikových zemí.

## 11. Compliance poznámky

Body níže **musí** před reálným nasazením zkontrolovat compliance officer nebo právník:

- **Whitelist klientů** a **omezení pravidel na risk profil** potlačují detekci. Každé přidání do whitelistu by mělo projít schválením, mít odůvodnění a záznam v audit logu. Je potřeba ověřit, zda je výjimka u regulatorně povinných pravidel (např. vysoce rizikové země, PEP) vůbec přípustná.
- **Citlivost < 1** snižuje skóre všech pravidel. Změna globální citlivosti by měla být schvalovaná a logovaná stejně jako změna pravidla.
- **Generované předpisy a pravidla** (wizard, aktualizace regulací) jsou návrhy LLM. Nesmí se aktivovat bez lidského schválení. Interní předpis jako dokument (AML zákon § 21) musí schválit odpovědná osoba instituce.
- **Automatické `FP`** je rozhodnutí bez člověka. Výstup systému je podklad pro rozhodnutí, ne finální AML určení.
- **Schválení pravidla právníkem** podle lidského přepisu předpokládá, že kód přepisu odpovídá. Systém by měl tuto shodu ověřovat (testy, review, LLM kontrola).
