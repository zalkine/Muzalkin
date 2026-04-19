import { useState, useRef, useCallback } from 'react';
import { PitchDetector } from 'pitchy';

const CHROMATIC = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(freq: number): { note: string; octave: number; cents: number } {
  const midi = 12 * Math.log2(freq / 440) + 69;
  const rounded = Math.round(midi);
  const cents = Math.round((midi - rounded) * 100);
  const note = CHROMATIC[((rounded % 12) + 12) % 12];
  const octave = Math.floor(rounded / 12) - 1;
  return { note, octave, cents };
}

export interface PitchResult {
  note: string;
  octave: number;
  cents: number;
  frequency: number;
}

const CLARITY_THRESHOLD = 0.9;
const STABILITY_FRAMES  = 3;
// EMA smoothing factor for cents — lower = smoother needle, higher = faster response
const CENTS_ALPHA       = 0.15;
// Only push a new result to React state at most every N ms (matches CSS transition)
const UPDATE_MS         = 100;

export function usePitchDetection() {
  const [result, setResult] = useState<PitchResult | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ctxRef         = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const rafRef         = useRef<number>(0);
  const detectorRef    = useRef<PitchDetector<Float32Array> | null>(null);
  const inputRef       = useRef<Float32Array | null>(null);
  const prevKeyRef     = useRef<string>('');
  const countRef       = useRef<number>(0);
  const smoothCentsRef = useRef<number>(0);
  const lastUpdateRef  = useRef<number>(0);

  const detect = useCallback(() => {
    const analyser = analyserRef.current;
    const detector = detectorRef.current;
    const input    = inputRef.current;
    if (!analyser || !detector || !input) return;

    analyser.getFloatTimeDomainData(input);
    const [freq, clarity] = detector.findPitch(input, ctxRef.current!.sampleRate);

    if (clarity > CLARITY_THRESHOLD && freq > 50 && freq < 2000) {
      const { note, octave, cents } = frequencyToNote(freq);
      const key = `${note}${octave}`;

      if (key === prevKeyRef.current) {
        // Smooth cents with EMA so the needle glides rather than jumps
        smoothCentsRef.current = CENTS_ALPHA * cents + (1 - CENTS_ALPHA) * smoothCentsRef.current;
        countRef.current++;

        if (countRef.current >= STABILITY_FRAMES) {
          const now = performance.now();
          if (now - lastUpdateRef.current >= UPDATE_MS) {
            lastUpdateRef.current = now;
            setResult({
              note, octave,
              cents: Math.round(smoothCentsRef.current),
              frequency: Math.round(freq * 10) / 10,
            });
          }
        }
      } else {
        prevKeyRef.current     = key;
        countRef.current       = 1;
        smoothCentsRef.current = cents; // reset smoothing on note change
      }
    } else {
      prevKeyRef.current     = '';
      countRef.current       = 0;
      setResult(null);
    }

    rafRef.current = requestAnimationFrame(detect);
  }, []);

  const start = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,  // these three are designed for voice calls —
          noiseSuppression: false,  // they distort the signal and break pitch detection
          autoGainControl:  false,  // on mobile especially
          sampleRate: 44100,
        },
        video: false,
      });
      streamRef.current = stream;

      const ctx = new AudioContext();
      ctxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;

      const detector = PitchDetector.forFloat32Array(analyser.fftSize);
      detectorRef.current = detector;
      inputRef.current = new Float32Array(detector.inputLength);

      ctx.createMediaStreamSource(stream).connect(analyser);

      setIsActive(true);
      rafRef.current = requestAnimationFrame(detect);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(/NotAllowed|Permission|denied/i.test(msg) ? 'permission_denied' : 'mic_error');
    }
  }, [detect]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    ctxRef.current?.close();
    ctxRef.current   = null;
    analyserRef.current = null;
    streamRef.current   = null;
    detectorRef.current = null;
    inputRef.current    = null;
    prevKeyRef.current  = '';
    countRef.current    = 0;
    setIsActive(false);
    setResult(null);
  }, []);

  return { result, isActive, error, start, stop };
}
