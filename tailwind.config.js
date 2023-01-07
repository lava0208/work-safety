// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './utils/**/*.{js,ts,jsx,tsx}'
    // For the best performance and to avoid false positives,
    // be as specific as possible with your content configuration.
  ],
  theme: {
    fontFamily: {
      sans: ['IBM Plex Sans', 'sans-serif'],
    },
    extend: {
      screens: {
        'xl': '1140px',
      },
      colors: {
        'primary': '#3657AD',
        'secondary': '#AED2EB',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.2)',
        'DEFAULT': '0 2px 6px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.2)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.2)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 4px -4px rgb(0 0 0 / 0.2)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 8px -6px rgb(0 0 0 / 0.2)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 6px 0 rgb(0 0 0 / 0.1)',
      },
      keyframes: {
        stretch50: {
          '0%': { height: '50%' },
          '40%': { height: '50%' },
          '50%': { height: '100%' },
          '60%': { height: '40%' },
          '75%': { height: '60%' },
          '85%': { height: '50%' },
        },
        stretch75: {
          '0%': { height: '75%' },
          '40%': { height: '75%' },
          '50%': { height: '100%' },
          '60%': { height: '60%' },
          '75%': { height: '80%' },
          '85%': { height: '75%' },
        },
        fadeIn: {
          '0%': { opacity: 0 },
          '100%': { opacity: 1 },
        }
      },
    },
  },
};