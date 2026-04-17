import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// ── Guitar strings (standard tuning) ──────────────────────────────────────────
const STRINGS = [
  { name: 'E2', freq: 82.41 },
  { name: 'A2', freq: 110.00 },
  { name: 'D3', freq: 146.83 },
  { name: 'G3', freq: 196.00 },
  { name: 'B3', freq: 246.94 },
  { name: 'E4', freq: 329.63 },
];

// ── Pitch detection via autocorrelation ───────────────────────────────────────
function detectPitch(buf: Float32Array, sampleRate: number): number | null {
  const MIN_FREQ = 60, MAX_FREQ = 1400;
  const minPeriod = Math.floor(sampleRate / MAX_FREQ);
  const maxPeriod = Math.floor(sampleRate / MIN_FREQ);
  const n = buf.length;

  let bestCorr = -Infinity, bestPeriod = -1;
  for (let p = minPeriod; p <= maxPeriod; p++) {
    let corr = 0;
    for (let i = 0; i < n - p; i++) corr += buf[i] * buf[i + p];
    corr /= (n - p);
    if (corr > bestCorr) { bestCorr = corr; bestPeriod = p; }
  }
  if (bestCorr < 0.01 || bestPeriod < 0) return null;

  // Parabolic interpolation for sub-sample accuracy
  if (bestPeriod > 0 && bestPeriod < maxPeriod) {
    let prev = 0, curr = 0, next_ = 0;
    for (let i = 0; i < n - bestPeriod - 1; i++) {
      prev  += buf[i] * buf[i + bestPeriod - 1];
      curr  += buf[i] * buf[i + bestPeriod];
      next_ += buf[i] * buf[i + bestPeriod + 1];
    }
    const d = prev - 2 * curr + next_;
    if (d !== 0) {
      const refinedPeriod = bestPeriod - 0.5 * (next_ - prev) / d;
      return sampleRate / refinedPeriod;
    }
  }
  return sampleRate / bestPeriod;
}

// ── Note mapping ──────────────────────────────────────────────────────────────
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

function freqToNote(freq: number): { name: string; octave: number; cents: number } {
  const A4 = 440;
  const semitones = 12 * Math.log2(freq / A4);
  const rounded   = Math.round(semitones);
  const noteIdx   = ((rounded % 12) + 12 + 9) % 12;
  const octave    = Math.floor((rounded + 9) / 12) + 4;
  const cents     = Math.round((semitones - rounded) * 100);
  return { name: NOTE_NAMES[noteIdx], octave, cents };
}

// ── Dial SVG helpers ──────────────────────────────────────────────────────────
const CX = 160, CY = 160, R = 130, TRACK_W = 18;

/** angle: degrees from 12-o'clock, clockwise. Returns SVG x,y. */
function polar(angleDeg: number, r = R): [number, number] {
  const rad = (angleDeg - 90) * Math.PI / 180;
  return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
}

