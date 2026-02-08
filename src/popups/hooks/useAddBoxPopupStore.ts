import { create } from "zustand"

interface AddBoxPopupState {
    isOpen: boolean;
    toggle: () => void;
    open: () => void;
    close: () => void;
}

export const useAddBoxPopupStore = create<AddBoxPopupState>((set) => ({
    isOpen: false,
    toggle: () => {
        set((state) => ({ isOpen: !state.isOpen }));
    },
    open: () => {
        set({ isOpen: true });
    },
    close: () => {
        set({ isOpen: false });
    },
}));
