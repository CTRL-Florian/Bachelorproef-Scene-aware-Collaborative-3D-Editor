import { create } from "zustand";

interface ContextMenuState {
  isOpen: boolean;
  x: number;
  y: number;
  boxId: string | null;
  open: (x: number, y: number, boxId: string) => void;
  close: () => void;
}

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  x: 0,
  y: 0,
  boxId: null,
  open: (x, y, boxId) => set({ isOpen: true, x, y, boxId }),
  close: () => set({ isOpen: false, boxId: null }),
}));
