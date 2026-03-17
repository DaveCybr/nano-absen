/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        sidebar: '2px 0 8px rgba(0,0,0,0.06)',
        card: '0 1px 4px rgba(0,0,0,0.08)',
        dropdown: '0 4px 16px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}

