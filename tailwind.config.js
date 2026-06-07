/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'rgb(var(--app-bg) / <alpha-value>)',
          'bg-secondary': 'rgb(var(--app-bg-secondary) / <alpha-value>)',
          'bg-tertiary': 'rgb(var(--app-bg-tertiary) / <alpha-value>)',
          surface: 'rgb(var(--app-surface) / <alpha-value>)',
          elevated: 'rgb(var(--app-elevated) / <alpha-value>)',
          'hover-overlay': 'rgb(var(--app-hover) / <alpha-value>)',
          border: 'rgb(var(--app-border) / <alpha-value>)',
          text: 'rgb(var(--app-text) / <alpha-value>)',
          glass: 'rgb(var(--app-glass) / <alpha-value>)',
          'glass-elevated': 'rgb(var(--app-glass-elevated) / <alpha-value>)',
          'grid-bg': 'rgb(var(--app-grid-bg) / <alpha-value>)',
        },
        titlebar: {
          start: 'rgb(var(--app-titlebar-start) / <alpha-value>)',
          mid: 'rgb(var(--app-titlebar-mid) / <alpha-value>)',
          end: 'rgb(var(--app-titlebar-end) / <alpha-value>)',
        },
        accent: {
          DEFAULT: '#1D9E75',
          50: '#e9fbf5',
          100: '#c9f5e7',
          200: '#8ee7cc',
          300: '#5ee0b4',
          400: '#31bd93',
          500: '#1D9E75',
          600: '#17805f',
        },
        terminal: {
          green: '#00e676',
          yellow: '#ffd740',
          red: '#ff5252',
          cyan: '#18ffff',
          blue: '#448aff',
          magenta: '#e040fb',
        },
      },
      fontFamily: {
        mono: ['"Cascadia Code"', '"JetBrains Mono"', '"Fira Code"', '"Consolas"', 'monospace'],
        sans: ['"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', '"Inter"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'slide-in': 'slide-in 0.2s ease-out',
        'slide-up': 'slide-up 0.15s ease-out',
        'notify-flash': 'notify-flash 1.5s ease-in-out',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 8px rgba(124, 92, 252, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(124, 92, 252, 0.6)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'notify-flash': {
          '0%, 100%': { opacity: '1' },
          '15%': { opacity: '0.5' },
          '30%': { opacity: '1' },
          '45%': { opacity: '0.5' },
          '60%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
