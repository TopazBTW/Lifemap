/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium travel palette. Ink for depth, sand for warmth,
        // horizon blue as the single accent. Keep it restrained.
        ink: {
          950: '#0A0E14',
          900: '#0F141D',
          800: '#161D29',
          700: '#212B3B',
          600: '#2E3B50',
        },
        sand: {
          50: '#FBF8F3',
          100: '#F5EFE4',
          200: '#EADFC9',
          300: '#DCCBA6',
        },
        horizon: {
          300: '#7EB8F0',
          400: '#54A0EC',
          500: '#2E88E4',
          600: '#1E6FC4',
        },
        // Country-fill legend colours — mirrored in features/map/countryPaint.ts.
        visited: '#34C77B',
        planned: '#F2B33D',
        saved: '#2E88E4',
      },
      fontFamily: {
        display: ['System'],
      },
      borderRadius: {
        card: '20px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
