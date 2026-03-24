/**
 * Conflict Resolution Tests
 * 
 * Deze tests onderzoeken hoe conflicten worden afgehandeld wanneer meerdere
 * gebruikers tegelijk dezelfde data proberen te wijzigen.
 * 
 * BELANGRIJK: Yjs gebruikt CRDTs (Conflict-free Replicated Data Types) die
 * automatisch conflicten oplossen op basis van bepaalde regels:
 * - Last-Write-Wins voor simpele waarden
 * - Merge voor arrays en maps
 * 
 * Deze tests documenteren het huidige gedrag en dienen als basis voor
 * verder onderzoek naar scene-aware conflict resolution.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  TestCollaborationEnvironment,
  addSceneObject,
  updateSceneObject,
  removeSceneObject,
  getSceneObject,
  createTestBox,
  type TestUser,
} from './utils/yjs-test-utils';

describe('Conflict Resolution', () => {
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

  describe('Same Object - Same Property Conflicts', () => {
    /**
     * Scenario: Beide gebruikers updaten dezelfde positie van hetzelfde object
     * 
     * Dit is het meest voorkomende conflict scenario in een collaborative editor.
     * Het huidige Yjs gedrag: Last-Write-Wins (gebaseerd op client ID ordering)
     */
    it('should handle concurrent position updates (last-write-wins)', () => {
      // Setup: maak een object
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0]
      }));

      // Schakel sync uit om concurrent edits te simuleren
      env.disableSync();

      // Beide users updaten dezelfde positie tegelijk
      updateSceneObject(user1.doc, 'box-1', { position: [10, 0, 0] });
      updateSceneObject(user2.doc, 'box-1', { position: [0, 10, 0] });

      // Controleer dat ze nu verschillende waarden hebben
      const obj1Before = getSceneObject(user1.doc, 'box-1');
      const obj2Before = getSceneObject(user2.doc, 'box-1');
      
      expect(obj1Before?.position).toEqual([10, 0, 0]);
      expect(obj2Before?.position).toEqual([0, 10, 0]);

      // Schakel sync weer aan - Yjs merge de changes
      env.enableSync();

      // Na sync moeten beide dezelfde waarde hebben
      const obj1After = getSceneObject(user1.doc, 'box-1');
      const obj2After = getSceneObject(user2.doc, 'box-1');
      
      // De exacte waarde hangt af van Yjs's conflict resolution
      // Maar beide users MOETEN dezelfde waarde hebben
      expect(obj1After?.position).toEqual(obj2After?.position);

      // Log voor onderzoek welke waarde "wint"
      console.log('Conflict result - position:', obj1After?.position);
    });

    /**
     * Scenario: Beide gebruikers updaten dezelfde kleur
     */
    it('should handle concurrent color updates', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        color: '#FFFFFF'
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { color: '#FF0000' }); // Rood
      updateSceneObject(user2.doc, 'box-1', { color: '#0000FF' }); // Blauw

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      // Beide moeten dezelfde kleur hebben na sync
      expect(obj1?.color).toBe(obj2?.color);
      
      // Log voor onderzoek
      console.log('Conflict result - color:', obj1?.color);
    });

    /**
     * Scenario: Beide gebruikers updaten rotation tegelijk
     */
    it('should handle concurrent rotation updates', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        rotation: [0, 0, 0]
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { rotation: [Math.PI/2, 0, 0] });
      updateSceneObject(user2.doc, 'box-1', { rotation: [0, Math.PI/2, 0] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1?.rotation).toEqual(obj2?.rotation);
      
      console.log('Conflict result - rotation:', obj1?.rotation);
    });

    /**
     * Scenario: Beide gebruikers updaten scale tegelijk
     */
    it('should handle concurrent scale updates', () => {
      addSceneObject(user1.doc, createTestBox({
        id: 'box-1',
        scale: [1, 1, 1]
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { scale: [2, 1, 1] });
      updateSceneObject(user2.doc, 'box-1', { scale: [1, 2, 1] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1?.scale).toEqual(obj2?.scale);

      console.log('Conflict result - scale:', obj1?.scale);
    });
  });

  describe('Same Object - Different Property Updates', () => {
    /**
     * BELANGRIJK INZICHT: Y.Map.set() vervangt het HELE object!
     * 
     * Wanneer twee users verschillende properties updaten, maar het hele object
     * wordt vervangen (niet individuele velden), dan "wint" één van de updates
     * en gaat de andere verloren.
     * 
     * Dit is een fundamentele beperking van de huidige implementatie waar
     * sceneStore.updateObject het hele object vervangt met yobjects.set().
     * 
     * OPLOSSING voor je onderzoek: Gebruik Y.Map per object met nested Y.Map
     * voor properties, of gebruik Y.Doc sub-documenten.
     */
    it('should document that whole-object replacement loses concurrent updates', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0],
        color: '#FFFFFF'
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { position: [10, 10, 10] });
      updateSceneObject(user2.doc, 'box-1', { color: '#FF0000' });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      // Beide moeten consistent zijn (dat is het belangrijkste)
      expect(obj1).toEqual(obj2);
      
      // MAAR: één van de updates is verloren gegaan omdat het hele object
      // werd vervangen. Dit documenteert het huidige gedrag.
      console.log('Whole-object replacement result:', obj1);
      console.log('Note: One update was lost due to whole-object replacement');
    });

    /**
     * INZICHT: Meerdere updates van dezelfde user worden wel correct toegepast,
     * maar bij concurrent edits van verschillende users gaat data verloren.
     */
    it('should document concurrent update data loss', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#FFFFFF'
      }));

      env.disableSync();

      // User1 update positie en scale
      updateSceneObject(user1.doc, 'box-1', { position: [5, 5, 5] });
      updateSceneObject(user1.doc, 'box-1', { scale: [2, 2, 2] });

      // User2 update rotation en color
      updateSceneObject(user2.doc, 'box-1', { rotation: [1, 1, 1] });
      updateSceneObject(user2.doc, 'box-1', { color: '#00FF00' });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      // Beide users MOETEN dezelfde state zien - dat is het belangrijkste
      expect(obj1).toEqual(obj2);

      // Log voor onderzoek - dit toont welke user's updates behouden zijn
      console.log('Concurrent updates result:', obj1);
      console.log('User1 expected: position=[5,5,5], scale=[2,2,2]');
      console.log('User2 expected: rotation=[1,1,1], color=#00FF00');
    });

    /**
     * Scenario: User1 verplaatst object terwijl User2 roteert
     */
    it('should document move-vs-rotate conflict behavior', () => {
      addSceneObject(user1.doc, createTestBox({
        id: 'box-1',
        position: [0, 0, 0],
        rotation: [0, 0, 0]
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { position: [8, 0, 0] });
      updateSceneObject(user2.doc, 'box-1', { rotation: [0, Math.PI / 2, 0] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1).toEqual(obj2);

      console.log('Move-vs-rotate result:', obj1);
      console.log('Note: concurrent operation types may overwrite each other due to whole-object replacement');
    });

    /**
     * Scenario: User1 roteert terwijl User2 resize doet
     */
    it('should document rotate-vs-scale conflict behavior', () => {
      addSceneObject(user1.doc, createTestBox({
        id: 'box-1',
        rotation: [0, 0, 0],
        scale: [1, 1, 1]
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'box-1', { rotation: [Math.PI / 4, 0, 0] });
      updateSceneObject(user2.doc, 'box-1', { scale: [3, 1, 1] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1).toEqual(obj2);

      console.log('Rotate-vs-scale result:', obj1);
    });
  });

  describe('Add vs Delete Conflicts', () => {
    /**
     * Scenario: User1 verwijdert een object terwijl User2 het probeert te updaten
     * 
     * Dit is een interessant conflict: wat gebeurt er als een object verwijderd
     * wordt terwijl een andere gebruiker het aan het bewerken is?
     */
    it('should handle delete vs update conflict', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));

      env.disableSync();

      // User1 verwijdert het object
      removeSceneObject(user1.doc, 'box-1');

      // User2 probeert het te updaten (weet niet dat het verwijderd is)
      updateSceneObject(user2.doc, 'box-1', { position: [99, 99, 99] });

      env.enableSync();

      // Na sync: wat gebeurt er?
      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      // Log voor onderzoek
      console.log('Delete vs Update - User1 sees:', obj1);
      console.log('Delete vs Update - User2 sees:', obj2);

      // Beide moeten consistent zijn (wat de uitkomst ook is)
      expect(obj1).toEqual(obj2);
    });

    /**
     * Scenario: User1 verwijdert terwijl User2 roteert
     */
    it('should handle delete vs rotate conflict', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1', rotation: [0, 0, 0] }));

      env.disableSync();

      removeSceneObject(user1.doc, 'box-1');
      updateSceneObject(user2.doc, 'box-1', { rotation: [0, Math.PI / 2, 0] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1).toEqual(obj2);

      console.log('Delete vs Rotate - result:', obj1);
    });

    /**
     * Scenario: User1 verwijdert terwijl User2 kleur aanpast
     */
    it('should handle delete vs color conflict', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1', color: '#FFFFFF' }));

      env.disableSync();

      removeSceneObject(user1.doc, 'box-1');
      updateSceneObject(user2.doc, 'box-1', { color: '#00FF00' });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      expect(obj1).toEqual(obj2);

      console.log('Delete vs Color - result:', obj1);
    });

    /**
     * Scenario: Beide users proberen een object toe te voegen met dezelfde ID
     */
    it('should handle concurrent add with same ID', () => {
      env.disableSync();

      // Beide users maken een object met dezelfde ID maar andere eigenschappen
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-conflict',
        color: '#FF0000',
        position: [1, 0, 0]
      }));
      
      addSceneObject(user2.doc, createTestBox({ 
        id: 'box-conflict',
        color: '#0000FF',
        position: [0, 1, 0]
      }));

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-conflict');
      const obj2 = getSceneObject(user2.doc, 'box-conflict');

      // Beide moeten consistent zijn
      expect(obj1).toEqual(obj2);

      // Log voor onderzoek
      console.log('Same ID conflict - result:', obj1);
    });
  });

  describe('Parent-Child Relationship Conflicts', () => {
    /**
     * Scenario: Beide users proberen hetzelfde object aan een andere parent te linken
     */
    it('should handle concurrent parent assignment', () => {
      // Maak 3 objecten: 2 potentiële parents en 1 child
      addSceneObject(user1.doc, createTestBox({ id: 'parent-A' }));
      addSceneObject(user1.doc, createTestBox({ id: 'parent-B' }));
      addSceneObject(user1.doc, createTestBox({ id: 'child', parentId: null }));

      env.disableSync();

      // User1 linkt child aan parent-A
      updateSceneObject(user1.doc, 'child', { parentId: 'parent-A' });

      // User2 linkt child aan parent-B
      updateSceneObject(user2.doc, 'child', { parentId: 'parent-B' });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'child');
      const obj2 = getSceneObject(user2.doc, 'child');

      // De child moet dezelfde parent hebben bij beide users
      expect(obj1?.parentId).toBe(obj2?.parentId);

      console.log('Parent conflict - result parentId:', obj1?.parentId);
    });

    /**
     * Scenario: User1 unlinkt een child terwijl User2 de child beweegt
     */
    it('should handle concurrent unlink and move', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'parent',
        childIds: ['child']
      }));
      addSceneObject(user1.doc, createTestBox({ 
        id: 'child', 
        parentId: 'parent',
        position: [0, 0, 0]
      }));

      env.disableSync();

      // User1 unlinkt de child
      updateSceneObject(user1.doc, 'child', { parentId: null });

      // User2 beweegt de child (nog relatief aan parent)
      updateSceneObject(user2.doc, 'child', { position: [5, 5, 5] });

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'child');
      const obj2 = getSceneObject(user2.doc, 'child');

      expect(obj1).toEqual(obj2);

      console.log('Unlink vs Move - result:', obj1);
    });

    /**
     * Scenario: Parent wordt verplaatst terwijl child tegelijk lokaal wordt bewerkt
     */
    it('should document parent-move while child-is-edited behavior', () => {
      addSceneObject(user1.doc, createTestBox({
        id: 'parent',
        position: [0, 0, 0],
        childIds: ['child']
      }));
      addSceneObject(user1.doc, createTestBox({
        id: 'child',
        parentId: 'parent',
        position: [1, 0, 0],
        rotation: [0, 0, 0]
      }));

      env.disableSync();

      updateSceneObject(user1.doc, 'parent', { position: [10, 0, 0] });
      updateSceneObject(user2.doc, 'child', { rotation: [0, 0, Math.PI / 2] });

      env.enableSync();

      const parent1 = getSceneObject(user1.doc, 'parent');
      const parent2 = getSceneObject(user2.doc, 'parent');
      const child1 = getSceneObject(user1.doc, 'child');
      const child2 = getSceneObject(user2.doc, 'child');

      expect(parent1).toEqual(parent2);
      expect(child1).toEqual(child2);

      console.log('Parent move + child edit result:', { parent: parent1, child: child1 });
    });

    /**
     * Scenario: Beide users linken hetzelfde child object naar verschillende parents
     * met childIds updates op parent objecten.
     */
    it('should document parent-child invariant drift during concurrent reparenting', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'parent-A', childIds: [] }));
      addSceneObject(user1.doc, createTestBox({ id: 'parent-B', childIds: [] }));
      addSceneObject(user1.doc, createTestBox({ id: 'child', parentId: null, childIds: [] }));

      env.disableSync();

      updateSceneObject(user1.doc, 'child', { parentId: 'parent-A' });
      updateSceneObject(user1.doc, 'parent-A', { childIds: ['child'] });

      updateSceneObject(user2.doc, 'child', { parentId: 'parent-B' });
      updateSceneObject(user2.doc, 'parent-B', { childIds: ['child'] });

      env.enableSync();

      const child = getSceneObject(user1.doc, 'child');
      const parentA = getSceneObject(user1.doc, 'parent-A');
      const parentB = getSceneObject(user1.doc, 'parent-B');

      const inA = Boolean(parentA?.childIds?.includes('child'));
      const inB = Boolean(parentB?.childIds?.includes('child'));

      expect(getSceneObject(user1.doc, 'child')).toEqual(getSceneObject(user2.doc, 'child'));
      expect(getSceneObject(user1.doc, 'parent-A')).toEqual(getSceneObject(user2.doc, 'parent-A'));
      expect(getSceneObject(user1.doc, 'parent-B')).toEqual(getSceneObject(user2.doc, 'parent-B'));

      console.log('Concurrent reparenting result:', {
        childParentId: child?.parentId,
        parentAChildIds: parentA?.childIds,
        parentBChildIds: parentB?.childIds,
        linkedInA: inA,
        linkedInB: inB
      });
    });
  });

  describe('Rapid Fire Conflict Scenarios', () => {
    /**
     * Scenario: Veel snelle updates van beide users op hetzelfde object
     */
    it('should handle rapid concurrent updates', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0]
      }));

      env.disableSync();

      // Beide users doen 20 snelle updates
      for (let i = 0; i < 20; i++) {
        updateSceneObject(user1.doc, 'box-1', { 
          position: [i, 0, 0] 
        });
        updateSceneObject(user2.doc, 'box-1', { 
          position: [0, i, 0] 
        });
      }

      env.enableSync();

      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');

      // Moeten consistent zijn
      expect(obj1?.position).toEqual(obj2?.position);

      console.log('Rapid fire - final position:', obj1?.position);
    });

    /**
     * Scenario: Beide users doen meerdere operaties in dezelfde conflict window
     */
    it('should document batched-multi-operation conflicts', () => {
      addSceneObject(user1.doc, createTestBox({
        id: 'box-1',
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#FFFFFF'
      }));

      env.disableSync();

      // Reeks user1
      updateSceneObject(user1.doc, 'box-1', { position: [1, 0, 0] });
      updateSceneObject(user1.doc, 'box-1', { position: [3, 0, 0] });
      updateSceneObject(user1.doc, 'box-1', { rotation: [0, Math.PI / 3, 0] });

      // Reeks user2
      updateSceneObject(user2.doc, 'box-1', { color: '#FF0000' });
      updateSceneObject(user2.doc, 'box-1', { scale: [2, 2, 2] });
      updateSceneObject(user2.doc, 'box-1', { position: [0, 4, 0] });

      env.enableSync();

      const final1 = getSceneObject(user1.doc, 'box-1');
      const final2 = getSceneObject(user2.doc, 'box-1');

      expect(final1).toEqual(final2);
      console.log('Batched multi-operation result:', final1);
    });

    /**
     * Scenario: Schaalbaarheid - >100 gebruikers werken tegelijk op hetzelfde object
     */
    it('should keep eventual consistency with 120 users editing one object', () => {
      const manyUsers = [user1, user2];
      for (let i = 3; i <= 120; i++) {
        manyUsers.push(env.addUser(`user${i}`, `User ${i}`));
      }

      addSceneObject(user1.doc, createTestBox({ id: 'shared-box', position: [0, 0, 0] }));

      env.disableSync();

      manyUsers.forEach((u, index) => {
        updateSceneObject(u.doc, 'shared-box', {
          position: [index, index % 5, 0],
          color: `#${((index + 1) * 11111).toString(16).slice(0, 6).padEnd(6, '0')}`
        });
      });

      env.enableSync();

      const baseline = getSceneObject(manyUsers[0].doc, 'shared-box');

      manyUsers.forEach((u) => {
        expect(getSceneObject(u.doc, 'shared-box')).toEqual(baseline);
      });

      console.log('120-user conflict result:', baseline);
    });

    /**
     * Scenario: Schaalbaarheid op parent-child ketting
     */
    it('should keep a converged state under concurrent chain edits', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'root', childIds: ['node-1'] }));
      addSceneObject(user1.doc, createTestBox({ id: 'node-1', parentId: 'root', childIds: ['node-2'] }));
      addSceneObject(user1.doc, createTestBox({ id: 'node-2', parentId: 'node-1', childIds: [] }));

      env.disableSync();

      for (let i = 0; i < 15; i++) {
        updateSceneObject(user1.doc, 'root', { position: [i, 0, 0] });
        updateSceneObject(user2.doc, 'node-2', { rotation: [0, 0, i * 0.1] });
      }

      env.enableSync();

      expect(getSceneObject(user1.doc, 'root')).toEqual(getSceneObject(user2.doc, 'root'));
      expect(getSceneObject(user1.doc, 'node-1')).toEqual(getSceneObject(user2.doc, 'node-1'));
      expect(getSceneObject(user1.doc, 'node-2')).toEqual(getSceneObject(user2.doc, 'node-2'));

      console.log('Chain conflict result:', {
        root: getSceneObject(user1.doc, 'root'),
        node1: getSceneObject(user1.doc, 'node-1'),
        node2: getSceneObject(user1.doc, 'node-2')
      });
    });
  });

  describe('Conflict Resolution Analysis', () => {
    /**
     * Deze test verzamelt data over conflict resolution gedrag
     * voor verder onderzoek
     */
    it('should collect conflict resolution statistics', () => {
      const results: {
        scenario: string;
        user1Value: any;
        user2Value: any;
        finalValue: any;
        winner: string;
      }[] = [];

      // Test meerdere scenario's
      for (let i = 0; i < 10; i++) {
        const boxId = `box-${i}`;
        
        addSceneObject(user1.doc, createTestBox({ 
          id: boxId,
          position: [0, 0, 0]
        }));

        env.disableSync();

        const user1Pos: [number, number, number] = [i + 1, 0, 0];
        const user2Pos: [number, number, number] = [0, i + 1, 0];

        updateSceneObject(user1.doc, boxId, { position: user1Pos });
        updateSceneObject(user2.doc, boxId, { position: user2Pos });

        env.enableSync();

        const finalObj = getSceneObject(user1.doc, boxId);
        
        results.push({
          scenario: `Position conflict ${i}`,
          user1Value: user1Pos,
          user2Value: user2Pos,
          finalValue: finalObj?.position,
          winner: JSON.stringify(finalObj?.position) === JSON.stringify(user1Pos) 
            ? 'user1' 
            : JSON.stringify(finalObj?.position) === JSON.stringify(user2Pos)
              ? 'user2'
              : 'merged/unknown'
        });
      }

      // Log statistieken
      const user1Wins = results.filter(r => r.winner === 'user1').length;
      const user2Wins = results.filter(r => r.winner === 'user2').length;
      
      console.log('=== Conflict Resolution Statistics ===');
      console.log(`User1 wins: ${user1Wins}/${results.length}`);
      console.log(`User2 wins: ${user2Wins}/${results.length}`);
      console.log('Details:', JSON.stringify(results, null, 2));

      // Verify consistency
      expect(results.every(r => r.finalValue !== undefined)).toBe(true);
    });
  });
});
