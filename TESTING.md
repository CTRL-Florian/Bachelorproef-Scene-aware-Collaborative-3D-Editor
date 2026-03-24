# Test Infrastructure

Dit document beschrijft de testinfrastructuur voor de Collaborative 3D Editor.

## Overzicht

De testinfrastructuur bestaat uit:

1. **Unit Tests** (Vitest) - Testen van individuele componenten en functies
2. **Integration Tests** (Vitest) - Testen van Yjs synchronisatie tussen gesimuleerde gebruikers
3. **E2E Tests** (Playwright) - End-to-end tests met echte browser instances

## Test Structuur

```
src/test/
├── setup.ts                    # Vitest setup en mocks
├── utils/
│   └── yjs-test-utils.ts       # Helpers voor Yjs tests
├── hooks/
│   └── test-hooks.ts           # Window functies voor E2E tests
├── scene-store.test.ts         # Unit tests voor scene CRUD
├── multi-user-sync.test.ts     # Multi-user synchronisatie tests
├── conflict-resolution.test.ts # Conflict scenario tests
└── offline-reconnect.test.ts   # Offline/reconnect tests

e2e/
├── fixtures/
│   └── collaboration-fixtures.ts  # Playwright fixtures
├── collaboration/
│   └── basic-sync.spec.ts         # Basic collaboration E2E tests
└── network/
    └── connection.spec.ts         # Network condition E2E tests
```

## Commando's

### Unit & Integration Tests

```bash
# Run tests in watch mode
npm run test

# Run tests eenmalig
npm run test:run

# Run tests met UI
npm run test:ui

# Run tests met coverage
npm run test:coverage
```

### E2E Tests

```bash
# Installeer Playwright browsers (eenmalig)
npx playwright install

# Run alle E2E tests
npm run test:e2e

# Run met UI mode
npm run test:e2e:ui

# Run in headed mode (zichtbare browsers)
npm run test:e2e:headed

# Debug mode
npm run test:e2e:debug

# Alleen collaboration tests
npm run test:collab

# Alleen network tests
npm run test:network

# Alleen conflict scenario tests
npm run test:e2e -- conflict-scenarios
```

### Conflict-specifieke tests

```bash
# Alle Vitest conflict resolution tests
npm run test:run -- src/test/conflict-resolution.test.ts

# Specifieke conflict groepen
npm run test:run -- --grep "Same Property Conflicts"
npm run test:run -- --grep "Different Property Conflicts"
npm run test:run -- --grep "Parent-Child Relationship"
npm run test:run -- --grep "Stress Tests"
npm run test:run -- --grep "statistics"

# E2E conflict tests
npm run test:e2e -- conflict-scenarios.spec.ts

# E2E conflict tests in headed mode (zie beide browsers live)
npm run test:e2e:headed -- conflict-scenarios.spec.ts
```

### Alle Tests

```bash
# Run unit tests en E2E tests
npm run test:all
```

## Test Scenarios

### 1. CRUD Operations (`scene-store.test.ts`)

Tests voor basis scene manipulatie:
- Object toevoegen
- Object verwijderen
- Object updaten (positie, rotatie, schaal, kleur)
- Parent-child linking

### 2. Multi-User Sync (`multi-user-sync.test.ts`)

Tests voor real-time synchronisatie:
- Sync nieuwe objecten naar andere gebruikers
- Sync updates tussen gebruikers
- Concurrent adds van verschillende gebruikers
- Concurrent updates op verschillende properties
- Drie gebruikers samenwerking

### 3. Conflict Resolution (`conflict-resolution.test.ts`)

**BELANGRIJK VOOR ONDERZOEK**: Deze tests documenteren hoe Yjs conflicten oplost, zonder conflictoplossingsstrategie in te bouwen.

#### 3.1 Same Property Conflicts (Last-Write-Wins)

```typescript
it('should handle concurrent position updates (last-write-wins)');
it('should handle concurrent color updates');
it('should handle concurrent rotation updates');
it('should handle concurrent scale updates');
```

