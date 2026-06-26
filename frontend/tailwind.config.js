/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        space: {
          950: '#010A14',
          900: '#020B18',
          800: '#051825',
          700: '#0A2540',
          600: '#0F3460',
        },
        observatory: {
          blue: '#4FACFE',
          glow: '#00D4FF',
          amber: '#FF6B35',
          gold: '#FFD700',
        },
        star: {
          white: '#F8F9FF',
          grey: '#8CA3C0',
          dim: '#4A5568',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'flicker': 'flicker 3s linear infinite',
        'scan': 'scan 4s linear infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 20px rgba(79,172,254,0.3)' },
          '50%': { boxShadow: '0 0 40px rgba(79,172,254,0.7)' },
        },
        'flicker': {
          '0%, 100%': { opacity: '1' },
          '92%': { opacity: '1' },
          '93%': { opacity: '0.8' },
          '94%': { opacity: '1' },
          '96%': { opacity: '0.9' },
          '97%': { opacity: '1' },
        },
        'scan': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100%)' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}
