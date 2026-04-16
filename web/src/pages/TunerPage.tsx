/**
 * TunerPage
 *
 * Real-time guitar tuner using the Web Audio API.
 * Requests microphone access, runs an autocorrelation pitch-detection
 * algorithm on each animation frame, and displays the detected note
 * with a cents-deviation meter.
 *
 * Supported on Chrome/Android and Safari iOS 14.5+.
 * On unsupported browsers the mic button is shown but getUserMedia will
 * throw — the error is caught and a message is shown.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

// ---------------------------------------------------------------------------
// Guitar string reference
// ---------------------------------------------------------------------------

const GUITAR_STRINGS = [
  { label: 'E', octave: 2, freq: 82.41  },
  { label: 'A', octave: 2, freq: 110.00 },
  { label: 'D', octave: 3, freq: 146.83 },
  { label: 'G', octave: 3, freq: 196.00 },
  { label: 'B', octave: 3, freq: 246.94 },
  { label: 'E', octave: 4, freq: 329.63 },
];

// ---------------------------------------------------------------------------
// Pitch detection — autocorrelation over the guitar frequency range
// ---------------------------------------------------------------------------

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function detectPitch(buffer: Float32Array, sampleRate: number): number {
  // RMS check — ignore silence
  let rms = 0;
  for (let i = 0; i < buffer.length; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / buffer.length);
  if (rms < 0.012) return -1;

  // Only scan lags corresponding to 60–1400 Hz (covers all guitar strings + harmonics)
  const minLag = Math.floor(sampleRate / 1400);
  const maxLag = Math.ceil(sampleRate / 60);
  const len    = buffer.length;

  let maxCorr = -Infinity, bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    for (let j = 0; j < len - lag; j++) corr += buffer[j] * buffer[j + lag];
    if (corr > maxCorr) { maxCorr = corr; bestLag = lag; }
  }
  if (bestLag <= 0 || bestLag >= len - 1) return -1;

  // Parabolic interpolation for sub-sample accuracy
  const a = bestLag > 0        ? (maxCorr - (buffer[bestLag - 1] ?? 0)) : 0;
  const b = bestLag < len - 1  ? ((buffer[bestLag + 1] ?? 0) - maxCorr) : 0;
  const interp = (a + b) !== 0 ? bestLag + (b - a) / (2 * (a + b)) : bestLag;

  return sampleRate / interp;
}

type NoteInfo = {
  name:   string;
  octave: number;
  cents:  number;
  hz:     number;
};

function frequencyToNote(freq: number): NoteInfo | null {
  if (freq <= 0) return null;
  const midi   = 69 + 12 * Math.log2(freq / 440);
  const rounded = Math.round(midi);
  const target  = 440 * Math.pow(2, (rounded - 69) / 12);
  const cents   = Math.round(1200 * Math.log2(freq / target));
  return {
    name:   NOTE_NAMES[((rounded % 12) + 12) % 12],
    octave: Math.floor(rounded / 12) - 1,
    cents:  Math.max(-50, Math.min(50, cents)),
    hz:     Math.round(freq * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TunerPage() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';

  const [isListening,     setIsListening]     = useState(false);
  const [noteInfo,        setNoteInfo]        = useState<NoteInfo | null>(null);
  const [permissionError, setPermissionError] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const rafRef      = useRef<number | null>(null);
  const bufferRef   = useRef(new Float32Array(2048));
  // Throttle updates to ~15 fps so UI isn't jittery
  const lastUpdateRef = useRef(0);

  const analyze = useCallback(() => {
    if (!analyserRef.current || !audioCtxRef.current) return;

    analyserRef.current.getFloatTimeDomainData(bufferRef.current);
    const now = performance.now();
    if (now - lastUpdateRef.current > 66) {   // ~15 fps
      lastUpdateRef.current = now;
      const freq = detectPitch(bufferRef.current, audioCtxRef.current.sampleRate);
      setNoteInfo(freq > 0 ? frequencyToNote(freq) : null);
    }
    rafRef.current = requestAnimationFrame(analyze);
  }, []);

  const startListening = useCallback(async () => {
    setPermissionError(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current   = stream;
      const ctx           = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser      = ctx.createAnalyser();
      analyser.fftSize    = 4096;
      analyserRef.current = analyser;
      ctx.createMediaStreamSource(stream).connect(analyser);
      setIsListening(true);
      rafRef.current = requestAnimationFrame(analyze);
    } catch {
      setPermissionError(true);
    }
  }, [analyze]);

  const stopListening = useCallback(() => {
    if (rafRef.current)    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (audioCtxRef.current) audioCtxRef.current.close();
    audioCtxRef.current = null;
    analyserRef.current = null;
    streamRef.current   = null;
    setIsListening(false);
    setNoteInfo(null);
  }, []);

  // Clean up when navigating away
  useEffect(() => () => { stopListening(); }, [stopListening]);

  // ---------------------------------------------------------------------------
  // Derived display values
  // ---------------------------------------------------------------------------

  const cents      = noteInfo?.cents ?? 0;
  const inTune     = Math.abs(cents) <= 5;
  const nearlyTune = Math.abs(cents) <= 15;
  const tuneColor  = !noteInfo ? 'var(--text3)'
    : inTune     ? '#22c55e'
    : nearlyTune ? '#f59e0b'
    : '#ef4444';

  // Needle position: 0% = far flat, 50% = centre, 100% = far sharp
  const needlePct = 50 + cents; // cents ranges -50..+50

  const statusLabel = !noteInfo       ? ''
    : inTune                          ? t('tuner_in_tune')
    : cents < 0                       ? t('tuner_flat')
    : t('tuner_sharp');

  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      height:          '100%',
      backgroundColor: 'var(--bg)',
      padding:         '20px 16px 32px',
      direction:       isRTL ? 'rtl' : 'ltr',
      overflowY:       'auto',
    }}>

      {/* ── Title ── */}
      <h2 style={{
        textAlign:    'center',
        color:        'var(--text)',
        fontSize:     20,
        fontWeight:   800,
        margin:       '0 0 24px',
      }}>
        🎙️ {t('tuner_title')}
      </h2>

      {/* ── Main display card ── */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        borderRadius:    20,
        padding:         '32px 24px 28px',
        marginBottom:    20,
        boxShadow:       '0 4px 24px rgba(0,0,0,0.2)',
        display:         'flex',
        flexDirection:   'column',
        alignItems:      'center',
      }}>

        {/* Note name */}
        <div style={{
          fontSize:   100,
          fontWeight: 900,
          lineHeight: 1,
          color:      tuneColor,
          transition: 'color 0.15s',
          letterSpacing: -2,
        }}>
          {noteInfo?.name ?? '—'}
        </div>

        {/* Octave */}
        <div style={{
          fontSize:    22,
          color:       'var(--text3)',
          marginTop:   2,
          marginBottom: 4,
          fontWeight:  600,
        }}>
          {noteInfo ? noteInfo.octave : ''}
        </div>

        {/* Hz readout */}
        <div style={{
          fontSize:     13,
          color:        'var(--text2)',
          marginBottom: 28,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {noteInfo ? `${noteInfo.hz} Hz` : '—'}
        </div>

        {/* ── Cents meter ── */}
        <div style={{ width: '100%', maxWidth: 320 }}>

          {/* Scale labels */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            fontSize:       10,
            color:          'var(--text3)',
            marginBottom:   5,
            paddingInline:  2,
          }}>
            <span>♭ −50</span>
            <span>−25</span>
            <span style={{ fontWeight: 700, color: 'var(--text2)' }}>0</span>
            <span>+25</span>
            <span>+50 ♯</span>
          </div>

          {/* Track */}
          <div style={{
            position:        'relative',
            height:          10,
            backgroundColor: 'var(--surface)',
            borderRadius:    5,
            overflow:        'hidden',
          }}>
            {/* In-tune zone (centre green band) */}
            <div style={{
              position:        'absolute',
              left:            'calc(50% - 5px)',
              width:           10,
              top:             0,
              bottom:          0,
              backgroundColor: 'rgba(34,197,94,0.18)',
            }} />
            {/* Centre tick */}
            <div style={{
              position:        'absolute',
              left:            '50%',
              top:             0,
              width:           2,
              height:          '100%',
              backgroundColor: 'var(--text3)',
              transform:       'translateX(-50%)',
            }} />
            {/* Moving needle */}
            <div style={{
              position:        'absolute',
              left:            `${needlePct}%`,
              top:             0,
              width:           4,
              height:          '100%',
              backgroundColor: tuneColor,
              borderRadius:    2,
              transform:       'translateX(-50%)',
              transition:      'left 0.08s ease-out, background-color 0.15s',
            }} />
          </div>

          {/* Status label */}
          <div style={{
            textAlign:  'center',
            marginTop:  10,
            fontSize:   14,
            fontWeight: 700,
            color:      tuneColor,
            minHeight:  20,
            transition: 'color 0.15s',
          }}>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* ── String reference grid ── */}
      <div style={{
        display:             'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap:                 8,
        marginBottom:        24,
      }}>
        {GUITAR_STRINGS.map((s, i) => {
          const isMatched = noteInfo?.name === s.label && noteInfo?.octave === s.octave;
          return (
            <div key={i} style={{
              backgroundColor: isMatched ? `${tuneColor}22` : 'var(--surface)',
              borderRadius:    10,
              padding:         '10px 4px',
              textAlign:       'center',
              border:          isMatched
                ? `2px solid ${tuneColor}`
                : '1px solid var(--border)',
              transition:      'border-color 0.15s, background-color 0.15s',
            }}>
              <div style={{
                fontSize:   18,
                fontWeight: 800,
                color:      isMatched ? tuneColor : 'var(--text)',
                transition: 'color 0.15s',
              }}>
                {s.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                {s.octave}
              </div>
              <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 1 }}>
                {s.freq}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Permission error ── */}
      {permissionError && (
        <p style={{
          textAlign:    'center',
          color:        '#ef4444',
          fontSize:     13,
          marginBottom: 16,
          padding:      '10px 16px',
          backgroundColor: 'rgba(239,68,68,0.08)',
          borderRadius: 8,
        }}>
          {t('tuner_mic_denied')}
        </p>
      )}

      {/* ── Start / Stop button ── */}
      <button
        onClick={isListening ? stopListening : startListening}
        style={{
          padding:         '14px',
          backgroundColor: isListening ? '#ef4444' : 'var(--accent)',
          color:           '#fff',
          border:          'none',
          borderRadius:    12,
          fontSize:        16,
          fontWeight:      700,
          cursor:          'pointer',
          boxShadow:       isListening
            ? '0 0 20px rgba(239,68,68,0.35)'
            : '0 0 20px var(--accent-glow)',
          transition:      'background-color 0.2s, box-shadow 0.2s',
        }}
      >
        {isListening ? `⏹ ${t('tuner_stop')}` : `🎙️ ${t('tuner_start')}`}
      </button>

      {/* ── Hint ── */}
      <p style={{
        textAlign:  'center',
        color:      'var(--text3)',
        fontSize:   12,
        marginTop:  14,
        lineHeight: 1.5,
      }}>
        {t('tuner_hint')}
      </p>
    </div>
  );
}
