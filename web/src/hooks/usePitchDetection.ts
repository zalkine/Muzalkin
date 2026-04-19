import { useState, useRef, useCallback } from 'react';

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(freq: number): { note: string; octave: number; cents: number } {
  const midi = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const note = CHROMATIC[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { note, octave, cents };
}

function autoCorrelate(buf: Float32Array, sampleRate: number): number {
  const SIZE = buf.length;

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / SIZE) < 0.008) return -1;

  // Guitar / piano range: 50 Hz – 2000 Hz
  const maxLag = Math.min(Math.ceil(sampleRate / 50), SIZE >>> 1);

  // Precompute all correlations once
  const corr = new Float32Array(maxLag);
  for (let lag = 0; lag < maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < SIZE - lag; i++) sum += buf[i] * buf[i + lag];
    corr[lag] = sum;
  }

  // Find first valley (correlation stops decreasing)
  let valley = 0;
  while (valley < maxLag - 1 && corr[valley] >= corr[valley + 1]) valley++;

  // Find global max after valley
  let bestCorr = -1;
  let bestLag = -1;
  for (let lag = valley; lag < maxLag; lag++) {
    if (corr[lag] > bestCorr) {
      bestCorr = corr[lag];
      bestLag = lag;
    }
  }

  if (bestLag <= 0) return -1;

  // Parabolic interpolation for sub-sample accuracy
  if (bestLag > 0 && bestLag < maxLag - 1) {
    const y1 = corr[bestLag - 1];
    const y2 = corr[bestLag];
    const y3 = corr[bestLag + 1];
    const denom = 2 * y2 - y1 - y3;
    if (denom > 0) return sampleRate / (bestLag + (y1 - y3) / (2 * denom));
  }

  return sampleRate / bestLag;
}

export interface PitchResult {
  note: string;
  octave: number;
  cents: number;
  frequency: number;
}

export function usePitchDetection() {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef     = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const rafRef     = useRef<number>(0);
  const bufRef     = useRef<Float32Array | null>(null);
  // Stability: only display a note that appears twice in a row
  const prevNoteRef = useRef<string>('');

  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const buf = bufRef.current;
    if (!analyser || !buf) return;

    analyser.getFloatTimeDomainData(buf);
    const freq = autoCorrelate(buf, ctxRef.current!.sampleRate);

    if (freq > 50 && freq < 2000) {
      const { note, octave, cents } = frequencyToNote(freq);
      const key = `${note}${octave}`;
      if (key === prevNoteRef.current) {
        setResult({ note, octave, cents, frequency: Math.round(freq * 10) / 10 });
      }
      prevNoteRef.current = key;
    } else {
      prevNoteRef.current = '';
      setResult(null);
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      bufRef.current = new Float32Array(analyser.fftSize);

      ctx.createMediaStreamSource(stream).connect(analyser);

      setIsActive(true);
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isPermission = /NotAllowed|Permission|denied/i.test(msg);
      setError(isPermission ? 'permission_denied' : 'mic_error');
    }
  }, [detect]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close();
    ctxRef.current = null;
    analyserRef.current = null;
    streamRef.current = null;
    bufRef.current = null;
    prevNoteRef.current = '';
    setIsActive(false);
    setResult(null);
  }, []);

  return { result, isActive, error, start, stop };
}
