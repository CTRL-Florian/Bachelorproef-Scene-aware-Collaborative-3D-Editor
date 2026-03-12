/**
 * Test utilities voor Yjs-gebaseerde collaborative editing tests.
 * 
 * Deze module biedt helpers voor:
 * - Isolated Yjs document instanties voor elke test
 * - Multi-user simulatie zonder echte network
 * - Network disconnect/reconnect simulatie
 * - Conflict scenario helpers
 */

import * as Y from 'yjs';

/**
 * Interface voor een gesimuleerde gebruiker in tests
 */
export interface TestUser {
  id: string;
  name: string;
  doc: Y.Doc;
  isConnected: boolean;
  pendingUpdates: Uint8Array[];
}

/**
 * TestCollaborationEnvironment simuleert meerdere gebruikers die samenwerken
 * op hetzelfde document, met controle over network condities.
 */
export class TestCollaborationEnvironment {
  private users: Map<string, TestUser> = new Map();
  private syncEnabled: boolean = true;

  /**
   * Voeg een nieuwe gebruiker toe aan de test environment
   */
  addUser(userId: string, userName: string): TestUser {
    const doc = new Y.Doc();
    
    const user: TestUser = {
      id: userId,
      name: userName,
      doc,
      isConnected: true,
      pendingUpdates: [],
    };

    // Luister naar updates van dit document
    doc.on('update', (update: Uint8Array, origin: any) => {
      if (origin !== 'remote') {
        this.broadcastUpdate(userId, update);
      }
    });

    this.users.set(userId, user);
    return user;
  }

  /**
   * Krijg een gebruiker
   */
  getUser(userId: string): TestUser | undefined {
    return this.users.get(userId);
  }

  /**
   * Krijg alle gebruikers
   */
  getAllUsers(): TestUser[] {
    return Array.from(this.users.values());
  }

  /**
   * Broadcast een update naar alle andere verbonden gebruikers
   */
  private broadcastUpdate(fromUserId: string, update: Uint8Array) {
    if (!this.syncEnabled) return;

    this.users.forEach((user, userId) => {
      if (userId !== fromUserId) {
        if (user.isConnected) {
          // Direct toepassen als verbonden
          Y.applyUpdate(user.doc, update, 'remote');
        } else {
          // Opslaan voor later als disconnected
          user.pendingUpdates.push(update);
        }
      }
    });
  }

  /**
   * Disconnect een gebruiker (simuleer network failure)
   */
  disconnectUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.isConnected = false;
    }
  }

  /**
   * Reconnect een gebruiker en sync alle pending updates
   */
  reconnectUser(userId: string): void {
    const user = this.users.get(userId);
    if (user) {
      user.isConnected = true;
      
      // Apply alle pending updates van andere gebruikers
      user.pendingUpdates.forEach(update => {
        Y.applyUpdate(user.doc, update, 'remote');
      });
      user.pendingUpdates = [];

      // Sync huidige state naar andere gebruikers
      const currentState = Y.encodeStateAsUpdate(user.doc);
      this.users.forEach((otherUser, otherUserId) => {
        if (otherUserId !== userId && otherUser.isConnected) {
          Y.applyUpdate(otherUser.doc, currentState, 'remote');
        }
      });
    }
  }

  /**
   * Disconnect alle gebruikers
   */
  disconnectAllUsers(): void {
    this.users.forEach(user => {
      user.isConnected = false;
    });
  }

  /**
   * Reconnect alle gebruikers en sync
   */
  reconnectAllUsers(): void {
    // Eerst allemaal reconnecten
    this.users.forEach(user => {
      user.isConnected = true;
    });

    // Dan sync state van alle gebruikers
    const allUpdates: Uint8Array[] = [];
    this.users.forEach(user => {
      allUpdates.push(...user.pendingUpdates);
      user.pendingUpdates = [];
      allUpdates.push(Y.encodeStateAsUpdate(user.doc));
    });

    // Apply alle updates naar alle gebruikers
    this.users.forEach(user => {
      allUpdates.forEach(update => {
        Y.applyUpdate(user.doc, update, 'remote');
      });
    });
  }

  /**
   * Schakel automatische sync uit (voor conflict testing)
   */
  disableSync(): void {
    this.syncEnabled = false;
  }

  /**
   * Schakel automatische sync aan en sync alles
   */
  enableSync(): void {
    this.syncEnabled = true;
    this.reconnectAllUsers();
  }

  /**
   * Sync alle documenten handmatig
   */
  syncAll(): void {
    const allStates = Array.from(this.users.values())
      .filter(u => u.isConnected)
      .map(u => Y.encodeStateAsUpdate(u.doc));

    this.users.forEach(user => {
      if (user.isConnected) {
        allStates.forEach(state => {
          Y.applyUpdate(user.doc, state, 'remote');
        });
      }
    });
  }

  /**
   * Cleanup - verwijder alle gebruikers en documents
   */
  cleanup(): void {
    this.users.forEach(user => {
      user.doc.destroy();
    });
    this.users.clear();
  }

  /**
   * Wacht een bepaalde tijd (voor async operations)
   */
  async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Scene object helpers voor Yjs Map operaties
 */
export interface TestSceneObject {
  id: string;
  type: 'box' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parentId?: string | null;
  childIds?: string[];
}

/**
 * Helper om een scene object aan een Y.Doc toe te voegen
 */
export function addSceneObject(doc: Y.Doc, object: TestSceneObject): void {
  const yobjects = doc.getMap('objects');
  yobjects.set(object.id, object);
}

/**
 * Helper om een scene object te updaten in een Y.Doc
 */
export function updateSceneObject(
  doc: Y.Doc, 
  id: string, 
  updates: Partial<TestSceneObject>
): void {
  const yobjects = doc.getMap('objects');
  const current = yobjects.get(id);
  if (current) {
    yobjects.set(id, { ...current, ...updates });
  }
}

/**
 * Helper om een scene object te verwijderen uit een Y.Doc
 */
export function removeSceneObject(doc: Y.Doc, id: string): void {
  const yobjects = doc.getMap('objects');
  yobjects.delete(id);
}

/**
 * Helper om alle scene objecten te krijgen van een Y.Doc
 */
export function getSceneObjects(doc: Y.Doc): TestSceneObject[] {
  const yobjects = doc.getMap('objects');
  const objects: TestSceneObject[] = [];
  yobjects.forEach(value => {
    objects.push(value as TestSceneObject);
  });
  return objects;
}

/**
 * Helper om een specifiek scene object te krijgen
 */
export function getSceneObject(doc: Y.Doc, id: string): TestSceneObject | undefined {
  const yobjects = doc.getMap('objects');
  return yobjects.get(id) as TestSceneObject | undefined;
}

/**
 * Genereer een unieke ID voor test objecten
 */
export function generateTestId(prefix: string = 'test'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Maak een default test box object
 */
export function createTestBox(overrides: Partial<TestSceneObject> = {}): TestSceneObject {
  return {
    id: generateTestId('box'),
    type: 'box',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: '#FF6B6B',
    ...overrides,
  };
}
