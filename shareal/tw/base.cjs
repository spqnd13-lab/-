// 공통 Tailwind 설정 (cdn.tailwindcss.com 대신 미리 빌드한 CSS 사용)
module.exports = (brand, content) => ({
  content,
  theme: {
    extend: {
      colors: { brand, biz: { 50: '#eff6ff', 100: '#dbeafe', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af' } },
      boxShadow: { '2xs': '0 1px rgb(0 0 0 / 0.05)', xs: '0 1px 2px 0 rgb(0 0 0 / 0.05)' },
      scale: { 98: '.98', 102: '1.02', 108: '1.08', 115: '1.15' },
      spacing: { 0.2: '0.05rem' },
    },
  },
});
