import { create } from "zustand"
import { usePopupsStore } from "@/popups/hooks/usePopupsStore";

interface SceneSettingsState {
    color: string;
    isOpen: boolean;
    setColor: (color: string) => void;
    toggle: () => void;
}

export const useSceneSettingsStore = create<SceneSettingsState>((set) => ({
    color: '#9ca3af',
    isOpen: false,
    setColor: (newColor) => set({ color: newColor }),
    toggle: () => {
        const currentOpen = useSceneSettingsStore.getState().isOpen;
        const popupOpen = usePopupsStore.getState().isOpen;
        if (currentOpen === popupOpen) {    // Both open, or both closed
            usePopupsStore.getState().toggle();
            set(() => ({ isOpen: !currentOpen }));
        }
    },
}));