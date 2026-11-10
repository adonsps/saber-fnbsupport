import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Inter"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        apple: {
          blue: '#0071E3',
          blueHover: '#0077ED',
          green: '#28CD41',
          amber: '#FF9F0A',
          red: '#FF3B30',
          surface: '#F5F5F7',
          card: '#FFFFFF',
          ink: '#1D1D1F',
          sub: '#86868B',
        },
      },
      boxShadow: {
        'apple-sm': '0 2px 10px -2px rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.03)',
        'apple-md': '0 8px 24px -4px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.04)',
        'apple-lg': '0 20px 44px -10px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
        'apple-float': '0 24px 48px -12px rgba(0, 0, 0, 0.22), 0 0 1px 1px rgba(255, 255, 255, 0.12)',
      },
      borderRadius: {
        'apple': '22px',
        'apple-sm': '14px',
      },
    },
  },
  plugins: [],
};

export default config;

