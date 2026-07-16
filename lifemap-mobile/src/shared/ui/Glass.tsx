import { BlurView } from 'expo-blur';
import type { PropsWithChildren } from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

/**
 * The app's glassmorphism surface.
 *
 * expo-blur rather than expo-glass-effect for cross-platform parity —
 * glass-effect is iOS-26-only Liquid Glass. If we later want the native
 * material on new iPhones, branch here, not at call sites.
 */
type GlassProps = PropsWithChildren<
  ViewProps & {
    intensity?: number;
    /** Rounded card by default; 'bar' for tab/nav bars (squarer, tighter). */
    variant?: 'card' | 'bar';
  }
>;

export function Glass({
  children,
  intensity = 40,
  variant = 'card',
  style,
  ...rest
}: GlassProps) {
  return (
    <View
      style={[variant === 'card' ? styles.card : styles.bar, style]}
      {...rest}
    >
      <BlurView tint="dark" intensity={intensity} style={StyleSheet.absoluteFill} />
      <View style={styles.overlay} pointerEvents="none" />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  bar: {
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  // Faint white wash on top of the blur sells the "frosted" read on OLED black.
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  content: {
    position: 'relative',
  },
});
