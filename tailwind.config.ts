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
        sky: {
          50: '#F0F7FF',
          100: '#E0F2FE',
          200: '#BAE6FD',
          300: '#7DD3FC',
          400: '#38BDF8',
          500: '#0EA5E9',
          600: '#0284C7',
          700: '#0369A1',
          800: '#075985',
          900: '#0C4A6E',
          950: '#082F49',
        },
        cloud: {
          DEFAULT: '#FFFFFF',
          surface: '#FFFFFF',
          well: '#F8FAFC',
        },
        scarlet: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          200: '#FECDD3',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
          800: '#9F1239',
          900: '#881337',
        },
        ink: {
          primary: '#0C1E36',
          secondary: '#3D5A80',
          tertiary: '#526D82',
          muted: '#94A3B8',
        },
        signal: {
          green: '#1D7D32',
          amber: '#B25000',
          red: '#E11D48',
        },
        apple: {
          blue: '#0284C7',
          blueHover: '#0369A1',
          green: '#1D7D32',
          amber: '#B25000',
          red: '#E11D48',
          surface: '#F0F7FF',
          card: '#FFFFFF',
          groupedTertiary: '#E0F2FE',
          ink: '#0C1E36',
          sub: '#3D5A80',
          tertiary: '#64748B',
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
