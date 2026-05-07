# Onderzoeksnotities — Scene-aware Collaborative 3D Editor

## Overzicht van het onderzoek

Dit document verbindt de vier geïmplementeerde conflictresolutievarianten met
de academische literatuur over gedistribueerde bewerkingssystemen.

---

## 1. Academische grondslag

### 1.1 Foundational papers: Operational Transformation

**Ellis & Gibbs (1989)**
> C. A. Ellis and S. J. Gibbs, "Concurrency Control in Groupware Systems,"
> *Proc. ACM SIGMOD 1989*, ACM SIGMOD Record 18(2), pp. 399–407.
> DOI: 10.1145/67544.66963

Het fundament van OT. Ellis en Gibbs introduceerden het begrip *intention
preservation*: een bewerking moet hetzelfde effect hebben, ongeacht de volgorde
waarin concurrente bewerkingen worden verwerkt. Ze onderscheidden twee
consistentie-eigenschappen:
- **Causaliteitspreservatie** – bewerkingen worden in causale volgorde uitgevoerd.
- **Intentiepreservatie** – de bedoeling van de gebruiker wordt bewaard.

*Relevantie voor dit project*: Variant D implementeert precies dit model met een
autoritatieve server die operaties transformeert voor ze worden gepubliceerd.

---

**Sun & Ellis (1998)**
> C. Sun and C. A. Ellis, "Operational Transformation in Real-time Group Editors:
> Issues, Algorithms, and Achievements,"
> *Proc. CSCW 1998*, ACM.

Formaliseert OT-algoritmen en definieert de transformatiefuncties die ook in dit
project worden gebruikt. Introduceert de TP1-eis (transformation property 1):
`T(A, B)` na `B` en `T(B, A)` na `A` moeten hetzelfde eindresultaat opleveren.

*Relevantie*: De `transform(op1, op2)` functie in `variant-d.ts` implementeert
TP1 voor de vier operatietypen van een 3D-editor (setProperty, delete, create,
reparent). Omdat de operatieset klein en begrensd is, is de volledige
transformatiematrix expliciet definieerbaar — in tegenstelling tot teksteditors.

---

**Nichols et al. (1995) — Jupiter**
> D. Nichols, C. P. Curtis, M. Dixon, D. Lamping, "High-Latency, Low-Bandwidth
> Windowing in the Jupiter Collaboration System," *Proc. UIST 1995*, ACM.

Demonstreert de client-server OT-architectuur die de basis vormt voor Variant D.
De Jupiter-benadering (client stuurt operatie + revisienummer, server transformeert
en broadcast) is praktisch toepasbaar en beïnvloedde Google Docs.

---

### 1.2 Foundational papers: CRDTs

**Shapiro et al. (2011)**
> M. Shapiro, N. Preguiça, C. Baquero, M. Zawirski, "Conflict-free Replicated
> Data Types," *INRIA Research Report 7686*, 2011.
> Beschikbaar: https://inria.hal.science/inria-00609399v1

Het funderende CRDT-paper. Definieert *Strong Eventual Consistency* (SEC): alle
correct werkende replica's die dezelfde set updates hebben ontvangen, zijn in
dezelfde toestand. Introduceert state-based (CvRDT) en operation-based (CmRDT)
varianten.

*Relevantie*: Varianten A, B en C gebruiken Y.js, dat een CmRDT-aanpak volgt.
Y.js garandeert SEC voor zijn eigen datastructuren (Y.Map, Y.Array). De
onderzoeksvraag is of de *domeinspecifieke* conflictresolutie die Y.js biedt
acceptabel is voor een 3D-editor.

---

**Preguiça, Baquero & Almeida (2018)**
> N. Preguiça, C. Baquero, P. S. Almeida, "Conflict-free Replicated Data Types:
> An Overview," *arXiv:1806.10254*, 2018.

Uitgebreid overzicht van CRDT-technieken en hun toepassingen. Bespreekt
commutatieve operaties en hoe CRDTs zonder coördinatie convergeren.

*Relevantie*: Variant C's `moveObject()` delta-operaties zijn commutatief
(optelling is commutatief), wat een CRDT-eigenschap introduceert *boven* Y.js
voor bewegingsoperaties. Dit is een hybride benadering.

---

### 1.3 Framework-specifieke literatuur: Y.js

**Nicolaescu et al. (2015)**
> P. Nicolaescu, K. Jahns, M. Derntl, R. Klamma, "Yjs: A Framework for Near
> Real-Time P2P Shared Editing on Arbitrary Data Types,"
> *Proc. ICWE 2015*, LNCS Vol. 9114, pp. 675–678.
> DOI: 10.1007/978-3-319-19890-3_55

