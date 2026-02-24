import type { Command, SerializedCommand, CommandHistoryState } from './types';

/**
 * CommandManager - beheert de command history en undo/redo functionaliteit
 * 
 * Dit is het hart van het Command Pattern systeem. Het houdt bij:
 * - Alle uitgevoerde commands (history)
 * - De huidige positie in de history (voor undo/redo)
 * - Listeners voor state changes
 * 
 * Later kan dit uitgebreid worden voor:
 * - Conflict resolution in collaborative editing
 * - Command synchronisatie over het netwerk
 * - Operational transformation
 */
export class CommandManager {
  private history: Command[] = [];
  private currentIndex: number = -1;
  private maxHistorySize: number = 100;
  private listeners: Set<() => void> = new Set();
  private userId?: string;

  constructor(options?: { maxHistorySize?: number; userId?: string }) {
    if (options?.maxHistorySize) {
      this.maxHistorySize = options.maxHistorySize;
    }
    if (options?.userId) {
      this.userId = options.userId;
    }
  }

  /**
   * Stel de user ID in (voor collaborative features)
   */
  setUserId(userId: string) {
    this.userId = userId;
  }

  /**
   * Krijg de huidige user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Voer een command uit en voeg het toe aan de history
   */
  execute(command: Command): void {
    // Voer de command uit
    command.execute();

    // Verwijder alle commands na de huidige index (branch off)
    // Dit gebeurt als je undo hebt gedaan en dan een nieuwe actie doet
    if (this.currentIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.currentIndex + 1);
    }

    // Voeg toe aan history
    this.history.push(command);
    this.currentIndex = this.history.length - 1;

    // Beperk history grootte
    if (this.history.length > this.maxHistorySize) {
      const removeCount = this.history.length - this.maxHistorySize;
      this.history = this.history.slice(removeCount);
      this.currentIndex = this.history.length - 1;
    }

    this.notifyListeners();
  }

  /**
   * Maak de laatste command ongedaan
   */
  undo(): boolean {
    if (!this.canUndo()) {
      return false;
    }

    const command = this.history[this.currentIndex];
    if (command.canUndo()) {
      command.undo();
      this.currentIndex--;
      this.notifyListeners();
      return true;
    }

    return false;
  }

  /**
   * Voer de volgende command opnieuw uit (na undo)
   */
  redo(): boolean {
    if (!this.canRedo()) {
      return false;
    }

    this.currentIndex++;
    const command = this.history[this.currentIndex];
    command.execute();
    this.notifyListeners();
    return true;
  }

  /**
   * Kan er een undo uitgevoerd worden?
   */
  canUndo(): boolean {
    return this.currentIndex >= 0 && this.history[this.currentIndex]?.canUndo();
  }

  /**
   * Kan er een redo uitgevoerd worden?
   */
  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  /**
   * Krijg de volledige command history
   */
  getHistory(): SerializedCommand[] {
    return this.history.map(cmd => cmd.serialize());
  }

  /**
   * Krijg de huidige state
   */
  getState(): CommandHistoryState {
    return {
      history: this.getHistory(),
      currentIndex: this.currentIndex,
      maxHistorySize: this.maxHistorySize,
    };
  }

  /**
   * Krijg de laatst uitgevoerde command (voor UI feedback)
   */
  getLastCommand(): SerializedCommand | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
      return this.history[this.currentIndex].serialize();
    }
    return null;
  }

  /**
   * Krijg de command die ongedaan gemaakt zal worden
   */
  getUndoCommand(): SerializedCommand | null {
    if (this.canUndo()) {
      return this.history[this.currentIndex].serialize();
    }
    return null;
  }

  /**
   * Krijg de command die opnieuw uitgevoerd zal worden
   */
  getRedoCommand(): SerializedCommand | null {
    if (this.canRedo()) {
      return this.history[this.currentIndex + 1].serialize();
    }
    return null;
  }

  /**
   * Wis de hele history
   */
  clear(): void {
    this.history = [];
    this.currentIndex = -1;
    this.notifyListeners();
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => listener());
  }

  /**
   * Krijg het aantal commands in de history
   */
  getHistoryLength(): number {
    return this.history.length;
  }

  /**
   * Krijg het aantal undo stappen beschikbaar
   */
  getUndoCount(): number {
    return this.currentIndex + 1;
  }

  /**
   * Krijg het aantal redo stappen beschikbaar
   */
  getRedoCount(): number {
    return this.history.length - this.currentIndex - 1;
  }

  /**
   * Exporteer de volledige history voor opslag/sync
   * Dit kan later gebruikt worden voor conflict resolution
   */
  exportHistory(): SerializedCommand[] {
    return this.getHistory();
  }

  /**
   * Krijg commands sinds een bepaalde timestamp
   * Nuttig voor syncing met andere clients
   */
  getCommandsSince(timestamp: number): SerializedCommand[] {
    return this.history
      .filter(cmd => cmd.serialize().timestamp > timestamp)
      .map(cmd => cmd.serialize());
  }

  /**
   * Krijg commands van een specifieke user
   * Nuttig voor conflict detection
   */
  getCommandsByUser(userId: string): SerializedCommand[] {
    return this.history
      .filter(cmd => cmd.serialize().userId === userId)
      .map(cmd => cmd.serialize());
  }
}

// Singleton instance
let commandManagerInstance: CommandManager | null = null;

export function getCommandManager(): CommandManager {
  if (!commandManagerInstance) {
    commandManagerInstance = new CommandManager();
  }
  return commandManagerInstance;
}

export function resetCommandManager(): void {
  if (commandManagerInstance) {
    commandManagerInstance.clear();
  }
  commandManagerInstance = null;
}