/** SVG arc path from startDeg to endDeg (12-o'clock, clockwise). */
function arc(startDeg: number, endDeg: number, r = R): string {
  const [x1, y1] = polar(startDeg, r);
  const [x2, y2] = polar(endDeg, r);
  const span = ((endDeg - startDeg) % 360 + 360) % 360;
  const large = span > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

// Coloured segments: startCents, endCents (symmetric around 0), color
type Seg = { s: number; e: number; color: string };
const SEGMENTS: Seg[] = [
  { s: -150, e: -90,  color: '#ef4444' },
  { s: -90,  e: -45,  color: '#f97316' },
  { s: -45,  e: -18,  color: '#fbbf24' },
  { s: -18,  e: +18,  color: '#4ade80' },
  { s: +18,  e: +45,  color: '#fbbf24' },
  { s: +45,  e: +90,  color: '#f97316' },
  { s: +90,  e: +150, color: '#ef4444' },
];

// cents → dial angle (±50 cents = ±150°)
function centsToAngle(c: number): number { return Math.max(-150, Math.min(150, c * 3)); }

// ── Component ─────────────────────────────────────────────────────────────────
export default function TunerPage() {
  const navigate = useNavigate();

  const [running,    setRunning]    = useState(false);
  const [note,       setNote]       = useState<string | null>(null);
  const [freq,       setFreq]       = useState<number | null>(null);
  const [cents,      setCents]      = useState(0);
  const [activeStr,  setActiveStr]  = useState<number | null>(null);
  const [micDenied,  setMicDenied]  = useState(false);

  const audioCtxRef   = useRef<AudioContext | null>(null);
  const analyserRef   = useRef<AnalyserNode | null>(null);
  const streamRef     = useRef<MediaStream | null>(null);
  const rafRef        = useRef<number | null>(null);
  const lastUpdate    = useRef(0);
  const smoothedCents = useRef(0); // EMA — avoids jumpy needle

  // Cleanup on unmount
  useEffect(() => () => stopTuner(), []);

  const stopTuner = useCallback(() => {
    if (rafRef.current)  { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    audioCtxRef.current   = null;
    analyserRef.current   = null;
    streamRef.current     = null;
    smoothedCents.current = 0;
    setRunning(false);
  }, []);

  const startTuner = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false } });
      streamRef.current = stream;

      const ctx      = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const buf = new Float32Array(analyser.fftSize);
      const tick = (now: number) => {
        rafRef.current = requestAnimationFrame(tick);
        if (now - lastUpdate.current < 66) return; // ~15 fps
        lastUpdate.current = now;
        analyser.getFloatTimeDomainData(buf);
        const f = detectPitch(buf, ctx.sampleRate);
        if (f) {
          const { name, cents: c } = freqToNote(f);
          // EMA smoothing — α=0.12 gives ~8-frame lag, much less jumpy
          // than raw cents which can swing ±30¢ between frames
          smoothedCents.current = 0.12 * c + 0.88 * smoothedCents.current;
          setNote(name);
          setFreq(Math.round(f * 10) / 10);
          setCents(Math.round(smoothedCents.current));
          const closest = STRINGS.reduce((best, s, i) =>
            Math.abs(s.freq - f) < Math.abs(STRINGS[best].freq - f) ? i : best, 0);
          setActiveStr(closest);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
      setRunning(true);
      setMicDenied(false);
    } catch {
      setMicDenied(true);
    }
  }, []);

  const toggleTuner = () => running ? stopTuner() : startTuner();

  // Dial needle angle
  const needleAngle = centsToAngle(cents);

  // Needle colour
  const tuneColor = Math.abs(cents) <= 5 ? '#4ade80' : Math.abs(cents) <= 15 ? '#fbbf24' : '#ef4444';

  return (
    <div style={{
      minHeight: '100%',
      background: `
        radial-gradient(ellipse at 50% 20%, rgba(120,40,200,0.4) 0%, transparent 55%),
        radial-gradient(ellipse at 80% 70%, rgba(200,40,100,0.25) 0%, transparent 50%),
        #0c0c1a
      `,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', padding: '48px 20px 16px' }}>
        <button onClick={() => navigate('/search')} style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'rgba(255,255,255,0.1)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#fff' }}>Guitar Tuner</h1>
        <button style={{
          width: 40, height: 40, borderRadius: '50%',
          background: running ? 'linear-gradient(135deg, #FF6B9D, #A040FF)' : 'rgba(255,255,255,0.1)',
          border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          boxShadow: running ? '0 0 20px rgba(255,107,157,0.5)' : 'none',
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </button>
      </div>

      {/* ── Circular Dial ────────────────────────────────────────────────── */}
      <div style={{ position: 'relative', width: 320, height: 320 }}>
        <svg viewBox="0 0 320 320" style={{ width: '100%', height: '100%' }}>
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Background track */}
          <path d={arc(-150, 150)} fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth={TRACK_W} strokeLinecap="round"/>

          {/* Coloured segments */}
          {SEGMENTS.map((seg, i) => (
            <path key={i} d={arc(seg.s, seg.e)} fill="none" stroke={seg.color}
              strokeWidth={TRACK_W} strokeLinecap="round" opacity={running ? 0.85 : 0.3}/>
          ))}

          {/* Tick marks — outside the arc */}
          {Array.from({ length: 11 }, (_, i) => {
            const angleDeg = -150 + i * 30;
            const [x1, y1] = polar(angleDeg, R + TRACK_W / 2 + 4);
            const [x2, y2] = polar(angleDeg, R + TRACK_W / 2 + 10);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="rgba(255,255,255,0.35)" strokeWidth={i === 5 ? 2.5 : 1.5} strokeLinecap="round"/>;
          })}

          {/* ── Center hole — drawn BEFORE needle so needle renders on top ── */}
          <circle cx={CX} cy={CY} r={R - TRACK_W / 2 - 2} fill="#0c0c1a"/>

          {/* ── Needle — on top of center circle ─────────────────────────── */}
          {/*  Tip reaches to inner edge of arc (R − TRACK_W) = 112 from center  */}
          {/*  Base is 22 px from center so pivot dot covers it                  */}
          <g transform={`rotate(${needleAngle}, ${CX}, ${CY})`} filter="url(#glow)">
            <line
              x1={CX} y1={CY - 22}
              x2={CX} y2={CY - (R - TRACK_W)}
              stroke={running ? tuneColor : 'rgba(255,255,255,0.45)'}
              strokeWidth={3} strokeLinecap="round"
            />
            {/* Tip dot at the arc */}
            <circle cx={CX} cy={CY - (R - TRACK_W)} r={5}
              fill={running ? tuneColor : 'rgba(255,255,255,0.45)'}/>
          </g>

          {/* Pivot dot at center */}
          <circle cx={CX} cy={CY} r={8}
            fill="rgba(30,30,60,0.95)" stroke="rgba(255,255,255,0.15)" strokeWidth={1}/>
          <circle cx={CX} cy={CY} r={4}
            fill={running ? tuneColor : 'rgba(255,255,255,0.5)'}/>

          {/* Center content */}
          {running && note ? (
            <>
              <text x={CX} y={CY - 12} textAnchor="middle" fill={tuneColor}
                fontSize="48" fontWeight="900" fontFamily="Sora, system-ui">
                {note}
              </text>
              <text x={CX} y={CY + 20} textAnchor="middle" fill="rgba(255,255,255,0.45)"
                fontSize="14" fontFamily="Sora, system-ui">
                {freq} Hz
              </text>
              <text x={CX} y={CY + 40} textAnchor="middle"
                fill={Math.abs(cents) <= 5 ? '#4ade80' : tuneColor}
                fontSize="13" fontWeight="700" fontFamily="Sora, system-ui">
                {Math.abs(cents) <= 5
                  ? '✓ In Tune'
                  : cents > 0
                    ? `+${cents}¢  tune down`
                    : `${cents}¢  tune up`}
              </text>
            </>
          ) : (
            <text x={CX} y={CY + 8} textAnchor="middle" fill="rgba(255,255,255,0.25)"
              fontSize="16" fontFamily="Sora, system-ui">
              {running ? 'Listening…' : 'Tap Start'}
            </text>
          )}
        </svg>
      </div>

      {/* ── String ruler ─────────────────────────────────────────────────── */}
      <div style={{ width: '100%', padding: '0 20px', marginTop: 8 }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '10px 16px',
        }}>
          {/* Ruler ticks */}
          <div style={{ position: 'absolute', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          {STRINGS.map((s, i) => (
            <button
              key={i}
              onClick={() => setActiveStr(i)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'none', border: 'none', cursor: 'pointer',
                color: activeStr === i ? '#5B8DFF' : 'rgba(255,255,255,0.45)',
                fontWeight: activeStr === i ? 800 : 500,
                fontSize: 13,
                transition: 'color 0.2s',
              }}
            >
              <div style={{
                width: 2, height: activeStr === i ? 14 : 8,
                borderRadius: 1,
                background: activeStr === i ? '#5B8DFF' : 'rgba(255,255,255,0.3)',
                transition: 'height 0.2s, background 0.2s',
              }} />
              <span>{s.name.replace(/[0-9]/, '')}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 0', marginTop: 2 }}>
          {STRINGS.map((s, i) => (
            <span key={i} style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace' }}>
              {s.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── Mic denied message ────────────────────────────────────────────── */}
      {micDenied && (
        <p style={{ color: '#f87171', fontSize: 13, margin: '12px 20px', textAlign: 'center' }}>
          Microphone access denied. Please allow mic access in your browser settings.
        </p>
      )}

      {/* ── Start/Stop button ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 40px', width: '100%' }}>
        <button
          onClick={toggleTuner}
          style={{
            width: '100%', height: 56, borderRadius: 50, cursor: 'pointer',
            background: running
              ? 'rgba(239,68,68,0.2)'
              : 'linear-gradient(90deg, #5B8DFF, #A040FF)',
            color: running ? '#ef4444' : '#fff',
            fontSize: 17, fontWeight: 800,
            boxShadow: running ? 'none' : '0 4px 30px rgba(91,141,255,0.45)',
            border: running ? '1px solid rgba(239,68,68,0.4)' : 'none',
            transition: 'all 0.3s',
          }}
        >
          {running ? '■ Stop Tuning' : '▶ Start Tuning'}
        </button>
      </div>
    </div>
  );
}