**Wat testen ze:**
- Twee gebruikers updaten dezelfde eigenschap van hetzelfde object tegelijk
- Na sync moeten beide gebruikers dezelfde waarde zien (convergentie)
- De logs tonen welke waarde "wint" (basis voor jouw onderzoek naar prioriteit)

**Voorbeeld scenario:**
```
User1: box.position = [10, 0, 0]
User2: box.position = [0, 10, 0]
→ Yjs kiest één van beide op basis van client ID ordering
→ Beide users zien dezelfde uiteindelijke positie
```

#### 3.2 Different Property Conflicts (Whole-Object Replacement Data Loss)

```typescript
it('should document that whole-object replacement loses concurrent updates');
it('should document concurrent update data loss');
it('should document move-vs-rotate conflict behavior');
it('should document rotate-vs-scale conflict behavior');
```

**Kritieke inzicht:**
De implementatie gebruikt `yobjects.set()` wat het **hele object vervangt** in plaats van individuele eigenschappen. Dit betekent:
- Als User1 position update doet en User2 color update doet tegelijk
- Slechts **één** van beide updates overleeft
- Dit is essentieel voor jouw onderzoek naar property-level locking

**Voorbeeld scenario:**
```
User1: box.position = [5, 5, 5]     (heel object vervanging)
User2: box.color = '#FF0000'        (heel object vervanging)
→ Resultaat: Één van beide updates gaat verloren
→ Logoutput toont welke update won
```

#### 3.3 Add vs Delete Conflicts

```typescript
it('should handle delete vs update conflict');
it('should handle delete vs rotate conflict');
it('should handle delete vs color conflict');
it('should handle concurrent add with same ID');
```

**Wat testen ze:**

**Delete vs edit:**
- User1 verwijdert object
- User2 probeert tegelijk hetzelfde object te bewerken
- Beide krijgen dezelfde eindtoestand (object deleted of behouden?)
- Logs tonen welke bewerking "wint"

**Concurrent add met zelfde ID:**
- User1 en User2 creëren tegelijk object met identieke ID
- Maar met verschillende properties (kleur, positie)
- Yjs CRDT bepaalt welke versie overleeft
- Kritiek voor jouw onderzoek naar ID collision handling

**Voorbeeld scenario:**
```
User1: add Box {id: 'box-1', color: '#FF0000', pos: [1,0,0]}
User2: add Box {id: 'box-1', color: '#0000FF', pos: [0,1,0]}
→ Yjs kiest één van beide based op timestamp ordering
→ Logs tonen welke versie behouden is
```

#### 3.4 Parent-Child Relationship Conflicts

```typescript
it('should handle concurrent parent assignment');
it('should handle concurrent unlink and move');
it('should document parent-move while child-is-edited behavior');
it('should document parent-child invariant drift during concurrent reparenting');
```

**Wat testen ze:**

**Concurrent linking:**
- Child object tegelijk linken naar verschillende parents (Parent A vs Parent B)
- Parent-child consistency moet behouden blijven
- Logs tonen welke parent "gewint"
- **Critical voor jouw scene-aware editor**: Hiërarchie consistency

**Parent transformation + child edit:**
- Parent wordt verplaatst (10, 0, 0)
- Tegelijk wordt child geroteerd
- Moet correct berekend worden op basis van parent's transformatie matrix
- Logs tonen uiteindelijke transformaties

**Voorbeeld scenario:**
```
Initieel:     Parent @ [0,0,0]
              Child @ [1,0,0] (relatief 1m naar rechts)

Concurrent:   User1: move parent naar [10,0,0]
              User2: rotate child naar 90°

Final state:  Child moet nu @ [11,0,0] zijn in world coords
              (10 + 1 meter offset)
```

#### 3.5 Stress Tests (Schaalbaarheid)

```typescript
it('should converge state across 100 concurrent updates');
it('should keep a converged state under high user count');
it('should keep a converged state under concurrent chain edits');
```

**Wat testen ze:**

