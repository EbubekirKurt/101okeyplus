import { create } from 'zustand';

interface UIState {
  handOrder: string[];
  selectedTileIds: Set<string>;
  rackGrid: (string | null)[][];
  /** Numbered okey tiles toggled to a blank white face (click again to show value). */
  okeyFaceHiddenIds: Set<string>;

  setHandOrder: (order: string[]) => void;
  toggleTileSelection: (tileId: string) => void;
  clearSelection: () => void;
  reorderHand: (oldIndex: number, newIndex: number) => void;
  setRackGrid: (grid: (string | null)[][]) => void;
  toggleOkeyFaceHidden: (tileId: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  handOrder: [],
  selectedTileIds: new Set(),
  rackGrid: [[], []],
  okeyFaceHiddenIds: new Set(),

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

  setRackGrid: (grid) => set({ rackGrid: grid }),

  toggleOkeyFaceHidden: (tileId) =>
    set((state) => {
      const next = new Set(state.okeyFaceHiddenIds);
      if (next.has(tileId)) next.delete(tileId);
      else next.add(tileId);
      return { okeyFaceHiddenIds: next };
    }),
}));
