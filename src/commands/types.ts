import type { SceneObject } from '@/playground/scene/hooks/useYjsSceneStore';

/**
 * Command Types - alle mogelijke actie types in de editor
 */
export type CommandType =
  | 'ADD_OBJECT'
  | 'REMOVE_OBJECT'
  | 'MOVE_OBJECT'
  | 'ROTATE_OBJECT'
  | 'SCALE_OBJECT'
  | 'COLOR_OBJECT'
  | 'LINK_OBJECT'
  | 'UNLINK_OBJECT'
  | 'DUPLICATE_OBJECT';

/**
 * Base Command interface - elke command moet deze interface implementeren
 */
export interface Command {
  /** Unieke identifier voor deze command instance */
  id: string;
  /** Type van de command */
  type: CommandType;
  /** Timestamp wanneer de command werd aangemaakt */
  timestamp: number;
  /** User ID die de command heeft uitgevoerd (voor collaborative features) */
  userId?: string;
  /** Beschrijving van de actie (voor UI en debugging) */
  description: string;
  
  /** Voer de command uit */
  execute(): void;
  /** Maak de command ongedaan */
  undo(): void;
  /** Kan deze command ongedaan gemaakt worden? */
  canUndo(): boolean;
  
  /** Serialiseer de command voor opslag/synchronisatie */
  serialize(): SerializedCommand;
}

/**
 * Geserialiseerde versie van een command - voor opslag en netwerk sync
 */
export interface SerializedCommand {
  id: string;
  type: CommandType;
  timestamp: number;
  userId?: string;
  description: string;
  payload: Record<string, unknown>;
}

/**
 * Command Payloads - specifieke data per command type
 */
export interface AddObjectPayload {
  objectId: string;
  objectType: 'box' | 'sphere' | 'cylinder';
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  color: string;
  parentId?: string | null;
}

export interface RemoveObjectPayload {
  objectId: string;
  /** Opgeslagen object data voor undo */
  previousState: SceneObject;
}

export interface MoveObjectPayload {
  objectId: string;
  previousPosition: [number, number, number];
  newPosition: [number, number, number];
  mode: 'offset' | 'absolute' | 'relative';
}

export interface RotateObjectPayload {
  objectId: string;
  previousRotation: [number, number, number];
  newRotation: [number, number, number];
}

export interface ScaleObjectPayload {
  objectId: string;
  previousScale: [number, number, number];
  newScale: [number, number, number];
}

export interface ColorObjectPayload {
  objectId: string;
  previousColor: string;
  newColor: string;
}

export interface LinkObjectPayload {
  childId: string;
  parentId: string;
  /** Vorige parent ID (null als er geen was) */
  previousParentId: string | null;
  /** Positie voor het linken (voor undo) */
  previousPosition: [number, number, number];
  previousRotation: [number, number, number];
}

export interface UnlinkObjectPayload {
  childId: string;
  previousParentId: string;
  /** Positie na unlinken */
  newPosition: [number, number, number];
  newRotation: [number, number, number];
  /** Positie voor unlinken (voor undo - relatief aan parent) */
  previousPosition: [number, number, number];
  previousRotation: [number, number, number];
}

export interface DuplicateObjectPayload {
  sourceObjectId: string;
  newObjectId: string;
  newPosition: [number, number, number];
}

/**
 * Command History State - voor de store
 */
export interface CommandHistoryState {
  /** Alle uitgevoerde commands */
  history: SerializedCommand[];
  /** Index van de huidige positie in de history (voor undo/redo) */
  currentIndex: number;
  /** Maximum aantal commands om te bewaren */
  maxHistorySize: number;
}
