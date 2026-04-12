/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#0a0a0a',
          secondary: '#111111',
          card: '#1a1a1a',
        },
        tier: {
          's-plus': '#FF0000',
          s: '#FFA500',
          a: '#ECD444',
          b: '#4d6461',
          c: '#5865F2',
          d: '#7d3ce0',
          f: '#cc0000',
        },
        accent: {
          green: '#10b981',
          blue: '#0e87bc',
          cyan: '#22d3ee',
          violet: '#7c3aed',
          rose: '#f43f5e',
        },
      },
    },
  },
  plugins: [],
}