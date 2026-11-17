/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        heritage: {
          bg: '#F7F3ED',
          surface: '#FFFFFF',
          'surface-elevated': '#FCFAF7',
          text: '#202B3C',
          'text-secondary': '#5C6675',
          muted: '#737C89',
          border: '#DED8CF',
          divider: '#E8E1D7',

          primary: '#23395D',
          'primary-pressed': '#192B47',
          'primary-text': '#FFFFFF',
          accent: '#92582F',
          'accent-soft': '#F0E0D2',
          'accent-text': '#754522',
          focus: '#5276A5',

          success: '#166534',
          'success-bg': '#DCFCE7',
          warning: '#854D0E',
          'warning-bg': '#FEF3C7',
          danger: '#991B1B',
          'danger-bg': '#FEE2E2',
          info: '#1D4ED8',
          'info-bg': '#DBEAFE',

          'table-header': '#E4EAF3',
          'table-hover': '#F1ECE5',
          'table-selected': '#E8EDF5',

          sidebar: '#23395D',
          'sidebar-active': '#354D70',
          'sidebar-text': '#DCE5F1',
        },
        // Mapped AKNU aliases to Heritage Palette
        aknu: {
          navy: '#23395D',       // heritage.light.primary
          navyDark: '#192B47',   // heritage.light.primaryPressed
          gold: '#92582F',       // heritage.light.accent
          goldSoft: '#F0E0D2',   // heritage.light.accentSoft
          blue: '#23395D',       // heritage.light.primary
          blueHover: '#192B47',  // heritage.light.primaryPressed
          focus: '#5276A5',      // heritage.light.focus
          maroon: '#991B1B'      // heritage.light.danger
        }
      }
    },
  },
  plugins: [],
}
