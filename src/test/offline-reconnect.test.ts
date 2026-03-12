/**
 * Offline/Reconnect Tests
 * 
 * Deze tests simuleren network failures en testen hoe de applicatie
 * omgaat met offline bewerkingen en reconnects.
 * 
 * Test scenario's:
 * 1. Eén gebruiker gaat offline, doet bewerkingen, komt weer online
 * 2. Beide gebruikers gaan offline, doen bewerkingen, komen tegelijk online
 * 3. Langdurige offline periodes met veel bewerkingen
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TestCollaborationEnvironment,
  addSceneObject,
  updateSceneObject,
  removeSceneObject,
  getSceneObjects,
  getSceneObject,
  createTestBox,
  type TestUser,
  type TestSceneObject,
} from './utils/yjs-test-utils';

describe('Offline/Reconnect Scenarios', () => {
  let env: TestCollaborationEnvironment;
  let user1: TestUser;
  let user2: TestUser;

  beforeEach(() => {
    env = new TestCollaborationEnvironment();
    user1 = env.addUser('user1', 'Alice');
    user2 = env.addUser('user2', 'Bob');
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('Single User Offline', () => {
    /**
     * Scenario: User2 gaat offline, User1 maakt wijzigingen,
     * User2 komt weer online en moet de wijzigingen ontvangen
     */
    it('should sync changes made while user was offline', () => {
      // Start met een gedeeld object
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0]
      }));

      // User2 gaat offline
      env.disconnectUser('user2');

      // User1 maakt wijzigingen terwijl User2 offline is
      updateSceneObject(user1.doc, 'box-1', { position: [10, 10, 10] });
      addSceneObject(user1.doc, createTestBox({ id: 'box-2' }));
      updateSceneObject(user1.doc, 'box-1', { color: '#FF0000' });

      // User2 ziet nog de oude state
      expect(getSceneObject(user2.doc, 'box-1')?.position).toEqual([0, 0, 0]);
      expect(getSceneObjects(user2.doc)).toHaveLength(1);

      // User2 komt weer online
      env.reconnectUser('user2');

      // User2 moet nu alle wijzigingen hebben
      expect(getSceneObject(user2.doc, 'box-1')?.position).toEqual([10, 10, 10]);
      expect(getSceneObject(user2.doc, 'box-1')?.color).toBe('#FF0000');
      expect(getSceneObjects(user2.doc)).toHaveLength(2);
    });

    /**
     * Scenario: Offline user maakt wijzigingen die gesynct moeten worden bij reconnect
     * 
     * Let op: In onze test omgeving worden updates direct gebroadcast naar
     * verbonden users. Alleen disconnected users missen updates.
     */
    it('should sync offline changes when user reconnects', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));

      // User2 gaat offline
      env.disconnectUser('user2');

      // User2 maakt wijzigingen terwijl offline
      updateSceneObject(user2.doc, 'box-1', { position: [99, 99, 99] });
      addSceneObject(user2.doc, createTestBox({ id: 'box-offline' }));

      // User1 is nog verbonden en ziet de changes niet (user2 is disconnected)
      // Maar user2's changes zijn lokaal toegepast
      expect(getSceneObject(user2.doc, 'box-1')?.position).toEqual([99, 99, 99]);
      expect(getSceneObjects(user2.doc)).toHaveLength(2);

      // User2 komt weer online
      env.reconnectUser('user2');

      // Nu moet User1 de wijzigingen van User2 zien
      expect(getSceneObject(user1.doc, 'box-1')?.position).toEqual([99, 99, 99]);
      expect(getSceneObjects(user1.doc)).toHaveLength(2);
      expect(getSceneObject(user1.doc, 'box-offline')).toBeDefined();
    });

    /**
     * Scenario: Bidirectionele sync na offline periode
     */
    it('should handle bidirectional sync after offline period', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'shared-box' }));

      env.disconnectUser('user2');

      // User1 maakt box-A terwijl User2 offline is
      addSceneObject(user1.doc, createTestBox({ id: 'box-A' }));

      // User2 maakt box-B terwijl offline
      addSceneObject(user2.doc, createTestBox({ id: 'box-B' }));

      // Reconnect
      env.reconnectUser('user2');

      // Beide users moeten alle boxes zien
      const objects1 = getSceneObjects(user1.doc).map((o: TestSceneObject) => o.id).sort();
      const objects2 = getSceneObjects(user2.doc).map((o: TestSceneObject) => o.id).sort();

      expect(objects1).toEqual(['box-A', 'box-B', 'shared-box']);
      expect(objects2).toEqual(['box-A', 'box-B', 'shared-box']);
    });
  });

  describe('Both Users Offline Simultaneously', () => {
    /**
     * KRITIEK SCENARIO: Beide gebruikers gaan offline en doen 
     * tegelijkertijd bewerkingen die daarna gemerged moeten worden.
     */
    it('should merge changes when both users were offline', () => {
      // Start situatie: 1 gedeelde box
      addSceneObject(user1.doc, createTestBox({ 
        id: 'original-box',
        position: [0, 0, 0]
      }));

      // BEIDE users gaan offline (simuleer network outage)
      env.disconnectAllUsers();

      // User1 maakt bewerkingen offline
      addSceneObject(user1.doc, createTestBox({ 
        id: 'user1-box', 
        color: '#FF0000' 
      }));
      updateSceneObject(user1.doc, 'original-box', { position: [5, 0, 0] });
      
      // User2 maakt ANDERE bewerkingen offline
      addSceneObject(user2.doc, createTestBox({ 
        id: 'user2-box', 
        color: '#0000FF' 
      }));
      updateSceneObject(user2.doc, 'original-box', { position: [0, 5, 0] });

      // Controleer dat ze nu verschillende states hebben
      expect(getSceneObjects(user1.doc)).toHaveLength(2); // original + user1
      expect(getSceneObjects(user2.doc)).toHaveLength(2); // original + user2

      // RECONNECT - beide komen tegelijk online
      env.reconnectAllUsers();

      // Na merge moeten beide users ALLE objecten zien
      const objects1 = getSceneObjects(user1.doc);
      const objects2 = getSceneObjects(user2.doc);

      expect(objects1).toHaveLength(3);
      expect(objects2).toHaveLength(3);

      // De IDs moeten overeenkomen
      const ids1 = objects1.map((o: TestSceneObject) => o.id).sort();
      const ids2 = objects2.map((o: TestSceneObject) => o.id).sort();
      expect(ids1).toEqual(ids2);
      expect(ids1).toContain('original-box');
      expect(ids1).toContain('user1-box');
      expect(ids1).toContain('user2-box');

      // De original-box positie is een conflict - beide moeten wel gelijk zijn
      const original1 = getSceneObject(user1.doc, 'original-box');
      const original2 = getSceneObject(user2.doc, 'original-box');
      expect(original1?.position).toEqual(original2?.position);

      console.log('Both offline - merged original-box position:', original1?.position);
    });

    /**
     * Scenario: Complexere bewerkingen terwijl beide offline
     */
    it('should handle complex operations while both offline', () => {
      // Setup: meerdere objecten
      addSceneObject(user1.doc, createTestBox({ id: 'box-A' }));
      addSceneObject(user1.doc, createTestBox({ id: 'box-B' }));
      addSceneObject(user1.doc, createTestBox({ id: 'box-C' }));

      env.disconnectAllUsers();

      // User1: verwijdert box-B, update box-A, voegt nieuwe toe
      removeSceneObject(user1.doc, 'box-B');
      updateSceneObject(user1.doc, 'box-A', { color: '#FF0000' });
      addSceneObject(user1.doc, createTestBox({ id: 'user1-new' }));

      // User2: verwijdert box-C, update box-B (die user1 verwijderde!), voegt nieuwe toe
      removeSceneObject(user2.doc, 'box-C');
      updateSceneObject(user2.doc, 'box-B', { color: '#00FF00' }); // box-B is verwijderd door user1
      addSceneObject(user2.doc, createTestBox({ id: 'user2-new' }));

      env.reconnectAllUsers();

      // Beide users moeten consistent zijn
      const objects1 = getSceneObjects(user1.doc);
      const objects2 = getSceneObjects(user2.doc);

      expect(objects1.length).toBe(objects2.length);

      const ids1 = objects1.map((o: TestSceneObject) => o.id).sort();
      const ids2 = objects2.map((o: TestSceneObject) => o.id).sort();
      expect(ids1).toEqual(ids2);

      console.log('Complex offline operations - final objects:', ids1);
      
      // box-C is verwijderd door user2, zou weg moeten zijn
      expect(ids1).not.toContain('box-C');
      
      // user1-new en user2-new moeten er zijn
      expect(ids1).toContain('user1-new');
      expect(ids1).toContain('user2-new');
    });

    /**
     * Scenario: Veel bewerkingen op hetzelfde object terwijl beide offline
     */
    it('should handle many operations on same object while offline', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'shared',
        position: [0, 0, 0]
      }));

      env.disconnectAllUsers();

      // Beide users doen 10 updates op hetzelfde object
      for (let i = 1; i <= 10; i++) {
        updateSceneObject(user1.doc, 'shared', { 
          position: [i, 0, 0] 
        });
        updateSceneObject(user2.doc, 'shared', { 
          position: [0, i, 0] 
        });
      }

      // Eindstates zijn verschillend
      const before1 = getSceneObject(user1.doc, 'shared')?.position;
      const before2 = getSceneObject(user2.doc, 'shared')?.position;
      expect(before1).toEqual([10, 0, 0]);
      expect(before2).toEqual([0, 10, 0]);

      env.reconnectAllUsers();

      // Na sync: moeten dezelfde waarde hebben
      const after1 = getSceneObject(user1.doc, 'shared')?.position;
      const after2 = getSceneObject(user2.doc, 'shared')?.position;
      expect(after1).toEqual(after2);

      console.log('Many offline ops - merged position:', after1);
    });
  });

  describe('Extended Offline Periods', () => {
    /**
     * Scenario: Simuleer een langere offline periode met veel operaties
     */
    it('should handle extended offline period with many operations', () => {
      // Initiële setup
      for (let i = 0; i < 5; i++) {
        addSceneObject(user1.doc, createTestBox({ id: `initial-${i}` }));
      }

      env.disconnectAllUsers();

      // Simuleer veel operaties gedurende "lange" offline periode
      // User1: voeg 10 objecten toe, update 5, verwijder 2
      for (let i = 0; i < 10; i++) {
        addSceneObject(user1.doc, createTestBox({ 
          id: `user1-offline-${i}`,
          position: [i, 0, 0]
        }));
      }
      for (let i = 0; i < 5; i++) {
        updateSceneObject(user1.doc, `initial-${i}`, { 
          color: `#${i}00000`
        });
      }
      removeSceneObject(user1.doc, 'initial-0');
      removeSceneObject(user1.doc, 'initial-1');

      // User2: voeg 8 objecten toe, update 3, verwijder 1
      for (let i = 0; i < 8; i++) {
        addSceneObject(user2.doc, createTestBox({ 
          id: `user2-offline-${i}`,
          position: [0, i, 0]
        }));
      }
      for (let i = 2; i < 5; i++) {
        updateSceneObject(user2.doc, `initial-${i}`, { 
          scale: [i, i, i] as [number, number, number]
        });
      }
      removeSceneObject(user2.doc, 'initial-4');

      env.reconnectAllUsers();

      // Verify consistency
      const objects1 = getSceneObjects(user1.doc);
      const objects2 = getSceneObjects(user2.doc);

      expect(objects1.length).toBe(objects2.length);

      // Check dat specifieke objecten er zijn
      const ids = objects1.map((o: TestSceneObject) => o.id);
      
      // initial-0 en initial-1 zijn verwijderd door user1
      expect(ids).not.toContain('initial-0');
      expect(ids).not.toContain('initial-1');
      
      // Note: initial-4 conflict - user2 verwijdert het, user1 niet
      // Het resultaat hangt af van Yjs conflict resolution
      // We testen alleen dat de state consistent is tussen users
      
      // initial-2 en initial-3 moeten er nog zijn
      expect(ids).toContain('initial-2');
      expect(ids).toContain('initial-3');

      console.log(`Extended offline - total objects: ${objects1.length}`);
      console.log('Final object IDs:', ids.sort());
    });
  });

  describe('Reconnect Order Variations', () => {
    /**
     * Scenario: Users reconnecten in verschillende volgorde
     */
    it('should produce consistent state regardless of reconnect order', async () => {
      addSceneObject(user1.doc, createTestBox({ id: 'shared' }));

      env.disconnectAllUsers();

      // Beide doen bewerkingen
      addSceneObject(user1.doc, createTestBox({ id: 'user1-box' }));
      addSceneObject(user2.doc, createTestBox({ id: 'user2-box' }));
      updateSceneObject(user1.doc, 'shared', { color: '#111111' });
      updateSceneObject(user2.doc, 'shared', { color: '#222222' });

      // User1 reconnect eerst
      env.reconnectUser('user1');
      
      // Kleine delay
      await env.wait(10);

      // Dan User2
      env.reconnectUser('user2');

      // Sync alles
      env.syncAll();

      // Verify
      const objects1 = getSceneObjects(user1.doc);
      const objects2 = getSceneObjects(user2.doc);

      expect(objects1.length).toBe(objects2.length);
      expect(objects1.length).toBe(3);

      const shared1 = getSceneObject(user1.doc, 'shared');
      const shared2 = getSceneObject(user2.doc, 'shared');
      expect(shared1?.color).toBe(shared2?.color);
    });
  });

  describe('Partial Network Issues', () => {
    /**
     * Scenario: Intermittent connection - kort offline, weer online, kort offline
     */
    it('should handle intermittent connectivity', async () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));

      // Eerste disconnect
      env.disconnectUser('user2');
      updateSceneObject(user1.doc, 'box-1', { position: [1, 0, 0] });
      
      // Reconnect
      env.reconnectUser('user2');
      expect(getSceneObject(user2.doc, 'box-1')?.position).toEqual([1, 0, 0]);

      // Tweede disconnect
      env.disconnectUser('user2');
      updateSceneObject(user1.doc, 'box-1', { position: [2, 0, 0] });
      
      // Weer reconnect
      env.reconnectUser('user2');
      expect(getSceneObject(user2.doc, 'box-1')?.position).toEqual([2, 0, 0]);

      // Derde disconnect
      env.disconnectUser('user2');
      updateSceneObject(user1.doc, 'box-1', { position: [3, 0, 0] });
      updateSceneObject(user2.doc, 'box-1', { position: [0, 3, 0] });
      
      // Finale reconnect
      env.reconnectUser('user2');

      // State moet consistent zijn
      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');
      expect(obj1?.position).toEqual(obj2?.position);
    });
  });
});
