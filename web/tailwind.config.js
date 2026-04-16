/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        accent:    '#5B8DFF',
        accent2:   '#A040FF',
        surface:   '#12122a',
        'surface2': '#1a1a2e',
        'surface3': '#151528',
        chord:     '#ff9642',
      },
      fontFamily: {
        sans: ['Sora', 'Noto Sans Hebrew', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up':   'fadeInUp 0.25s ease both',
        'slide-up':  'slideUp 0.35s ease-out',
        'spin-fast': 'spin 0.8s linear infinite',
        'jam-pulse': 'jamPulse 1.4s ease-in-out infinite',
        shimmer:     'shimmer 1.5s linear infinite',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
        jamPulse: {
          '0%,100%': { transform: 'scale(1)' },
          '50%':     { transform: 'scale(1.25)' },
        },
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition:  '200% center' },
        },
      },
      backgroundImage: {
        'hero-grad': 'linear-gradient(160deg, #0c0c1a 0%, #0e1535 35%, #180d3a 65%, #0c0c1a 100%)',
        shimmer:     'linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.10) 50%, rgba(255,255,255,0.04) 75%)',
      },
      backgroundSize: {
        '200%': '200%',
      },
    },
  },
  plugins: [],
};

