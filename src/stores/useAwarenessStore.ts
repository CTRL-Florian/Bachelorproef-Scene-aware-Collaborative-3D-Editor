import { useState, useEffect, useCallback } from 'react';
import { WebsocketProvider } from 'y-websocket';
import { Awareness, removeAwarenessStates } from 'y-protocols/awareness';

export interface UserPresence {
  clientId: number;
  name: string;
  color: string;
}

// Generate a random color for each user
const generateUserColor = (): string => {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

class AwarenessStore {
  private awareness: Awareness | null = null;
  private listeners: Set<() => void> = new Set();
  private currentUser: { name: string; color: string } | null = null;
  private isInitialized = false;

  initialize(provider: WebsocketProvider) {
    if (this.isInitialized) return;
    
    this.awareness = provider.awareness;
    this.isInitialized = true;

    // Listen for awareness changes
    this.awareness.on('change', () => {
      this.notifyListeners();
    });

    // Clean up awareness state when page is closed/refreshed
    const cleanup = () => {
      if (this.awareness) {
        // Remove our own awareness state
        removeAwarenessStates(this.awareness, [this.awareness.clientID], 'window unload');
      }
    };

    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);
  }

  setLocalUser(name: string, color?: string) {
    if (!this.awareness) return;
    
    const userColor = color || generateUserColor();
    this.currentUser = { name, color: userColor };
    
    this.awareness.setLocalStateField('user', {
      name,
      color: userColor,
    });
    
    this.notifyListeners();
  }

  getCurrentUser(): { name: string; color: string } | null {
    return this.currentUser;
  }

  hasCurrentUser(): boolean {
    return this.currentUser !== null;
  }

  getUsers(): UserPresence[] {
    if (!this.awareness) return [];
    
    const users: UserPresence[] = [];
    this.awareness.getStates().forEach((state, clientId) => {
      if (state.user) {
        users.push({
          clientId,
          name: state.user.name,
          color: state.user.color,
        });
      }
    });
    
    return users;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }
}

export const awarenessStore = new AwarenessStore();

// Hook to use awareness store
export function useAwareness() {
  const [users, setUsers] = useState<UserPresence[]>([]);
  const [currentUser, setCurrentUser] = useState<{ name: string; color: string } | null>(
    awarenessStore.getCurrentUser()
  );

  useEffect(() => {
    const updateUsers = () => {
      setUsers(awarenessStore.getUsers());
      setCurrentUser(awarenessStore.getCurrentUser());
    };

    // Initial update
    updateUsers();

    // Subscribe to changes
    const unsubscribe = awarenessStore.subscribe(updateUsers);
    return unsubscribe;
  }, []);

  const setUser = useCallback((name: string) => {
    awarenessStore.setLocalUser(name);
  }, []);

  const hasUser = awarenessStore.hasCurrentUser();

  return { users, currentUser, setUser, hasUser };
}
