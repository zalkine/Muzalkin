import { SongCardSkeleton } from './SongCard';

// ── Section skeleton ──────────────────────────────────────────────────────────
export function SectionSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mt-6 px-4">
      <div
        className="mb-3 h-3 w-1/3 rounded-full bg-shimmer bg-200%"
        style={{ animation: 'shimmer 1.5s linear infinite' }}
      />
      <div className="space-y-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <SongCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  emoji?: string;
  children: React.ReactNode;
  onSeeAll?: () => void;
  seeAllLabel?: string;
  /** When true, renders a grid instead of a list on tablet+ */
  grid?: boolean;
}

export default function Section({ title, emoji, children, onSeeAll, seeAllLabel, grid }: SectionProps) {
  return (
    <section className="mt-6 px-4">
      {/* Header row */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/40">
          {emoji && <span>{emoji}</span>}
          {title}
        </h2>
        {onSeeAll && (
          <button
            onClick={onSeeAll}
            className="text-xs font-semibold text-accent/70 transition-colors hover:text-accent"
          >
            {seeAllLabel ?? 'See all →'}
          </button>
        )}
      </div>

      {/* Content */}
      <div className={grid ? 'grid grid-cols-1 gap-2.5 md:grid-cols-2' : 'space-y-2.5'}>
        {children}
      </div>
    </section>
  );
}
