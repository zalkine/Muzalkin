import i18next from 'i18next';
import { I18nManager } from 'react-native';
import { initReactI18next } from 'react-i18next';

import en from '../locales/en.json';
import he from '../locales/he.json';

/**
 * Minimal i18next setup using inline resources (no async backend).
 * `initImmediate: false` makes init synchronous so translations are available
 * on the very first render without a loading state.
 *
 * Language defaults to Hebrew on RTL devices, English otherwise.
 * The user can override this later in Settings (stored in users.language).
 */
i18next.use(initReactI18next).init({
  lng: 'he',
  fallbackLng: 'en',
  resources: {
    en: { translation: en },
    he: { translation: he },
  },
  interpolation: {
    escapeValue: false, // React already escapes values
  },
  initImmediate: false, // synchronous init — no loading flash
});

export default i18next;
