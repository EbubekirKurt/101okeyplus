import { create } from 'zustand';

interface UIState {
  handOrder: string[];
  selectedTileIds: Set<string>;

  setHandOrder: (order: string[]) => void;
  toggleTileSelection: (tileId: string) => void;
  clearSelection: () => void;
  reorderHand: (oldIndex: number, newIndex: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  handOrder: [],
  selectedTileIds: new Set(),

  setHandOrder: (order) => set({ handOrder: order }),

  toggleTileSelection: (tileId) =>
    set((state) => {
      const next = new Set(state.selectedTileIds);
      if (next.has(tileId)) {
        next.delete(tileId);
      } else {
        next.add(tileId);
      }
      return { selectedTileIds: next };
    }),

  clearSelection: () => set({ selectedTileIds: new Set() }),

  reorderHand: (oldIndex, newIndex) =>
    set((state) => {
      const next = [...state.handOrder];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      return { handOrder: next };
    }),
}));
