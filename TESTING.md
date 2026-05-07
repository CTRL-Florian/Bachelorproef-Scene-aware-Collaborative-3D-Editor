# Testing & Gebruik — Collaborative 3D Editor

## De app starten

De app heeft twee processen nodig: een Y.js WebSocket server en de Vite dev server.

```bash
# Terminal 1 — Y.js sync server (voor varianten A, B, C)
npm run server

# Terminal 2 — Frontend
npm run dev
```

Open daarna `http://localhost:5173` in je browser. Bij het openen vraagt de app om een gebruikersnaam.

Om twee gebruikers tegelijk te simuleren: open de app in twee tabbladen of twee browsers. Beide zien dezelfde 3D scene in real-time.

### Variant D (OT server)

Variant D heeft een aparte server nodig:

```bash
npm run server:ot   # poort 1235
```

De actieve variant stel je in via de omgevingsvariabele `VITE_COLLAB_VARIANT` (A/B/C/D). Standaard is A.

---

## Teststructuur

```
src/test/
├── setup.ts                          # Vitest setup
├── hooks/
│   └── test-hooks.ts                 # window.* functies voor E2E tests
└── variants/
    ├── shared-scenarios.ts           # 10 scenario's die alle varianten doorlopen
    ├── variant-a.test.ts             # Variant A specifieke tests
    ├── variant-b.test.ts             # Variant B specifieke tests
    ├── variant-c.test.ts             # Variant C specifieke tests
    ├── variant-d.test.ts             # Variant D specifieke tests + transform() unit tests
    └── cross-variant.test.ts         # Alle varianten naast elkaar (vergelijkingstabel)

e2e/
├── fixtures/
│   └── collaboration-fixtures.ts     # Playwright helpers
└── collaboration/
    ├── basic-sync.spec.ts            # Presence en basis sync
    └── conflict-scenarios.spec.ts    # Conflicten in echte browser
```

---

## De vier varianten

Het onderzoek vergelijkt vier implementaties van conflictresolutie. Alle vier implementeren dezelfde `CollaborationStrategy` interface, zodat je ze makkelijk kunt wisselen.

| Variant | Aanpak | Conflictresolutie | Sleutel eigenschap |
|---------|--------|-------------------|--------------------|
| **A** | Object-level LWW (Y.Map) | Heel object overschreven → dataverlies bij onafhankelijke properties | Baseline |
| **B** | Property-level CRDT (geneste Y.Map) | Elke property onafhankelijk LWW → beide intents bewaard | Beste voor mixed edits |
| **C** | Delta-based op log (Y.Array) | `moveObject` deltas zijn commutatief (+3 + +5 = 8 altijd) | Enige die beide deltas toepast |
| **D** | Operational Transformation (OT server) | Expliciete `transform()` functie, "eerste bij server wint" | Auditeerbaar, deterministisch |

### Wat is de cross-variant test?

`cross-variant.test.ts` draait **exact hetzelfde scenario** tegen alle vier varianten en print een vergelijkingstabel in de terminal. Zo zie je in één oogopslag welke variant welk gedrag vertoont.

Voorbeeld output:
```
=== Different-property conflict — B/C/D should preserve both ===
Variant | Converged | Alice intent | Bob intent | Notes
--------|-----------|--------------|------------|------
   A    |     ✓     |     100%     |   0%       | pos=[10,0,0] color=#FFFFFF
   B    |     ✓     |     100%     |   100%     | pos=[10,0,0] color=#FF0000
   C    |     ✓     |     100%     |   100%     | pos=[10,0,0] color=#FF0000
   D    |     ✓     |     100%     |   100%     | pos=[10,0,0] color=#FF0000
```

- **Converged** — beide peers zijn in exact dezelfde toestand (sterke eventuele consistentie)
- **Alice/Bob intent** — welk percentage van hun bedoelde wijzigingen overleeft in de eindtoestand
- De cross-variant test bevat ook assertions: bv. Variant B/C/D moeten altijd 100%/100% scoren voor onafhankelijke properties

---

## Testcommando's

### Unit/integration tests (Vitest)

```bash
# Alle varianttests (aanbevolen voor onderzoek)
npm run test:variants

# Cross-variant vergelijkingstabel
npm run test:cross-variant

# Per variant
npm run test:variant:a
npm run test:variant:b
npm run test:variant:c
npm run test:variant:d

# Watch mode (herstart bij bestandswijziging)
npm run test

# Met coverage
npm run test:coverage
```

### E2E tests (Playwright — echte browsers)

E2E tests vereisen dat de app én de server draaien. Playwright start ze automatisch op.