**100+ gelijktijdige updates:**
- 100-120 gesimuleerde gebruikers
- Alle updaten dezelfde object tegelijk
- System moet nog steeds convergeren naar consistent state
- Logs tonen eindresultaat en performance
- **Beantwoordt vraag: scalability met grote user count?**

**Parent-child ketting onder stress:**
- 3-level hiërarchie: root → node-1 → node-2
- User1 update root 15x in loop
- User2 update leaf node 15x in loop (tegelijk)
- Alle niveaus moeten consistent convergeren
- **Important voor editor met diepe object trees**

### 4. Offline/Reconnect (`offline-reconnect.test.ts`)

**KRITIEKE SCENARIO'S** voor jouw onderzoek:

1. **Single user offline**: 
   - User2 gaat offline
   - User1 maakt wijzigingen
   - User2 reconnect en moet updates ontvangen

2. **Both users offline simultaneously**:
   - Beide users gaan offline (network outage)
   - Beide maken bewerkingen
   - Beide reconnecten tegelijk
   - States moeten gemerged worden

3. **Extended offline periods**:
   - Langere offline periode
   - Veel operaties (adds, updates, deletes)
   - Merge na reconnect

4. **Intermittent connectivity**:
   - Kort offline, weer online, kort offline
   - Meerdere cycles

### 5. E2E Conflict Scenarios (`e2e/collaboration/conflict-scenarios.spec.ts`)

**ECHT BROWSER TESTS** met Playwright - testen het volledige interaction flow:

#### 5.1 Concurrent Move Updates

```typescript
test('concurrent move updates should converge to same final object state')
```

**Setup:**
- Twee browser tabs (Alice en Bob)
- Beide users ingelogd
- Één box op [0, 0, 0]

**Wat gebeurt:**
```
Alice: moveert box naar [10, 0, 0]
Bob:   moveert box naar [0, 10, 0]
(volledig parallel in browser)
```

**Verwacht resulaat:**
- Beide tabs zien dezelfde final state
- Object is consistent

#### 5.2 Concurrent Color Changes

```typescript
test('concurrent color updates should converge to one selected color')
```

**Setup:**
- Twee users met één box [1, 1, 1]

**Wat gebeurt:**
```
Alice: zet kleur naar #FF0000 (rood)
Bob:   zet kleur naar #0000FF (blauw)
(parallel)
```

**Verwacht resultaat:**
- Beide users zien dezelfde kleur (één van beide of merge)
- Kleur is geldige hex string

#### 5.3 Delete vs Rotate Conflict

```typescript
test('delete vs rotate conflict should converge to same outcome for both users')
```

**Setup:**
- One box at [2, 2, 2]

**Wat gebeurt:**
```
Alice: verwijdert de box
Bob:   roteert de box naar 90°
(parallel)
```

**Verwacht resultaat:**
- Beide users zien dezelfde state
- Of box is deleted OF box is behouden
- Maar niet inconsistent tussen users

#### 5.4 Move + Rotate Concurrent (Mixed Operations)

```typescript
test('concurrent move and rotate should converge to same state')
```

**Real-world scenario:**
```
Alice: verplaatst object naar rechts: [5, 5, 0]
Bob:   roteert object 45°
(parallel)
```

**Verwacht:**
- Convergentie naar consistent state
- Maar één update kan verloren gaan (whole-object replacement)

#### 5.5 Burst Updates

```typescript
test('burst updates from both users should converge')
```

**Stress scenario:**
- Loop 5x: beiden updaten position tegelijk
- Rapid fire: 50ms interval
- 10 totale updates in spannende sequentie

**Verwacht:**
- Convergeert naar consistent eindstate
- Geen race conditions in UI
- Logoutput toont eindpositie

---

## Test Utilities

### TestCollaborationEnvironment

Simuleert meerdere gebruikers zonder echte network:

```typescript
const env = new TestCollaborationEnvironment();

// Voeg gebruikers toe
const user1 = env.addUser('user1', 'Alice');
const user2 = env.addUser('user2', 'Bob');

// Simuleer disconnect
env.disconnectUser('user2');

// Simuleer reconnect
env.reconnectUser('user2');

// Beide disconnecten (network outage)
env.disconnectAllUsers();

// Beide reconnecten met merge
env.reconnectAllUsers();

// Cleanup
env.cleanup();
```

