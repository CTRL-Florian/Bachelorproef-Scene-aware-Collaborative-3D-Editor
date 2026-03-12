/**
 * Unit tests voor YJS Scene Store - basis CRUD operaties
 * 
 * Deze tests verifiëren de basisfunctionaliteit van de scene store:
 * - Object toevoegen
 * - Object verwijderen
 * - Object updaten (positie, rotatie, schaal, kleur)
 * - Parent-child linking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as Y from 'yjs';
import {
  TestCollaborationEnvironment,
  addSceneObject,
  updateSceneObject,
  removeSceneObject,
  getSceneObjects,
  getSceneObject,
  createTestBox,
  type TestSceneObject,
} from './utils/yjs-test-utils';

describe('YJS Scene Store - CRUD Operations', () => {
  let env: TestCollaborationEnvironment;
  let doc: Y.Doc;

  beforeEach(() => {
    env = new TestCollaborationEnvironment();
    const user = env.addUser('user1', 'Test User');
    doc = user.doc;
  });

  describe('Add Object', () => {
    it('should add a new box to the scene', () => {
      const box = createTestBox({ id: 'box-1' });
      addSceneObject(doc, box);

      const objects = getSceneObjects(doc);
      expect(objects).toHaveLength(1);
      expect(objects[0].id).toBe('box-1');
      expect(objects[0].type).toBe('box');
    });

    it('should add multiple objects to the scene', () => {
      addSceneObject(doc, createTestBox({ id: 'box-1' }));
      addSceneObject(doc, createTestBox({ id: 'box-2' }));
      addSceneObject(doc, createTestBox({ id: 'box-3' }));

      const objects = getSceneObjects(doc);
      expect(objects).toHaveLength(3);
    });

    it('should add an object with custom position', () => {
      const position: [number, number, number] = [5, 10, -3];
      addSceneObject(doc, createTestBox({ id: 'box-1', position }));

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.position).toEqual(position);
    });

    it('should add an object with custom rotation and scale', () => {
      const rotation: [number, number, number] = [Math.PI / 4, 0, Math.PI / 2];
      const scale: [number, number, number] = [2, 3, 1];
      
      addSceneObject(doc, createTestBox({ 
        id: 'box-1', 
        rotation, 
        scale 
      }));

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.rotation).toEqual(rotation);
      expect(obj?.scale).toEqual(scale);
    });
  });

  describe('Remove Object', () => {
    it('should remove an existing object', () => {
      addSceneObject(doc, createTestBox({ id: 'box-1' }));
      addSceneObject(doc, createTestBox({ id: 'box-2' }));
      
      expect(getSceneObjects(doc)).toHaveLength(2);
      
      removeSceneObject(doc, 'box-1');
      
      const objects = getSceneObjects(doc);
      expect(objects).toHaveLength(1);
      expect(objects[0].id).toBe('box-2');
    });

    it('should handle removing non-existent object gracefully', () => {
      addSceneObject(doc, createTestBox({ id: 'box-1' }));
      
      // Dit zou geen error moeten gooien
      removeSceneObject(doc, 'non-existent');
      
      expect(getSceneObjects(doc)).toHaveLength(1);
    });
  });

  describe('Update Object', () => {
    beforeEach(() => {
      addSceneObject(doc, createTestBox({ 
        id: 'box-1', 
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        color: '#FF0000' 
      }));
    });

    it('should update object position', () => {
      const newPosition: [number, number, number] = [10, 20, 30];
      updateSceneObject(doc, 'box-1', { position: newPosition });

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.position).toEqual(newPosition);
    });

    it('should update object rotation', () => {
      const newRotation: [number, number, number] = [Math.PI, 0, Math.PI / 2];
      updateSceneObject(doc, 'box-1', { rotation: newRotation });

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.rotation).toEqual(newRotation);
    });

    it('should update object scale', () => {
      const newScale: [number, number, number] = [2, 2, 2];
      updateSceneObject(doc, 'box-1', { scale: newScale });

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.scale).toEqual(newScale);
    });

    it('should update object color', () => {
      const newColor = '#00FF00';
      updateSceneObject(doc, 'box-1', { color: newColor });

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.color).toBe(newColor);
    });

    it('should update multiple properties at once', () => {
      const updates = {
        position: [5, 5, 5] as [number, number, number],
        color: '#0000FF',
        scale: [3, 3, 3] as [number, number, number],
      };
      
      updateSceneObject(doc, 'box-1', updates);

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.position).toEqual(updates.position);
      expect(obj?.color).toBe(updates.color);
      expect(obj?.scale).toEqual(updates.scale);
    });

    it('should preserve unchanged properties when updating', () => {
      const originalPosition: [number, number, number] = [1, 2, 3];
      updateSceneObject(doc, 'box-1', { position: originalPosition });
      
      // Update alleen kleur
      updateSceneObject(doc, 'box-1', { color: '#FFFFFF' });

      const obj = getSceneObject(doc, 'box-1');
      expect(obj?.position).toEqual(originalPosition);
      expect(obj?.color).toBe('#FFFFFF');
    });
  });

  describe('Parent-Child Linking', () => {
    it('should set parent-child relationship', () => {
      addSceneObject(doc, createTestBox({ id: 'parent' }));
      addSceneObject(doc, createTestBox({ id: 'child', parentId: 'parent' }));

      const child = getSceneObject(doc, 'child');
      expect(child?.parentId).toBe('parent');
    });

    it('should support multiple children', () => {
      addSceneObject(doc, createTestBox({ 
        id: 'parent', 
        childIds: ['child1', 'child2'] 
      }));
      addSceneObject(doc, createTestBox({ id: 'child1', parentId: 'parent' }));
      addSceneObject(doc, createTestBox({ id: 'child2', parentId: 'parent' }));

      const parent = getSceneObject(doc, 'parent');
      expect(parent?.childIds).toContain('child1');
      expect(parent?.childIds).toContain('child2');
    });

    it('should update parent link', () => {
      addSceneObject(doc, createTestBox({ id: 'parent1' }));
      addSceneObject(doc, createTestBox({ id: 'parent2' }));
      addSceneObject(doc, createTestBox({ id: 'child', parentId: 'parent1' }));

      // Verplaats naar andere parent
      updateSceneObject(doc, 'child', { parentId: 'parent2' });

      const child = getSceneObject(doc, 'child');
      expect(child?.parentId).toBe('parent2');
    });

    it('should unlink from parent', () => {
      addSceneObject(doc, createTestBox({ id: 'parent' }));
      addSceneObject(doc, createTestBox({ id: 'child', parentId: 'parent' }));

      updateSceneObject(doc, 'child', { parentId: null });

      const child = getSceneObject(doc, 'child');
      expect(child?.parentId).toBeNull();
    });
  });

  afterEach(() => {
    env.cleanup();
  });
});
