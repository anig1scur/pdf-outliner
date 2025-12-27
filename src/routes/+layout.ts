import '$lib/i18n';

import {browser} from '$app/environment';
import {locale, waitLocale} from 'svelte-i18n';

export const load = async () => {
  if (browser) {
    locale.set(window.navigator.language.startsWith('zh') ? 'zh' : 'en');
  }
  await waitLocale();
};

export const prerender = true;
