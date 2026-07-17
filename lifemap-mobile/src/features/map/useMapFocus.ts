import { create } from 'zustand';

import type { Coordinates } from '@/shared/types/domain';

/**
 * Cross-screen "center the map here" signal. A memory's "Show on map" sets the
 * target and switches to the Map tab; the map consumes `target` once (animating
 * the camera) and clears it, while `highlightId` sticks around so the pin stays
 * called out until the user taps elsewhere. A store rather than route params so
 * the tab switch stays a plain navigation.
 */
type MapFocusState = {
  target: Coordinates | null;
  /** Id of the pin to call out, e.g. `mem-<memoryId>`. */
  highlightId: string | null;
  focusOn: (c: Coordinates, highlightId?: string) => void;
  clearTarget: () => void;
  clearHighlight: () => void;
};

export const useMapFocus = create<MapFocusState>((set) => ({
  target: null,
  highlightId: null,
  focusOn: (target, highlightId) => set({ target, highlightId: highlightId ?? null }),
  clearTarget: () => set({ target: null }),
  clearHighlight: () => set({ highlightId: null }),
}));
