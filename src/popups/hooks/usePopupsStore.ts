import { create } from "zustand"

interface PopupState {
    isOpen: boolean;
    toggle: () => void;
}

export const usePopupsStore = create<PopupState>((set) => ({
    isOpen: false,
    toggle: () => {
        set((state) => ({ isOpen: !state.isOpen }));
    },  
}));