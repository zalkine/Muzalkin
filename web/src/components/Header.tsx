import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

export default function Header() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  function toggleLanguage() {
    const newLang = i18n.language === 'he' ? 'en' : 'he';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'he' ? 'rtl' : 'ltr';
    document.documentElement.lang = newLang;
  }

  return (
    <header
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        direction: isRTL ? 'rtl' : 'ltr',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 28 }}>🎸</span>
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--color-text)',
            fontFamily: 'var(--font-english)',
          }}
        >
          MuZalkin
        </span>
      </Link>
      <button
        onClick={toggleLanguage}
        style={{
          background: 'var(--color-surface-hover)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          padding: '6px 16px',
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {i18n.language === 'he' ? 'English' : 'עברית'} · {t('language')}
      </button>
    </header>
  );
}
