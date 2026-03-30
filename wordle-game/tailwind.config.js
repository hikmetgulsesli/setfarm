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
        'tile-empty': '#3a3a3c',
        'tile-filled': '#818384',
        'correct': '#538d4e',
        'present': '#b59f3b',
        'absent': '#3a3a3c',
        'game-text': '#ffffff',
      },
    },
  },
  plugins: [],
}
