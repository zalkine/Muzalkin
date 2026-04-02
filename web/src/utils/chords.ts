const NOTES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Map enharmonic equivalents to a canonical index
function noteIndex(note: string): number {
  const idx = NOTES_SHARP.indexOf(note);
  if (idx !== -1) return idx;
  const idxFlat = NOTES_FLAT.indexOf(note);
  if (idxFlat !== -1) return idxFlat;
  return -1;
}

/**
 * Transpose a single chord name by the given number of semitones.
 * Handles roots like C, C#, Db and suffixes like m, 7, maj7, sus4, dim, aug, etc.
 */
export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;

  // Match root note (with optional # or b) and the rest (suffix)
  const match = chord.match(/^([A-G][#b]?)(.*)/);
  if (!match) return chord;

  const [, root, suffix] = match;
  const idx = noteIndex(root);
  if (idx === -1) return chord;

  const newIdx = ((idx + semitones) % 12 + 12) % 12;
  // Use sharps if original used sharp or natural, flats if original used flat
  const useFlats = root.includes('b');
  const newRoot = useFlats ? NOTES_FLAT[newIdx] : NOTES_SHARP[newIdx];
  return newRoot + suffix;
}

// --- Types ---

export interface ChordPosition {
  chord: string;
  position: number; // character index in the lyrics string
}

export interface ChordLine {
  type: 'line';
  lyrics: string;
  chords: ChordPosition[];
}

export interface SectionLine {
  type: 'section';
  content: string;
}

export type ChordDataEntry = ChordLine | SectionLine;

export interface Song {
  id: string;
  title: string;
  artist: string;
  language: 'he' | 'en';
  chordsData: ChordDataEntry[];
}

/**
 * Transpose all chords in a song's chord data.
 */
export function transposeSong(data: ChordDataEntry[], semitones: number): ChordDataEntry[] {
  if (semitones === 0) return data;
  return data.map((entry) => {
    if (entry.type === 'section') return entry;
    return {
      ...entry,
      chords: entry.chords.map((c) => ({
        ...c,
        chord: transposeChord(c.chord, semitones),
      })),
    };
  });
}

/**
 * Split a chord-line into segments for rendering.
 * Each segment = { chord: string | null, text: string }
 * The text is the slice of lyrics from this chord's position to the next.
 */
export function splitLineIntoSegments(
  line: ChordLine,
): { chord: string | null; text: string }[] {
  const { lyrics, chords } = line;
  if (chords.length === 0) {
    return [{ chord: null, text: lyrics }];
  }

  // Sort chords by position
  const sorted = [...chords].sort((a, b) => a.position - b.position);
  const segments: { chord: string | null; text: string }[] = [];

  // If the first chord doesn't start at 0, there's a leading text segment
  if (sorted[0].position > 0) {
    segments.push({ chord: null, text: lyrics.slice(0, sorted[0].position) });
  }

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i].position;
    const end = i + 1 < sorted.length ? sorted[i + 1].position : lyrics.length;
    segments.push({
      chord: sorted[i].chord,
      text: lyrics.slice(start, end),
    });
  }

  return segments;
}