### Scene Object Helpers

```typescript
// Maak een test box
const box = createTestBox({ id: 'my-box', position: [1, 2, 3] });

// Voeg toe aan document
addSceneObject(doc, box);

// Update
updateSceneObject(doc, 'my-box', { color: '#FF0000' });

// Verwijder
removeSceneObject(doc, 'my-box');

// Lees
const objects = getSceneObjects(doc);
const obj = getSceneObject(doc, 'my-box');
```

## Onderzoek Tips

### Conflict Resolution Analyse

De `conflict-resolution.test.ts` bevat een speciale test die statistieken verzamelt:

```typescript
it('should collect conflict resolution statistics', () => {
  // Deze test print:
  // User1 wins: X/10
  // User2 wins: Y/10
  // Details: [...]
});
```

Run deze test om te zien welke user "wint" bij conflicten:
```bash
npm run test:run -- --grep "statistics"
```

### Research Analysis: Conflict Resolution Vragen

Deze tests helpen je onderzoeksvragen te beantwoorden:

#### 1. **Twee gebruikers updaten hetzelfde object tegelijk - hoe worden conflicten opgelost?**
   - Run: `npm run test:run -- --grep "Same Property Conflicts"`
   - Vraag: Wint User1 altijd, User2 altijd, of is het willekeurig?
   - Logs tonen: `Conflict result - position: [...]`

#### 2. **Wat gebeurt met updates op verschillende properties tegelijk?**
   - Run: `npm run test:run -- --grep "Different Property Conflicts"`
   - Issue: Whole-object replacement → data loss
   - **Kritiek voor locking**: Moet je property-level locking implementeren?

#### 3. **Is de oplossing schaalbaar met veel gebruikers?**
   - Run: `npm run test:run -- --grep "Stress Tests"`
   - Testen met 100-120 concurrent users
   - Kijk naar:
     - Convergentie tijd
     - Data loss patronen
     - Invariant consistency

#### 4. **Hoe evolueert parent-child hiërarchie onder conflict?**
   - Run: `npm run test:run -- --grep "Parent-Child Relationship"`
   - Testen: Kan de hiërarchie inevarant drift?
   - Check: childIds ↔ parentId consistency

#### 5. **Real-world scenario's in browser**
   - Run: `npm run test:e2e:headed -- conflict-scenarios.spec.ts`
   - Zie live beide browser tabs: move, color, delete tegelijk
   - Check: Visuele convergentie

### Offline Merge Gedrag

Om het merge gedrag te analyseren na offline periods:

```bash
npm run test:run -- --grep "Both Users Offline"
```

De tests loggen de resulterende waarden na merge, wat nuttig is voor het analyseren van hoe Yjs keuzes maakt.

### Custom Conflict Resolution

De huidige tests documenteren het **default Yjs gedrag**. Voor je onderzoek naar scene-aware conflict resolution kun je:

1. De test results analyseren om het huidige gedrag te begrijpen
2. Custom conflict resolution implementeren in de app
3. De tests aanpassen om de nieuwe resolution te verifyen
4. Nieuwe tests schrijven voor gelocking-scenario's (operation-level locks)

## E2E Test Hooks

De applicatie heeft test hooks geïmplementeerd in `test-hooks.ts`:

```typescript
// In browser console (dev mode):
window.getSceneObjectCount()                              // Aantal objecten
window.getSceneState()                                    // Volledige scene state
window.isSceneReady()                                     // Yjs sync status
window.addTestBox([x, y, z])                             // Voeg test box toe
window.removeTestObject(id)                              // Verwijder object
window.updateTestObjectPosition(id, [x, y, z])          // Update positie
window.updateTestObjectRotation(id, [x, y, z])          // Update rotatie
window.updateTestObjectScale(id, [x, y, z])             // Update schaal
window.updateTestObjectColor(id, color)                 // Update kleur (hex: '#FF0000')
window.resetCameraView()                                 // Reset camera naar isometrische view
```