Het originele Y.js-paper. Beschrijft hoe Y.js *arbitrary data types* ondersteunt
via een modulaire CRDT-laag. Bewerkingen krijgen een unieke (clientId, clock)-tuple
(Lamport timestamp) en convergentie is formeel bewezen.

*Relevantie*: Alle drie Y.js-varianten (A, B, C) bouwen op de convergentiegarantie
van Y.js. Variant A gebruikt `Y.Map` op object-niveau (LWW per sleutel), Variant B
gebruikt geneste `Y.Map` (LWW per property), Variant C gebruikt `Y.Array` als
operatielog.

---

### 1.4 Vergelijking OT vs. CRDT

**Sun et al. (2020)**
> C. Sun, D. Sun, Agustina, W. Cai, "Real Differences between OT and CRDT under
> a General Transformation Framework for Consistency Maintenance in Co-Editors,"
> *PACMHCI*, Vol. 4, Article 6 (GROUP 2020).
> DOI: 10.1145/3375186

Empirische en theoretische vergelijking. Betoogt dat CRDTs OT niet overtreffen
qua correctheid en dat OT in de praktijk dominanter blijft (Google Docs, Figma).
CRDTs bereiken transformatie indirect (via interne CRDT-logica); OT direct.

*Relevantie voor dit onderzoek*: Dit paper ondersteunt de keuze om Variant D (OT)
mee te nemen als alternatief. In een 3D-editor is de operatieset klein genoeg dat
OT zijn complexiteitsproblemen (TP2-eis) niet ervaart.

---

### 1.5 Collaboratief 3D bewerken

**Zhou et al. (2023)**
> S. Zhou, Y. Li, T. Shang, W. Kong, "A Paradigm for Collaborative 3D Editing
> via List Conflict-free Replicated Data Types,"
> *Proc. CSAE 2023*, ACM.
> DOI: 10.1145/3627915.3627919

Stelt voor om 3D-modellen te representeren als geordende lijsten van
modelleeroperaties, uitgedrukt als list-CRDTs. Definieert strategieën voor
automatische conflictresolutie bij gelijktijdige bewerkingen.

*Relevantie*: Variant C (operatielog via Y.Array) volgt een vergelijkbaar
paradigma. Zhou et al. ondersteunen de keuze voor een append-only log als
conflictresolutiemechanisme voor 3D-editoren.

---

**Sun et al. (2012) — Creative Conflict Resolution**
> C. Sun et al., "Creative Conflict Resolution in Realtime Collaborative Editing,"
> *Proc. CSCW 2012*, ACM.
> DOI: 10.1145/2145204.2145413

Stelt *Creative Conflict Resolution* (CCR) voor: in plaats van conflicten te
elimineren, worden alternatieve oplossingen gegenereerd uit de gecombineerde
effecten van concurrente bewerkingen. Gebruikers kunnen kiezen.

*Relevantie*: Dit is de academische rechtvaardiging voor Metric 3 (semantische
correctheid). De testmatrix meet niet alleen convergentie maar ook *intent
preservation* — hoeveel van de intentie van elke gebruiker overleeft in het
eindresultaat.

---

## 2. Verbinding van papers met de vier varianten

| Paper | Variant A | Variant B | Variant C | Variant D |
|-------|-----------|-----------|-----------|-----------|
| Shapiro 2011 (CRDTs) | ✓ (Y.Map LWW) | ✓ (nested Y.Map) | ✓ (Y.Array log) | – |
| Nicolaescu 2015 (Y.js) | ✓ direct | ✓ direct | ✓ direct | – |
| Ellis & Gibbs 1989 (OT) | – | – | – | ✓ direct |
| Sun & Ellis 1998 (OT) | – | – | – | ✓ direct |
| Zhou 2023 (3D CRDT) | – | – | ✓ (list ops) | – |
| Sun 2020 (OT vs CRDT) | context | context | context | ✓ vergelijking |
| Sun 2012 (intent) | meetpunt | meetpunt | meetpunt | meetpunt |

---

## 3. Onderzoeksvragen en hypothesen

### Hoofdvraag
Welke conflictresolutiestrategie biedt de beste balans tussen semantische
correctheid, convergentiegaranties en implementatiecomplexiteit voor een
realtime collaboratieve 3D-editor?

### Hypothesen

**H1 — Convergentie**
Alle vier varianten garanderen convergentie (sterke eventuele consistentie).
Voor A, B, C is dit mathematisch bewezen door Y.js. Voor D volgt het uit de
determinististische serverordering.

**H2 — Intent preservation: verschiedene properties**
Variant B en D bewaren beide intenties wanneer twee peers verschillende
eigenschappen van hetzelfde object bewerken. Variant A verliest één intentie
(whole-object replacement). Variant C gedraagt zich als Variant B voor
setProperty-operaties, maar als Variant D voor delta-bewegingen.

