import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, signOut } from '../lib/supabase';
import { changeAppLanguage } from '../lib/i18n';

type Instrument = 'guitar' | 'piano';
type Language   = 'he' | 'en';

const BACKEND_URL = '';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const [language,   setLanguage]   = useState<Language>('he');

  // Load preferences from DB on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('users')
        .select('language, instrument')
        .eq('id', user.id)
        .single();

      if (data) {
        if (data.language)   setLanguage(data.language as Language);
        if (data.instrument) setInstrument(data.instrument as Instrument);
      }
    })();
  }, []);

  const savePreference = useCallback(async (updates: { language?: Language; instrument?: Instrument }) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await fetch(`${BACKEND_URL}/api/songs/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updates),
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  }, []);

  const handleLanguageChange = useCallback(async (lang: Language) => {
    setLanguage(lang);
    changeAppLanguage(lang);
    await savePreference({ language: lang });
  }, [savePreference]);

  const handleInstrumentChange = useCallback(async (inst: Instrument) => {
    setInstrument(inst);
    await savePreference({ instrument: inst });
  }, [savePreference]);

  const handleSignOut = useCallback(async () => {
    if (!window.confirm(t('sign_out') + '?')) return;
    await signOut();
    window.location.href = '/';
  }, [t]);

  return (
    <div style={{ backgroundColor: '#fff', minHeight: '100%' }}>

      {/* Title */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid #e0e0e0',
        textAlign: isRTL ? 'right' : 'left',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111', margin: 0 }}>{t('settings')}</h2>
      </div>

      {/* Language */}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{
          fontSize: 13, fontWeight: 600, color: '#888',
          textTransform: 'uppercase', textAlign: isRTL ? 'right' : 'left',
        }}>
          {t('language')}
        </label>
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          border: '1px solid #4285F4',
          borderRadius: 8,
          overflow: 'hidden',
          alignSelf: 'flex-start',
        }}>
          {(['he', 'en'] as Language[]).map((lang) => (
            <button
              key={lang}
              onClick={() => handleLanguageChange(lang)}
              style={{
                paddingInline: 20, paddingBlock: 9,
                backgroundColor: language === lang ? '#4285F4' : '#fff',
                color: language === lang ? '#fff' : '#4285F4',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t(lang === 'he' ? 'language_hebrew' : 'language_english')}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: '#aaa', margin: 0, textAlign: isRTL ? 'right' : 'left' }}>
          {t('language_note')}
        </p>
      </div>

      <div style={{ height: 1, backgroundColor: '#e0e0e0', marginInline: 16 }} />

      {/* Instrument */}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={{
          fontSize: 13, fontWeight: 600, color: '#888',
          textTransform: 'uppercase', textAlign: isRTL ? 'right' : 'left',
        }}>
          {t('instrument')}
        </label>
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          border: '1px solid #4285F4',
          borderRadius: 8,
          overflow: 'hidden',
          alignSelf: 'flex-start',
        }}>
          {(['guitar', 'piano'] as Instrument[]).map((inst) => (
            <button
              key={inst}
              onClick={() => handleInstrumentChange(inst)}
              style={{
                paddingInline: 20, paddingBlock: 9,
                backgroundColor: instrument === inst ? '#4285F4' : '#fff',
                color: instrument === inst ? '#fff' : '#4285F4',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t(inst === 'guitar' ? 'instrument_guitar' : 'instrument_piano')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: '#e0e0e0', marginInline: 16 }} />

      {/* Sign out */}
      <div style={{ padding: '18px 16px', textAlign: isRTL ? 'right' : 'left' }}>
        <button
          onClick={handleSignOut}
          style={{
            background: 'none', border: 'none',
            fontSize: 16, color: '#cc3333', fontWeight: 500, cursor: 'pointer',
          }}
        >
          {t('sign_out')}
        </button>
      </div>
    </div>
  );
}
