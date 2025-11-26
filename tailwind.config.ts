import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color)',
          dark: 'var(--primary-color-dark)',
          light: 'var(--primary-color-light)',
        },
        brand: {
          dark: '#150d44',
          blue: '#16549e',
        },
      },
    },
  },
  plugins: [],
};
export default config;

