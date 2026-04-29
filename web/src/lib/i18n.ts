import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../../locales/en.json';
import he from '../../locales/he.json';

/** Detect the browser/device preferred language, normalised to 'he' or 'en'. */
function detectDeviceLang(): 'he' | 'en' {
  const nav = (
    navigator.language ||
    (navigator.languages && navigator.languages[0]) ||
    'en'
  ).toLowerCase();
  return nav.startsWith('he') ? 'he' : 'en';
}

// User's explicit choice wins; fall back to device language (not a hardcoded default).
const savedLang = (localStorage.getItem('muzalkin_lang') as 'he' | 'en' | null) ?? detectDeviceLang();

i18next.use(initReactI18next).init({
  lng: savedLang,
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  interpolation: {
    escapeValue: false,
  },
  initImmediate: false,
});

/** Change app language, persist to localStorage, update document dir */
export function changeAppLanguage(lang: 'he' | 'en'): void {
  i18next.changeLanguage(lang);
  localStorage.setItem('muzalkin_lang', lang);
  document.documentElement.lang = lang;
  document.documentElement.dir  = lang === 'he' ? 'rtl' : 'ltr';
}

// Apply direction on initial load
document.documentElement.lang = savedLang;
document.documentElement.dir  = savedLang === 'he' ? 'rtl' : 'ltr';

export default i18next;
