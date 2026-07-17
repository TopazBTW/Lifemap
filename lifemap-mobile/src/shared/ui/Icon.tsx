import Svg, { Circle, Path } from 'react-native-svg';

export type IconName =
  | 'map'
  | 'memories'
  | 'reviews'
  | 'timeline'
  | 'plus'
  | 'close'
  | 'search';

/**
 * Hand-drawn line icons (24px grid, round joins) — a small, consistent set so
 * the app's chrome reads as designed rather than emoji-decorated. Stroke takes
 * the given colour; `fill` softly tints the active state.
 */
export function Icon({
  name,
  size = 24,
  color = '#FFFFFF',
  strokeWidth = 1.8,
  fill = 'none',
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  fill?: string;
}) {
  const s = {
    stroke: color,
    strokeWidth,
    fill,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'map' && (
        <>
          <Path {...s} d="M12 21s-6-5.686-6-10a6 6 0 1 1 12 0c0 4.314-6 10-6 10z" />
          <Circle {...s} cx={12} cy={11} r={2.2} fill="none" />
        </>
      )}
      {name === 'memories' && (
        <>
          <Path
            {...s}
            d="M4 9a2 2 0 0 1 2-2h1.3l1-1.7h5.4l1 1.7H18a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"
          />
          <Circle {...s} cx={12} cy={13} r={3.1} fill="none" />
        </>
      )}
      {name === 'reviews' && (
        <Path
          {...s}
          d="M12 3.6l2.6 5.9 6.4.6-4.85 4.3 1.45 6.3L12 17.4 5.95 20.7l1.45-6.3L2.55 10.1l6.4-.6z"
        />
      )}
      {name === 'timeline' && (
        <>
          <Circle {...s} cx={12} cy={12} r={9} fill={fill} />
          <Path {...s} d="M16.2 7.8l-2.3 6.4-6.4 2.3 2.3-6.4z" fill="none" />
        </>
      )}
      {name === 'plus' && <Path {...s} d="M12 5v14M5 12h14" />}
      {name === 'close' && <Path {...s} d="M6 6l12 12M18 6L6 18" />}
      {name === 'search' && (
        <>
          <Circle {...s} cx={11} cy={11} r={7} fill="none" />
          <Path {...s} d="M20 20l-3.6-3.6" />
        </>
      )}
    </Svg>
  );
}
