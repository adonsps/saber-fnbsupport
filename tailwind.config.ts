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
        serif: [
          '"New York"',
          'ui-serif',
          'Georgia',
          'Cambria',
          '"Times New Roman"',
          'Times',
          'serif',
        ],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        apple: {
          blue: '#0066CC',
          blueHover: '#0055B3',
          green: '#1D7D32',
          amber: '#B25000',
          red: '#D70015',
          surface: '#F5F5F7',
          card: '#FFFFFF',
          groupedTertiary: '#EFEFF4',
          ink: '#1D1D1F',
          sub: '#515154',
          tertiary: '#6E6E73',
        },
      },
      boxShadow: {
        'apple-sm':
          '0 1px 3px 0 rgba(0, 0, 0, 0.04), 0 1px 2px -1px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(60, 60, 67, 0.08)',
        'apple-md':
          '0 8px 24px -6px rgba(0, 0, 0, 0.06), 0 2px 6px -1px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(60, 60, 67, 0.09)',
        'apple-lg':
          '0 20px 44px -12px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(60, 60, 67, 0.1)',
        'apple-float':
          '0 20px 44px -10px rgba(0, 0, 0, 0.28), 0 4px 12px 0 rgba(0, 0, 0, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.22)',
      },
      borderRadius: {
        apple: '20px',
        'apple-sm': '14px',
      },
    },
  },
  plugins: [],
};

export default config;
