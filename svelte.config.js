// import adapter from '@sveltejs/adapter-auto';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: vitePreprocess(),

  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapterStatic(
      {
        pages: 'build',
        assets: 'build',
        fallback: null,
        precompress: false,
        strict: true
      }
    ),
    paths: {
      base: '',
    },
  },
  onwarn: (warning, handler) => {
    const { code } = warning;
    if (code === 'css_unused_selector') return;

    handler(warning); // Handle other warnings
  },
};

export default config;
