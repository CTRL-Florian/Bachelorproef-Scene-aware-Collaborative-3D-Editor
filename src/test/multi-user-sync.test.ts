/**
 * Multi-user synchronisatie tests
 * 
 * Deze tests verifiëren dat wijzigingen correct synchroniseren tussen
 * meerdere gebruikers in real-time.
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

describe('Multi-User Synchronization', () => {
  let env: TestCollaborationEnvironment;
  let user1: TestUser;
  let user2: TestUser;
  let user3: TestUser;

  beforeEach(() => {
    env = new TestCollaborationEnvironment();
    user1 = env.addUser('user1', 'Alice');
    user2 = env.addUser('user2', 'Bob');
    user3 = env.addUser('user3', 'Charlie');
  });

  afterEach(() => {
    env.cleanup();
  });

  describe('Basic Sync', () => {
    it('should sync new object from user1 to user2', () => {
      // User1 voegt een box toe
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));

      // Controleer dat user2 het ook ziet
      const objectsUser2 = getSceneObjects(user2.doc);
      expect(objectsUser2).toHaveLength(1);
      expect(objectsUser2[0].id).toBe('box-1');
    });

    it('should sync object updates between users', () => {
      // User1 maakt een object
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1', 
        position: [0, 0, 0] 
      }));

      // User2 update de positie
      updateSceneObject(user2.doc, 'box-1', { 
        position: [10, 10, 10] 
      });

      // User1 zou de update moeten zien
      const objUser1 = getSceneObject(user1.doc, 'box-1');
      expect(objUser1?.position).toEqual([10, 10, 10]);
    });

    it('should sync object deletion to all users', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));
      addSceneObject(user1.doc, createTestBox({ id: 'box-2' }));

      // User2 verwijdert een object
      removeSceneObject(user2.doc, 'box-1');

      // Alle users zouden dit moeten zien
      expect(getSceneObjects(user1.doc)).toHaveLength(1);
      expect(getSceneObjects(user2.doc)).toHaveLength(1);
      expect(getSceneObjects(user3.doc)).toHaveLength(1);
    });

    it('should sync to multiple users simultaneously', () => {
      // User1 voegt 3 objecten toe
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));
      addSceneObject(user1.doc, createTestBox({ id: 'box-2' }));
      addSceneObject(user1.doc, createTestBox({ id: 'box-3' }));

      // Alle users zouden 3 objecten moeten hebben
      expect(getSceneObjects(user1.doc)).toHaveLength(3);
      expect(getSceneObjects(user2.doc)).toHaveLength(3);
      expect(getSceneObjects(user3.doc)).toHaveLength(3);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent adds from different users', () => {
      // Beide users voegen tegelijk een object toe
      addSceneObject(user1.doc, createTestBox({ id: 'box-user1' }));
      addSceneObject(user2.doc, createTestBox({ id: 'box-user2' }));

      // Beide zouden 2 objecten moeten hebben
      expect(getSceneObjects(user1.doc)).toHaveLength(2);
      expect(getSceneObjects(user2.doc)).toHaveLength(2);
      
      // En dezelfde IDs
      const ids1 = getSceneObjects(user1.doc).map((o: TestSceneObject) => o.id).sort();
      const ids2 = getSceneObjects(user2.doc).map((o: TestSceneObject) => o.id).sort();
      expect(ids1).toEqual(ids2);
    });

    it('should handle concurrent updates to different properties', () => {
      addSceneObject(user1.doc, createTestBox({ 
        id: 'box-1',
        position: [0, 0, 0],
        color: '#FF0000'
      }));

      // User1 update positie, User2 update kleur tegelijk
      updateSceneObject(user1.doc, 'box-1', { position: [5, 5, 5] });
      updateSceneObject(user2.doc, 'box-1', { color: '#00FF00' });

      // Beide updates zouden gemerged moeten zijn
      const obj1 = getSceneObject(user1.doc, 'box-1');
      const obj2 = getSceneObject(user2.doc, 'box-1');
      
      // Beide users zouden dezelfde state moeten zien
      expect(obj1?.color).toBe(obj2?.color);
      expect(obj1?.position).toEqual(obj2?.position);
    });

    it('should handle rapid sequential updates', async () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));

      // 10 snelle updates achter elkaar
      for (let i = 0; i < 10; i++) {
        updateSceneObject(user1.doc, 'box-1', { 
          position: [i, i, i] 
        });
      }

      // User2 zou de laatste state moeten hebben
      const obj = getSceneObject(user2.doc, 'box-1');
      expect(obj?.position).toEqual([9, 9, 9]);
    });
  });

  describe('Three Users Collaboration', () => {
    it('should sync changes from all three users', () => {
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));
      addSceneObject(user2.doc, createTestBox({ id: 'box-2' }));
      addSceneObject(user3.doc, createTestBox({ id: 'box-3' }));

      // Alle users zouden 3 objecten moeten hebben
      const objects1 = getSceneObjects(user1.doc);
      const objects2 = getSceneObjects(user2.doc);
      const objects3 = getSceneObjects(user3.doc);

      expect(objects1).toHaveLength(3);
      expect(objects2).toHaveLength(3);
      expect(objects3).toHaveLength(3);
    });

    it('should maintain consistency after multiple operations', () => {
      // Complex scenario met meerdere operaties
      addSceneObject(user1.doc, createTestBox({ id: 'box-1' }));
      addSceneObject(user2.doc, createTestBox({ id: 'box-2' }));
      
      updateSceneObject(user3.doc, 'box-1', { color: '#0000FF' });
      removeSceneObject(user1.doc, 'box-2');
      
      addSceneObject(user2.doc, createTestBox({ id: 'box-3' }));
      updateSceneObject(user1.doc, 'box-3', { position: [1, 2, 3] });

      // Alle users moeten dezelfde state hebben
      const state1 = getSceneObjects(user1.doc).map((o: TestSceneObject) => o.id).sort();
      const state2 = getSceneObjects(user2.doc).map((o: TestSceneObject) => o.id).sort();
      const state3 = getSceneObjects(user3.doc).map((o: TestSceneObject) => o.id).sort();

      expect(state1).toEqual(state2);
      expect(state2).toEqual(state3);
    });
  });
});
