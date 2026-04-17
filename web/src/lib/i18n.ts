import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '../../locales/en.json';
import he from '../../locales/he.json';

// Use saved preference; on first visit detect from device/browser language
function detectDefaultLang(): 'he' | 'en' {
  const saved = localStorage.getItem('muzalkin_lang');
  if (saved === 'he' || saved === 'en') return saved;
  // navigator.language is e.g. 'he', 'he-IL', 'en-US'
  return navigator.language?.toLowerCase().startsWith('he') ? 'he' : 'en';
}
const savedLang = detectDefaultLang();

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
