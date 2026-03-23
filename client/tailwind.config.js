/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2AABEE',
        'primary-dark': '#1a8fd1',
        sidebar: '#17212B',
        'sidebar-hover': '#202E3A',
        chat: '#0E1621',
        'chat-bubble-out': '#2B5278',
        'chat-bubble-in': '#182533',
        header: '#17212B',
        input: '#17212B',
        border: '#0D1117',
        muted: '#6C7883',
      }
    }
  },
  plugins: []
}