```bash
# Alle E2E tests (headless)
npm run test:e2e

# Met zichtbare browsers (handig voor visueel onderzoek)
npm run test:e2e:headed

# Interactieve UI mode
npm run test:e2e:ui

# Debug mode (pauzeert bij elke stap)
npm run test:e2e:debug

# Alleen collaboration tests
npm run test:collab
```

### Alles tegelijk

```bash
npm run test:all   # vitest run + playwright
```

---

## De 10 testscenario's

Elk van de 10 scenario's wordt voor alle vier varianten uitgevoerd via `shared-scenarios.ts`. Elke test print een gestructureerde regel met convergentie en intent score.

| # | Scenario | Bron |
|---|----------|------|
| S1 | Zelfde property concurrent (LWW race) | Basisconflict |
| S2 | Verschillende properties concurrent (intent preservation) | Kernvraag onderzoek |
| S3 | Delete vs. gelijktijdige update | `situations.md` §7 |
| S4 | Concurrent `moveObject` — delta commutatief? | Zhou 2023, Preguiça 2018 |
| S5 | Gelijktijdig reparenten naar twee ouders | `situations.md` §5 |
| S6 | Gelijktijdig object aanmaken met zelfde ID | `situations.md` §9 |
| S7 | Ouder verwijderd terwijl kind bewerkt wordt | `situations.md` §7 |
| S8 | Batch ops van één peer vs. enkele op van andere | `situations.md` §8 |
| S9 | Dubbele delete (idempotentie) | Shapiro 2011 |
| S10 | Gelijktijdig `linkObject` naar verschillende ouders | `situations.md` §4 |

### Test output lezen

Elke test print een regel zoals:

```
[Variant B] S2-pos+color  converged=✓  alice=100%  bob=100%  BOTH PRESERVED
[Variant A] S2-pos+color  converged=✓  alice=100%  bob=0%    INTENT LOST
```

- `converged=✓` — verplicht voor alle varianten (anders is het een bug)
- `alice=X%` / `bob=X%` — intentiescore: hoeveel van hun wijzigingen overleeft
- `BOTH PRESERVED` / `INTENT LOST` / `PARTIAL` — samenvatting van het resultaat

---

## Bekende bevinding: childIds inconsistentie (S5/S10)

Bij alle varianten geldt voor S5 en S10:

```
winner=parent-A  inA=true  inB=true  consistent=false
```

**Wat betekent dit?** Het kind heeft `parentId=parent-A` (één winnaar), maar zowel `parent-A.childIds` als `parent-B.childIds` bevatten het kind. Dit komt omdat `childIds` op parent-A en `childIds` op parent-B aparte objecten zijn — er is geen conflict tussen die twee writes.

Dit is een bekende beperking van property-level conflictresolutie bij cross-object invarianten. Variant D lost dit alleen op wanneer `linkObject()` (met `reparent` op) gebruikt wordt in plaats van `updateObject({ parentId })`.

---

## E2E test hooks (browser console)

In development mode zijn deze functies beschikbaar in de browser console én in Playwright tests:

```javascript
window.addTestBox([x, y, z])                    // Voeg testbox toe, geeft id terug
window.removeTestObject(id)                     // Verwijder object
window.updateTestObjectPosition(id, [x, y, z]) // Stel positie in
window.updateTestObjectRotation(id, [x, y, z]) // Stel rotatie in
window.updateTestObjectScale(id, [x, y, z])    // Stel schaal in
window.updateTestObjectColor(id, '#FF0000')     // Stel kleur in
window.getSceneObjectById(id)                   // Lees één object
window.getSceneState()                          // Volledige scene state
window.getSceneObjectCount()                    // Aantal objecten
window.isSceneReady()                           // Y.js sync status
window.resetCameraView()                        // Camera naar isometrisch [10,10,10]
```

---

## Tips voor onderzoek

### Varianten vergelijken

```bash
# Druk de volledige vergelijkingstabel af
npm run test:cross-variant 2>&1 | Select-String "==="
npm run test:cross-variant 2>&1 | Select-String "Variant"
```

### Output opslaan

```bash
npm run test:variants > resultaten.txt 2>&1
```

### Headed E2E voor visuele observatie

```bash
npm run test:e2e:headed
```

Twee browsertabbladen openen naast elkaar — je ziet live hoe conflicten in de UI worden opgelost.

### Nieuwe scenario's toevoegen

Voeg een nieuw `describe`-blok toe aan `src/test/variants/shared-scenarios.ts`. Het scenario wordt automatisch uitgevoerd voor alle vier varianten via `runSharedScenarios()` in elk `variant-X.test.ts` bestand.
