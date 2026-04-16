import { useTranslation } from 'react-i18next';
import type { User } from './types';

interface HeaderProps {
  user: User | null;
}

export default function Header({ user }: HeaderProps) {
  const { i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '☀️ Good morning';
    if (hour < 17) return '🎵 Good afternoon';
    return '🌙 Good evening';
  };

  return (
    <header
      className="relative overflow-hidden bg-hero-grad px-5 pt-10 pb-6 text-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent opacity-10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-36 w-36 translate-x-1/2 translate-y-1/2 rounded-full bg-accent2 opacity-10 blur-3xl" />
      </div>

      <div className="relative">
        {user?.isAuthenticated ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
              {greeting()}
            </p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight">
              {isRTL ? `היי ${user.firstName}` : `Hi ${user.firstName}`} 👋
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {isRTL ? 'על מה בא לך לנגן היום?' : "What's on your mood to Muze today?"}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/50">
              MuZalkin
            </p>
            <h1 className="mt-0.5 text-2xl font-black tracking-tight">
              {isRTL ? 'שחק עם מוזלקין 🎸' : 'Play with MuZalkin 🎸'}
            </h1>
            <p className="mt-1 text-sm text-white/50">
              {isRTL ? 'מצא אקורדים. שחק מיידית.' : 'Find chords. Play instantly.'}
            </p>
          </>
        )}
      </div>
    </header>
  );
}
