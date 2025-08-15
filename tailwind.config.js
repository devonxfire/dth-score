/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: '#1a2233', // dark blue-grey
          secondary: '#23272a', // charcoal grey
          panel: '#2d333b', // lighter grey for panels/tables
        },
        border: {
          DEFAULT: '#3a4252', // muted steel
        },
        text: {
          primary: '#e0e6ed', // light grey
          secondary: '#a3adc2', // muted blue-grey
        },
        accent: {
          DEFAULT: '#217c8b', // deep teal
          hover: '#1b5e6a', // muted teal hover
        },
        status: {
          complete: '#8b2635', // maroon
        },
        slateblue: '#495c83', // optional subtle accent
      },
    },
  },
  plugins: [],
}
