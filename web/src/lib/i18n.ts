import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../../locales/en.json';
import he from '../../locales/he.json';

// Detect saved language from localStorage, default to Hebrew
const savedLang = localStorage.getItem('muzalkin_lang') ?? 'he';

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
