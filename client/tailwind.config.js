/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#48B5FF',
        'primary-dark': '#2688B5',
        sidebar: 'var(--bg-sidebar)',
        'sidebar-hover': 'var(--bg-sidebar-hover)',
        chat: 'var(--bg-chat)',
        'chat-bubble-out': 'var(--bg-bubble-out)',
        'chat-bubble-in': 'var(--bg-bubble-in)',
        header: 'var(--bg-header)',
        input: 'var(--bg-input)',
        border: 'var(--border-color)',
        muted: 'var(--text-muted)',
        'text-primary': 'var(--text-primary)',
      }
    }
  },
  plugins: []
}
