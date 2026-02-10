import { create } from "zustand";

interface LinkModeState {
  isLinking: boolean;
  sourceId: string | null;
  startLinking: (sourceId: string) => void;
  cancelLinking: () => void;
  completeLinking: () => void;
}

export const useLinkModeStore = create<LinkModeState>((set) => ({
  isLinking: false,
  sourceId: null,
  startLinking: (sourceId: string) => set({ isLinking: true, sourceId }),
  cancelLinking: () => set({ isLinking: false, sourceId: null }),
  completeLinking: () => set({ isLinking: false, sourceId: null }),
}));
