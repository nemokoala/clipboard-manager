import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // 라이트/다크/시스템 전환을 위해 클래스 기반 다크 모드 사용.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // 토스 브랜드 블루 + 토스 그레이 스케일(TDS) + 다크 표면색.
        toss: {
          blue: '#3182F6',
          bluehover: '#1B64DA',
        },
        // 다크 모드 기본 배경.
        ink: '#1B1C1F',
        gray: {
          50: '#F9FAFB',
          100: '#F2F4F6',
          200: '#E5E8EB',
          300: '#D1D6DB',
          400: '#B0B8C1',
          500: '#8B95A1',
          600: '#6B7684',
          700: '#4E5968',
          800: '#333D4B',
          900: '#191F28',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
} satisfies Config
