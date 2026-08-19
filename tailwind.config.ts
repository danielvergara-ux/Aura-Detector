import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './content/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: '#050509',
        surface: '#0B0B12',
        'surface-2': '#12121C',
        muted: '#8B8B98',
        line: 'rgba(255,255,255,0.08)',
        // Runtime aura color, driven by CSS custom properties per tier.
        aura: 'rgb(var(--aura-rgb) / <alpha-value>)',
        'aura-2': 'rgb(var(--aura-rgb-2) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
        display: ['var(--font-orbitron)', 'var(--font-space-grotesk)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        aura: '0 0 40px -8px rgb(var(--aura-rgb) / 0.55)',
        'aura-lg': '0 0 90px -10px rgb(var(--aura-rgb) / 0.7)',
      },
      keyframes: {
        'scan-sweep': {
          '0%': { transform: 'translateY(-10%)', opacity: '0' },
          '10%': { opacity: '1' },
          '90%': { opacity: '1' },
          '100%': { transform: 'translateY(110%)', opacity: '0' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        'spin-reverse': { to: { transform: 'rotate(-360deg)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.92)', opacity: '0.85' },
          '70%': { transform: 'scale(1.25)', opacity: '0' },
          '100%': { transform: 'scale(1.25)', opacity: '0' },
        },
        flicker: {
          '0%,100%': { opacity: '1' },
          '43%': { opacity: '1' },
          '45%': { opacity: '0.45' },
          '47%': { opacity: '1' },
          '92%': { opacity: '0.7' },
        },
        drift: {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-14px,0)' },
        },
        'text-glitch': {
          '0%,100%': { transform: 'translate3d(0,0,0)' },
          '20%': { transform: 'translate3d(-2px,1px,0)' },
          '40%': { transform: 'translate3d(2px,-1px,0)' },
          '60%': { transform: 'translate3d(-1px,-1px,0)' },
          '80%': { transform: 'translate3d(1px,1px,0)' },
        },
        'marquee-x': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        'scan-sweep': 'scan-sweep 2.2s cubic-bezier(.4,0,.6,1) infinite',
        'spin-slow': 'spin-slow 14s linear infinite',
        'spin-reverse': 'spin-reverse 22s linear infinite',
        'pulse-ring': 'pulse-ring 2.4s cubic-bezier(0,0,.2,1) infinite',
        flicker: 'flicker 4s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        'text-glitch': 'text-glitch 0.4s steps(2) infinite',
        'marquee-x': 'marquee-x 22s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
