/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'game-bg': '#0a0a0f',
        'game-text': '#ffffff',
        'tile-empty': '#3a3a3c',
        'tile-filled': '#565758',
        'correct': '#538d4e',
        'present': '#b59f3b',
        'absent': '#3a3a3c',
      },
      animation: {
        'shake': 'shake 0.6s ease-in-out',
        'flip': 'flip 0.5s ease-in-out',
        'bounce': 'bounce 0.4s ease-in-out',
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '10%, 30%, 50%, 70%, 90%': { transform: 'translateX(-5px)' },
          '20%, 40%, 60%, 80%': { transform: 'translateX(5px)' },
        },
        flip: {
          '0%': { transform: 'rotateX(0)' },
          '50%': { transform: 'rotateX(90deg)' },
          '100%': { transform: 'rotateX(0)' },
        },
        bounce: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
}
