// Command Pattern System voor Scene Editor
// Exporteer alle command types, de manager, en hooks

// Types
export type {
  Command,
  CommandType,
  SerializedCommand,
  CommandHistoryState,
  AddObjectPayload,
  RemoveObjectPayload,
  MoveObjectPayload,
  RotateObjectPayload,
  ScaleObjectPayload,
  ColorObjectPayload,
  LinkObjectPayload,
  UnlinkObjectPayload,
  DuplicateObjectPayload,
} from './types';

// Command implementaties
export {
  AddObjectCommand,
  RemoveObjectCommand,
  MoveObjectCommand,
  RotateObjectCommand,
  ScaleObjectCommand,
  ColorObjectCommand,
  LinkObjectCommand,
  UnlinkObjectCommand,
  DuplicateObjectCommand,
} from './Commands';

// Command Manager
export { CommandManager, getCommandManager, resetCommandManager } from './CommandManager';

// React hooks
export { useCommandHistory, useCommandBasedManipulation } from './useCommandHistory';
export { useUndoRedoKeyboard } from './useUndoRedoKeyboard';
