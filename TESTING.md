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

**BELANGRIJK VOOR ONDERZOEK**: Deze tests documenteren hoe Yjs conflicten oplost.

Test scenarios:
- Same object, same property conflict (last-write-wins)
- Same object, different properties (merge)
- Add vs Delete conflict
- Concurrent add met dezelfde ID
- Parent-child relationship conflicts
- Rapid fire conflicts

De tests loggen de resultaten voor analyse:
```
Conflict result - position: [x, y, z]
```

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

## E2E Test Hooks

De applicatie heeft test hooks geïmplementeerd in `test-hooks.ts`:

```typescript
// In browser console (dev mode):
window.getSceneObjectCount()  // Aantal objecten
window.getSceneState()        // Volledige scene state
window.isSceneReady()         // Yjs sync status
window.addTestBox([x, y, z])  // Voeg test box toe
window.removeTestObject(id)   // Verwijder object
```

Deze functies worden alleen geladen in development mode.

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
