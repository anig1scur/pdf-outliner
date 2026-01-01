import typography from '@tailwindcss/typography';
import type {Config} from 'tailwindcss';

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans:
            [
              'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas',
              '"Liberation Mono"', '"Courier New"',

              '"Microsoft YaHei"', '"PingFang SC"', '"Hiragino Sans GB"',
              '"Heiti SC"', '"WenQuanYi Micro Hei"',

              'sans-serif'
            ],
      },
    }
  },

  plugins: [typography]
} satisfies Config;