Deze functies worden alleen geladen in development mode.

### Camera Reset voor Conflict Testing

Alle conflict E2E tests starten met camera reset naar **isometrische view** [10, 10, 10]:
- Consistent viewpoint voor reproduceerbare video captures
- Object transformations zijn visueel duidelijk zichtbaar
- Vermijdt UI-related race conditions
- Helper in fixtures: `resetCameraForAllUsers(users)`

**Hoe het werkt in E2E tests:**
```typescript
await setUserName(users[0], 'Alice');
await setUserName(users[1], 'Bob');
await waitForSceneReady(users[0]);
await waitForSceneReady(users[1]);
await resetCameraForAllUsers(users);  // Reset both browsers to isometric view

// Nu zien beide users dezelfde camera angle
```

## Configuratie

### vitest.config.ts

- Environment: jsdom
- Timeout: 10s (voor sync tests)
- Single fork per test file (state isolatie)

### playwright.config.ts

- Dual web server (Yjs server + Vite dev server)
- Sequential execution voor collaboration tests
- Video recording bij failures
- Network conditioning support

## Tips & Tricks voor Onderzoek

### Test Output Verzamelen

**Conflict resolution logs verzamelen:**
```bash
# Sla test output in bestand op
npm run test:run -- src/test/conflict-resolution.test.ts > conflict-results.txt 2>&1

# Of met filtering
npm run test:run -- --grep "statistics" > stats.txt 2>&1
```

De logs bevatten:
```
Conflict result - position: [x, y, z]
Conflict result - color: #XXXXXX
Parent conflict - result parentId: parent-A
120-user conflict result: {...}
```

### Video Recording van E2E Tests

E2E tests met failure video's (helpt onderzoeken wat er is gebeurd):
```bash
# Videos worden automatisch opgeslagen in playwright-report/ bij failures
npm run test:e2e -- conflict-scenarios.spec.ts

# Oder force video recording alle tests
PWVIDEO=1 npm run test:e2e -- conflict-scenarios.spec.ts
```

Bekijk video's in `playwright-report/index.html`

### Headed Mode voor Visueel Onderzoek

Zie de browsers live:
```bash
# Beide browser tabs open, zie concurrent operations
npm run test:e2e:headed -- conflict-scenarios.spec.ts

# Laat browser pause bij failure
PWDEBUG=1 npm run test:e2e -- conflict-scenarios.spec.ts
```

In debug mode:
- Pause at breakpoints
- Step through interactions
- Inspect state met dev tools
- Screenshots maken

### Data Loss Pattern Onderzoeken

Analyseer welke properties verloren gaan:

```bash
npm run test:run -- --grep "concurrent update data loss"
```

Output toont:
```
Concurrent updates result: {position: [...], rotation: [...], color: ...}
User1 expected: position=[5,5,5], scale=[2,2,2]
User2 expected: rotation=[1,1,1], color=#00FF00
```

→ Vergelijk expected vs actual om loss pattern te onderzoeken

### Replication reproducibility

Bepaalde conflicts kunnen non-deterministisch zijn. Om herhaalbaarheid te testen:

```bash
# Draai dezelfde test 10x
for i in {1..10}; do 
  npm run test:run -- --grep "statistics" >> results-$i.txt 2>&1
done

# Vergelijk resultaten
diff results-1.txt results-2.txt
```

## Bestandsstructuur voor Onderzoek

**Documenteer je experiment:**
```
onderzoek/
├── experiment-1/
│   ├── test-run.txt           # Test output logs
│   ├── analysis.md            # Je analyse
│   └── conflict-patterns.json  # Extracted data
├── experiment-2/
│   └── ...
└── summary.md                 # Overzicht bevindingen
```

**Voeg test output toe aan git voor versiebeheer:**
```bash
git add onderzoek/experiment-1/test-run.txt
git commit -m "Add test results for conflict experiment 1"
```
