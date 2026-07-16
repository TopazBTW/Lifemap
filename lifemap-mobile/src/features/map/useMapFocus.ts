import { create } from 'zustand';

import type { Coordinates } from '@/shared/types/domain';

/**
 * Cross-screen "center the map here" signal. A memory's "Show on map" sets the
 * target and switches to the Map tab; the map consumes it once and clears it.
 * A store rather than route params so the tab switch stays a plain navigation.
 */
type MapFocusState = {
  target: Coordinates | null;
  focusOn: (c: Coordinates) => void;
  clear: () => void;
};

export const useMapFocus = create<MapFocusState>((set) => ({
  target: null,
  focusOn: (target) => set({ target }),
  clear: () => set({ target: null }),
}));
