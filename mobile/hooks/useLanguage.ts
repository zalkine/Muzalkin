import { useCallback, useEffect, useState } from 'react';
import { I18nManager } from 'react-native';
import i18next from 'i18next';

import { supabase } from '../lib/supabase';

export type Language = 'he' | 'en';

/**
 * Manages app language and RTL state.
 *
 * - Reads the authenticated user's saved language from Supabase on mount.
 * - Changing language updates i18next, sets I18nManager RTL flag, and
 *   persists the choice back to Supabase.
 *
 * NOTE: React Native requires an app restart for I18nManager.forceRTL to
 * fully take effect (navigation stacks must remount). Inform the user when
 * the language change requires a restart.
 */
export function useLanguage() {
  const [language, setLanguageState] = useState<Language>(
    I18nManager.isRTL ? 'he' : 'en',
  );

  // Load persisted language from Supabase on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase
        .from('users')
        .select('language')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.language && data.language !== language) {
            applyLanguage(data.language as Language);
          }
        });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Apply language locally (i18next + RTL flag) without persisting. */
  function applyLanguage(lang: Language) {
    i18next.changeLanguage(lang);
    const shouldBeRTL = lang === 'he';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
    }
    setLanguageState(lang);
  }

  /** Change language, persist to Supabase, and apply locally. */
  const setLanguage = useCallback(async (lang: Language) => {
    applyLanguage(lang);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('users').update({ language: lang }).eq('id', user.id);
    }
  }, []);

  return {
    language,
    setLanguage,
    isRTL: language === 'he',
  };
}
