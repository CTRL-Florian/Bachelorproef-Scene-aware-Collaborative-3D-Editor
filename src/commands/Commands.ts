import type { Command, SerializedCommand, AddObjectPayload } from './types';
import { sceneStore, type SceneObject } from '@/playground/scene/hooks/useYjsSceneStore';

/**
 * Genereer een unieke ID voor een command
 */
function generateCommandId(): string {
  return `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * AddObjectCommand - Voegt een nieuw object toe aan de scene
 */
export class AddObjectCommand implements Command {
  id: string;
  type: 'ADD_OBJECT' = 'ADD_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private payload: AddObjectPayload;

  constructor(payload: AddObjectPayload, userId?: string) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.payload = payload;
    this.description = `Add ${payload.objectType} "${payload.objectId}"`;
  }

  execute(): void {
    sceneStore.addObject(
      this.payload.objectId,
      this.payload.objectType,
      this.payload.position,
      this.payload.rotation,
      this.payload.scale,
      this.payload.color
    );
  }

  undo(): void {
    sceneStore.removeObject(this.payload.objectId);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: this.payload as unknown as Record<string, unknown>,
    };
  }

  getPayload(): AddObjectPayload {
    return this.payload;
  }
}

/**
 * RemoveObjectCommand - Verwijdert een object uit de scene
 */
export class RemoveObjectCommand implements Command {
  id: string;
  type: 'REMOVE_OBJECT' = 'REMOVE_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private objectId: string;
  private previousState: SceneObject | null = null;

  constructor(objectId: string, userId?: string) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.objectId = objectId;
    this.description = `Remove object "${objectId}"`;
    
    // Sla de huidige state op voor undo
    const obj = sceneStore.getObject(objectId);
    if (obj) {
      this.previousState = { ...obj };
    }
  }

  execute(): void {
    // Sla state op als dat nog niet is gebeurd
    if (!this.previousState) {
      const obj = sceneStore.getObject(this.objectId);
      if (obj) {
        this.previousState = { ...obj };
      }
    }
    sceneStore.removeObject(this.objectId);
  }

  undo(): void {
    if (this.previousState) {
      sceneStore.addObject(
        this.previousState.id,
        this.previousState.type,
        this.previousState.position,
        this.previousState.rotation,
        this.previousState.scale,
        this.previousState.color
      );
      // Herstel parent relatie indien aanwezig
      if (this.previousState.parentId) {
        sceneStore.linkObject(this.previousState.id, this.previousState.parentId);
      }
    }
  }

  canUndo(): boolean {
    return this.previousState !== null;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        objectId: this.objectId,
        previousState: this.previousState,
      },
    };
  }
}

/**
 * MoveObjectCommand - Verplaatst een object
 */
export class MoveObjectCommand implements Command {
  id: string;
  type: 'MOVE_OBJECT' = 'MOVE_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private objectId: string;
  private previousPosition: [number, number, number];
  private newPosition: [number, number, number];
  private mode: 'offset' | 'absolute' | 'relative';

  constructor(
    objectId: string,
    previousPosition: [number, number, number],
    newPosition: [number, number, number],
    mode: 'offset' | 'absolute' | 'relative' = 'absolute',
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.objectId = objectId;
    this.previousPosition = [...previousPosition] as [number, number, number];
    this.newPosition = [...newPosition] as [number, number, number];
    this.mode = mode;
    this.description = `Move "${objectId}" (${mode})`;
  }

  execute(): void {
    sceneStore.updateObjectPosition(this.objectId, this.newPosition);
  }

  undo(): void {
    sceneStore.updateObjectPosition(this.objectId, this.previousPosition);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        objectId: this.objectId,
        previousPosition: this.previousPosition,
        newPosition: this.newPosition,
        mode: this.mode,
      },
    };
  }
}

/**
 * RotateObjectCommand - Roteert een object
 */
export class RotateObjectCommand implements Command {
  id: string;
  type: 'ROTATE_OBJECT' = 'ROTATE_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private objectId: string;
  private previousRotation: [number, number, number];
  private newRotation: [number, number, number];

  constructor(
    objectId: string,
    previousRotation: [number, number, number],
    newRotation: [number, number, number],
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.objectId = objectId;
    this.previousRotation = [...previousRotation] as [number, number, number];
    this.newRotation = [...newRotation] as [number, number, number];
    this.description = `Rotate "${objectId}"`;
  }

  execute(): void {
    sceneStore.updateObjectRotation(this.objectId, this.newRotation);
  }

  undo(): void {
    sceneStore.updateObjectRotation(this.objectId, this.previousRotation);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        objectId: this.objectId,
        previousRotation: this.previousRotation,
        newRotation: this.newRotation,
      },
    };
  }
}

/**
 * ScaleObjectCommand - Schaalt een object
 */
export class ScaleObjectCommand implements Command {
  id: string;
  type: 'SCALE_OBJECT' = 'SCALE_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private objectId: string;
  private previousScale: [number, number, number];
  private newScale: [number, number, number];

  constructor(
    objectId: string,
    previousScale: [number, number, number],
    newScale: [number, number, number],
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.objectId = objectId;
    this.previousScale = [...previousScale] as [number, number, number];
    this.newScale = [...newScale] as [number, number, number];
    this.description = `Scale "${objectId}"`;
  }

  execute(): void {
    sceneStore.updateObjectScale(this.objectId, this.newScale);
  }

  undo(): void {
    sceneStore.updateObjectScale(this.objectId, this.previousScale);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        objectId: this.objectId,
        previousScale: this.previousScale,
        newScale: this.newScale,
      },
    };
  }
}

/**
 * ColorObjectCommand - Verandert de kleur van een object
 */
export class ColorObjectCommand implements Command {
  id: string;
  type: 'COLOR_OBJECT' = 'COLOR_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private objectId: string;
  private previousColor: string;
  private newColor: string;

  constructor(
    objectId: string,
    previousColor: string,
    newColor: string,
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.objectId = objectId;
    this.previousColor = previousColor;
    this.newColor = newColor;
    this.description = `Change color of "${objectId}"`;
  }

  execute(): void {
    sceneStore.updateObjectColor(this.objectId, this.newColor);
  }

  undo(): void {
    sceneStore.updateObjectColor(this.objectId, this.previousColor);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        objectId: this.objectId,
        previousColor: this.previousColor,
        newColor: this.newColor,
      },
    };
  }
}

/**
 * LinkObjectCommand - Koppelt een object aan een parent
 */
export class LinkObjectCommand implements Command {
  id: string;
  type: 'LINK_OBJECT' = 'LINK_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private childId: string;
  private parentId: string;
  private previousParentId: string | null;
  private previousPosition: [number, number, number];
  private previousRotation: [number, number, number];

  constructor(
    childId: string,
    parentId: string,
    previousParentId: string | null,
    previousPosition: [number, number, number],
    previousRotation: [number, number, number],
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.childId = childId;
    this.parentId = parentId;
    this.previousParentId = previousParentId;
    this.previousPosition = [...previousPosition] as [number, number, number];
    this.previousRotation = [...previousRotation] as [number, number, number];
    this.description = `Link "${childId}" to "${parentId}"`;
  }

  execute(): void {
    sceneStore.linkObject(this.childId, this.parentId);
  }

  undo(): void {
    // Unlink eerst
    sceneStore.unlinkObject(this.childId);
    
    // Herstel de vorige positie en rotatie
    sceneStore.updateObjectPosition(this.childId, this.previousPosition);
    sceneStore.updateObjectRotation(this.childId, this.previousRotation);
    
    // Link opnieuw aan vorige parent indien die er was
    if (this.previousParentId) {
      sceneStore.linkObject(this.childId, this.previousParentId);
    }
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        childId: this.childId,
        parentId: this.parentId,
        previousParentId: this.previousParentId,
        previousPosition: this.previousPosition,
        previousRotation: this.previousRotation,
      },
    };
  }
}

/**
 * UnlinkObjectCommand - Ontkoppelt een object van zijn parent
 */
export class UnlinkObjectCommand implements Command {
  id: string;
  type: 'UNLINK_OBJECT' = 'UNLINK_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private childId: string;
  private previousParentId: string;
  private previousPosition: [number, number, number];
  private previousRotation: [number, number, number];

  constructor(
    childId: string,
    previousParentId: string,
    previousPosition: [number, number, number],
    previousRotation: [number, number, number],
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.childId = childId;
    this.previousParentId = previousParentId;
    this.previousPosition = [...previousPosition] as [number, number, number];
    this.previousRotation = [...previousRotation] as [number, number, number];
    this.description = `Unlink "${childId}" from "${previousParentId}"`;
  }

  execute(): void {
    sceneStore.unlinkObject(this.childId);
  }

  undo(): void {
    // Herstel de lokale positie en rotatie eerst
    sceneStore.updateObjectPosition(this.childId, this.previousPosition);
    sceneStore.updateObjectRotation(this.childId, this.previousRotation);
    // Link terug aan de parent
    sceneStore.linkObject(this.childId, this.previousParentId);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        childId: this.childId,
        previousParentId: this.previousParentId,
        previousPosition: this.previousPosition,
        previousRotation: this.previousRotation,
      },
    };
  }
}

/**
 * DuplicateObjectCommand - Dupliceert een object
 */
export class DuplicateObjectCommand implements Command {
  id: string;
  type: 'DUPLICATE_OBJECT' = 'DUPLICATE_OBJECT';
  timestamp: number;
  userId?: string;
  description: string;

  private sourceObjectId: string;
  private newObjectId: string;
  private newPosition: [number, number, number];
  private sourceObject: SceneObject | null = null;

  constructor(
    sourceObjectId: string,
    newObjectId: string,
    newPosition: [number, number, number],
    userId?: string
  ) {
    this.id = generateCommandId();
    this.timestamp = Date.now();
    this.userId = userId;
    this.sourceObjectId = sourceObjectId;
    this.newObjectId = newObjectId;
    this.newPosition = [...newPosition] as [number, number, number];
    this.description = `Duplicate "${sourceObjectId}"`;
    
    // Sla de source object op
    const obj = sceneStore.getObject(sourceObjectId);
    if (obj) {
      this.sourceObject = { ...obj };
    }
  }

  execute(): void {
    if (!this.sourceObject) {
      const obj = sceneStore.getObject(this.sourceObjectId);
      if (obj) {
        this.sourceObject = { ...obj };
      }
    }
    
    if (this.sourceObject) {
      sceneStore.addObject(
        this.newObjectId,
        this.sourceObject.type,
        this.newPosition,
        this.sourceObject.rotation,
        this.sourceObject.scale,
        this.sourceObject.color
      );
    }
  }

  undo(): void {
    sceneStore.removeObject(this.newObjectId);
  }

  canUndo(): boolean {
    return true;
  }

  serialize(): SerializedCommand {
    return {
      id: this.id,
      type: this.type,
      timestamp: this.timestamp,
      userId: this.userId,
      description: this.description,
      payload: {
        sourceObjectId: this.sourceObjectId,
        newObjectId: this.newObjectId,
        newPosition: this.newPosition,
      },
    };
  }

  getNewObjectId(): string {
    return this.newObjectId;
  }
}
