import type { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Standard screen container: ink background, safe-area padding.
 * `edges` lets map-style screens bleed to the physical edges.
 */
export function Screen({
  children,
  padded = true,
  topInset = true,
}: PropsWithChildren<{ padded?: boolean; topInset?: boolean }>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      className="flex-1 bg-ink-950"
      style={{
        paddingTop: topInset ? insets.top : 0,
        paddingLeft: padded ? 20 : 0,
        paddingRight: padded ? 20 : 0,
      }}
    >
      {children}
    </View>
  );
}
