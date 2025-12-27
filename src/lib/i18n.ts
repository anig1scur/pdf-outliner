import {register, init, getLocaleFromNavigator} from 'svelte-i18n';

register('en', () => import('./locales/en.json'));
register('zh', () => import('./locales/zh.json'));

init({
  fallbackLocale: 'en',
  initialLocale: getInitialLocale(),
});

function getInitialLocale() {
  const detected = getLocaleFromNavigator();

  if (detected && detected.startsWith('zh')) {
    return 'zh';
  }
  return 'en';
}