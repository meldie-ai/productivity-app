/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#4772FA',
          50:  '#EEF2FF',
          100: '#E0E9FF',
          200: '#C7D7FE',
          500: '#4772FA',
          600: '#3560E0',
          700: '#2A4EBF',
        },
      },
    },
  },
  plugins: [],
};
