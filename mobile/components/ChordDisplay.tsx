import { forwardRef } from 'react';
import { I18nManager, ScrollView, StyleSheet, Text, View } from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChordLine = {
  type: 'chords' | 'lyrics' | 'section';
  content: string;
};

type Props = {
  data: ChordLine[];
  /** Base font size in sp. Chords scale to 85% of this value. */
  fontSize?: number;
  /** Semitone shift applied to all chord lines (positive = up, negative = down). */
  semitones?: number;
};

// ---------------------------------------------------------------------------
// Chord transposition helpers
// ---------------------------------------------------------------------------

const SHARP_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NOTES  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

function noteToIndex(note: string): number {
  const idx = SHARP_NOTES.indexOf(note);
  if (idx !== -1) return idx;
  return FLAT_NOTES.indexOf(note);
}

function usesFlat(note: string): boolean {
  return FLAT_NOTES.includes(note) && note.includes('b');
}

/**
 * Transpose a single chord token (e.g. "Am7", "F#/C#") by semitones.
 * The chord quality and bass note are preserved; only the root is shifted.
 */
export function transposeChord(chord: string, semitones: number): string {
  if (semitones === 0) return chord;
  const match = chord.match(/^([A-G][#b]?)(.*)$/);
  if (!match) return chord;

  const [, root, rest] = match;
  const [quality, bassNote] = rest.split('/');
  const rootIdx = noteToIndex(root);
  if (rootIdx === -1) return chord;

  const newRootIdx = ((rootIdx + semitones) % 12 + 12) % 12;
  const newRoot = usesFlat(root) ? FLAT_NOTES[newRootIdx] : SHARP_NOTES[newRootIdx];
  let result = newRoot + (quality ?? '');

  if (bassNote !== undefined) {
    const bassIdx = noteToIndex(bassNote);
    if (bassIdx !== -1) {
      const newBassIdx = ((bassIdx + semitones) % 12 + 12) % 12;
      const newBass = usesFlat(bassNote) ? FLAT_NOTES[newBassIdx] : SHARP_NOTES[newBassIdx];
      result += '/' + newBass;
    } else {
      result += '/' + bassNote;
    }
  }
  return result;
}

/** Transpose all chord tokens (whitespace-separated) in a chords-line string. */
export function transposeLine(line: string, semitones: number): string {
  if (semitones === 0) return line;
  return line
    .split(/(\s+)/)
    .map((part) => (/^\s+$/.test(part) ? part : transposeChord(part, semitones)))
    .join('');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ChordDisplay = forwardRef<ScrollView, Props>(
  ({ data, fontSize = 16, semitones = 0 }, ref) => {
    const isRTL = I18nManager.isRTL;
    const chordSize = Math.round(fontSize * 0.85);

    return (
      <ScrollView
        ref={ref}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {data.map((line, index) => {
          switch (line.type) {
            case 'section':
              return (
                <View key={index} style={styles.sectionWrapper}>
                  <Text style={[styles.section, isRTL && styles.textRTL, { fontSize }]}>
                    {line.content}
                  </Text>
                </View>
              );

            case 'chords':
              return (
                <Text
                  key={index}
                  style={[styles.chords, isRTL && styles.textRTL, { fontSize: chordSize }]}
                >
                  {transposeLine(line.content, semitones)}
                </Text>
              );

            case 'lyrics':
              return (
                <Text key={index} style={[styles.lyrics, isRTL && styles.textRTL, { fontSize }]}>
                  {line.content}
                </Text>
              );

            default:
              return null;
          }
        })}
      </ScrollView>
    );
  },
);

ChordDisplay.displayName = 'ChordDisplay';
export default ChordDisplay;

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionWrapper: {
    marginTop: 20,
    marginBottom: 4,
  },
  section: {
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  chords: {
    fontFamily: 'monospace',
    color: '#1a6ef7',
    fontWeight: '600',
    lineHeight: 20,
  },
  lyrics: {
    color: '#111',
    lineHeight: 24,
    marginBottom: 4,
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
