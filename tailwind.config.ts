import type { Config } from 'tailwindcss';

/**
 * Design tokens for the front-desk UI.
 *
 *  - ink     Cool blue-slate neutrals for text, borders and dark surfaces.
 *  - lagoon  Teal used for focus rings and interactive highlights.
 *  - brass   Warm metal accent, used for the room "key tag" and the primary highlight button.
 *  - paper   The page background (a cool off-white, so white panels stay distinct).
 *
 * System font stacks are used on purpose: no web-font download means a faster first paint at the desk.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f4f5f6',
        ink: {
          50: '#f4f6f8',
          100: '#e6eaef',
          200: '#cdd5de',
          300: '#a5b1bf',
          400: '#7a8a9c',
          500: '#5b6b7e',
          600: '#465466',
          700: '#354252',
          800: '#25303d',
          900: '#182230',
          950: '#0e1621',
        },
        lagoon: {
          50: '#eefaf9',
          100: '#d5f2ef',
          200: '#aee5e0',
          300: '#7dd0cb',
          400: '#4bb5b1',
          500: '#2a9a98',
          600: '#1f7c7c',
          700: '#1c6263',
          800: '#1a4f50',
          900: '#184142',
        },
        brass: {
          50: '#faf6ea',
          100: '#f4ecd0',
          200: '#efdfae',
          300: '#e3c878',
          400: '#d3ad4c',
          500: '#b8902f',
          600: '#95721f',
          700: '#735719',
        },
      },
      fontFamily: {
        sans: [
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        serif: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
