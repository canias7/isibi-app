export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Sora', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        canvas: '#f7f7f5',
        ink: {
          50: '#f7f7f8',
          100: '#eeeef0',
          200: '#dcdce1',
          300: '#b9bac2',
          400: '#8d8f9b',
          500: '#666876',
          600: '#4c4e5c',
          700: '#383946',
          800: '#25262f',
          900: '#141419',
        },
        brand: {
          50: '#f1f6ff',
          100: '#e1ecff',
          200: '#c1d6ff',
          300: '#98b9ff',
          400: '#6f95ff',
          500: '#4a6df5',
          600: '#3651d6',
          700: '#2b40ab',
          800: '#243588',
          900: '#1f2e6e',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd3',
          200: '#ffd7a3',
          300: '#ffb96a',
          400: '#ff9a3d',
          500: '#f97a17',
          600: '#db5c0d',
          700: '#b5450e',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(20,20,25,0.04), 0 8px 24px -12px rgba(20,20,25,0.12)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
    },
  },
  plugins: [],
}