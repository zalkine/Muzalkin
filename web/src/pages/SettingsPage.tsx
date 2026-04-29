import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase, signOut } from '../lib/supabase';
import { changeAppLanguage } from '../lib/i18n';
import { useTheme } from '../lib/ThemeContext';

type Instrument = 'guitar' | 'piano';
type Language   = 'he' | 'en';

const BACKEND_URL = '';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const { theme, toggle } = useTheme();

  const [instrument, setInstrument] = useState<Instrument>('guitar');
  const [language,   setLanguage]   = useState<Language>('he');

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
        if (data.language) {
          setLanguage(data.language as Language);
          // Sync app direction with DB preference (handles new devices / cleared localStorage)
          if (data.language !== i18n.language) {
            changeAppLanguage(data.language as Language);
          }
        }
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

  const sectionLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, color: 'var(--text3)',
    textTransform: 'uppercase', textAlign: isRTL ? 'right' : 'left',
  };

  const divider = <div style={{ height: 1, backgroundColor: 'var(--border)', marginInline: 16 }} />;

  return (
    <div style={{ backgroundColor: 'var(--bg)', minHeight: '100%' }}>

      {/* Title */}
      <div style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border)',
        textAlign: isRTL ? 'right' : 'left',
      }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          {t('settings')}
        </h2>
      </div>

      {/* Language */}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={sectionLabel}>{t('language')}</label>
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          border: '1px solid var(--accent)',
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
                backgroundColor: language === lang ? 'var(--accent)' : 'var(--bg)',
                color: language === lang ? '#fff' : 'var(--accent)',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t(lang === 'he' ? 'language_hebrew' : 'language_english')}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--text3)', margin: 0, textAlign: isRTL ? 'right' : 'left' }}>
          {t('language_note')}
        </p>
      </div>

      {divider}

      {/* Instrument */}
      <div style={{ padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={sectionLabel}>{t('instrument')}</label>
        <div style={{
          display: 'flex',
          flexDirection: isRTL ? 'row-reverse' : 'row',
          border: '1px solid var(--accent)',
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
                backgroundColor: instrument === inst ? 'var(--accent)' : 'var(--bg)',
                color: instrument === inst ? '#fff' : 'var(--accent)',
                border: 'none', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t(inst === 'guitar' ? 'instrument_guitar' : 'instrument_piano')}
            </button>
          ))}
        </div>
      </div>

      {divider}

      {/* Dark / Light mode */}
      <div style={{
        padding: '18px 16px',
        display: 'flex',
        flexDirection: isRTL ? 'row-reverse' : 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
            {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={toggle}
          style={{
            position: 'relative',
            width: 52,
            height: 28,
            borderRadius: 14,
            border: 'none',
            backgroundColor: theme === 'dark' ? 'var(--accent)' : '#ccc',
            cursor: 'pointer',
            transition: 'background-color 0.2s',
            flexShrink: 0,
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3,
            left: theme === 'dark' ? 27 : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            backgroundColor: '#fff',
            transition: 'left 0.2s',
            display: 'block',
          }} />
        </button>
      </div>

      {divider}

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
