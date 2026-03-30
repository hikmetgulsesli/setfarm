/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#121213',
        'game-text': '#d7dadc',
        'tile-empty': '#3a3a3c',
        'tile-filled': '#565758',
        'correct': '#538d4e',
        'present': '#b59f3b',
        'absent': '#3a3a3c',
      },
    },
  },
  plugins: [],
}