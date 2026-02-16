/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class', // Phase 6: 支持主题切换
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 可以自定义深色主题的颜色
      }
    },
  },
  plugins: [],
}
