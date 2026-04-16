import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

interface QuickAction {
  icon: string;
  labelKey: string;
  to?: string;
  onClick?: () => void;
  gradient: string;
}

interface QuickActionsRowProps {
  onStartJam?: () => void;
  onJoinJam?: () => void;
}

export default function QuickActionsRow({ onStartJam, onJoinJam }: QuickActionsRowProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const navigate = useNavigate();

  const actions: QuickAction[] = [
    {
      icon: '🎸',
      labelKey: 'jam_start_btn',
      onClick: onStartJam,
      gradient: 'from-accent to-accent2',
    },
    {
      icon: '🎵',
      labelKey: 'jam_join_btn',
      onClick: onJoinJam,
      gradient: 'from-purple-600 to-accent2',
    },
    {
      icon: '🎙️',
      labelKey: 'tuner_nav',
      to: '/tuner',
      gradient: 'from-emerald-600 to-teal-500',
    },
    {
      icon: '📋',
      labelKey: 'playlists',
      to: '/playlists',
      gradient: 'from-orange-600 to-amber-500',
    },
  ];

  return (
    <div className="mt-5 px-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/30">
        {isRTL ? 'פעולות מהירות' : 'Quick Actions'}
      </p>
      <div className="grid grid-cols-4 gap-3">
        {actions.map((action, i) => (
          <button
            key={action.labelKey}
            onClick={action.to ? () => navigate(action.to!) : action.onClick}
            className="animate-fade-up flex flex-col items-center gap-2 rounded-2xl border border-white/10
                       bg-white/5 p-3 transition-all active:scale-95 hover:bg-white/10"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${action.gradient} text-xl shadow-md`}>
              {action.icon}
            </div>
            <span className="text-center text-[10px] font-semibold leading-tight text-white/60">
              {t(action.labelKey)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