**H3 — Intent preservation: zelfde property**
Alle varianten volgen LWW voor gelijktijdige bewerkingen van dezelfde property.
Variant D maakt de winnaar expliciet (eerste aankomst bij de server), terwijl
A, B en C de winnaar bepalen op basis van Y.js's interne client-ID-ordening.

**H4 — Commutatieve moves**
Alleen Variant C (via `moveObject()`) past beide concurrente bewegingsdeltas
toe. De eindpositie is de som van beide deltas, ongeacht de volgorde in de log.

**H5 — Delete vs. Update**
In Variant D transformeert de server een setProperty-operatie naar een no-op
als het object al verwijderd is. In A/B/C is het resultaat afhankelijk van de
Y.js-interne volgorde en kan variëren.

---

## 4. Testmatrix — verwachte resultaten

| Scenario | Variant A | Variant B | Variant C | Variant D |
|----------|-----------|-----------|-----------|-----------|
| S1: Zelfde property (positie) | Convergeert, LWW | Convergeert, LWW | Convergeert, LWW | Convergeert, first-to-server |
| S2: Andere properties | Convergeert, **dataverlies** | Convergeert, **beide bewaard** | Convergeert, beide bewaard | Convergeert, beide bewaard |
| S3: Delete vs. Update | Convergeert, volgorde-afhankelijk | Idem | Idem | Convergeert, **delete wint expliciet** |
| S4: Concurrent move (delta) | Eén delta verloren | Eén delta verloren | **Beide deltas toegepast** | Eén delta verloren |
| S5: Parent-child conflict | Convergeert, childIds mogelijk inconsistent | Convergeert, childIds mogelijk inconsistent | Convergeert, beide ops in log | Convergeert, reparent getransformeerd |

---

## 5. Implementatiearchitectuur

```
src/collaboration/
  types.ts          — SceneObject, CollaborationStrategy, TestEnv interfaces
  transforms.ts     — Matrix math voor link/unlink (world ↔ local coördinaten)
  factory.ts        — createYjsStrategy(), createTestEnv(), activeVariant()
  variants/
    variant-a.ts    — Object-level LWW (Y.Map<SceneObject>)
    variant-b.ts    — Property-level CRDT (Y.Map<Y.Map<property>>)
    variant-c.ts    — Delta-based log (Y.Array<Op>)
    variant-d.ts    — OT client + InMemoryOTServer

src/test/variants/
  shared-scenarios.ts   — Gedeelde vijf-scenariomatrix
  variant-a.test.ts     — Variant A specifieke assertions
  variant-b.test.ts     — Variant B specifieke assertions
  variant-c.test.ts     — Variant C specifieke assertions
  variant-d.test.ts     — Variant D specifieke assertions + transform() unit tests

server.cjs          — Y.js WebSocket server (Varianten A, B, C)
server-ot.cjs       — OT WebSocket server (Variant D)
```

### Swappable interface

Alle varianten implementeren `CollaborationStrategy`. Tests en de
productiestore (`useYjsSceneStore.ts`) kennen enkel de interface.
De factory (`factory.ts`) selecteert de implementatie op basis van de
omgevingsvariabele `VITE_COLLAB_VARIANT` (browser) of `COLLAB_VARIANT` (Node).

---

## 6. Meetmethoden

### Metric 1 — Convergentie (binair)
```
isConverged = JSON.stringify(alice.getObject(id)) ===
              JSON.stringify(bob.getObject(id))
```
Harde eis voor alle varianten. Getest door `assertConverged()` in
`shared-scenarios.ts`.

### Metric 2 — Intent preservation score
```
score(user) = |properties user bedoelde die in eindstate aanwezig zijn|
             / |properties user bewerkte|
```
Per scenario en per variant berekend in de `intentScore()` helper.

### Metric 3 — Semantische correctheid (kwalitatief)
Gebaseerd op de vraag: "Is dit het juiste resultaat vanuit het perspectief van
een 3D-editortaak?" Geëvalueerd per scenario op basis van domeinkennis en
de CCR-principes van Sun et al. (2012).

---

## 7. Verdere literatuur — ter overweging

- **Conflict-free Replicated Data Types for Collaborative 3D CAD** (2018) —
  uitbreiding van CRDTs naar meta-operaties in CAD-systemen. Relevant voor
  de parent-child hiërarchieproblemen in Scenario 5.

- **Google Wave Operational Transformation** (Wang, Mah, Lassen, 2010) —
  industriële implementatie van Jupiter-stijl OT. Legt het revisienummer-protocol
  uit dat ook in `server-ot.cjs` wordt gebruikt.

- **Towards a Unified Theory of Operational Transformation and CRDT**
  (Oster et al.) — theoretische brug tussen OT en CRDT, relevant voor de
  vergelijkingsanalyse in Fase 5.
