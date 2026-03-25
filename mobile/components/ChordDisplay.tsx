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
  /** Forwarded to the inner ScrollView for external scroll control (auto-scroll) */
  scrollRef?: React.RefObject<ScrollView>;
  /** Called with the current Y offset whenever the user scrolls manually */
  onScroll?: (y: number) => void;
  /** Font size multiplier — default 1.0 */
  fontSize?: number;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BASE_CHORD_SIZE  = 14;
const BASE_LYRICS_SIZE = 16;
const BASE_SECTION_SIZE = 13;

export default function ChordDisplay({ data, scrollRef, onScroll, fontSize = 1.0 }: Props) {
  const isRTL = I18nManager.isRTL;

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={
        onScroll
          ? (e) => onScroll(e.nativeEvent.contentOffset.y)
          : undefined
      }
    >
      {data.map((line, index) => {
        switch (line.type) {
          case 'section':
            return (
              <View key={index} style={styles.sectionRow}>
                <Text style={[styles.sectionText, { fontSize: BASE_SECTION_SIZE * fontSize }, isRTL && styles.textRTL]}>
                  {line.content}
                </Text>
              </View>
            );

          case 'chords':
            return (
              <View key={index} style={styles.chordsRow}>
                <Text
                  style={[styles.chordsText, { fontSize: BASE_CHORD_SIZE * fontSize, lineHeight: BASE_CHORD_SIZE * fontSize * 1.45 }, isRTL && styles.textRTL]}
                  selectable
                >
                  {line.content}
                </Text>
              </View>
            );

          case 'lyrics':
            return (
              <View key={index} style={styles.lyricsRow}>
                <Text
                  style={[styles.lyricsText, { fontSize: BASE_LYRICS_SIZE * fontSize, lineHeight: BASE_LYRICS_SIZE * fontSize * 1.5 }, isRTL && styles.textRTL]}
                  selectable
                >
                  {line.content}
                </Text>
              </View>
            );

          default:
            return null;
        }
      })}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 0,
  },

  // Section header (e.g. "פזמון", "Chorus")
  sectionRow: {
    marginTop: 20,
    marginBottom: 4,
  },
  sectionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  // Chord line — monospace, blue
  chordsRow: {
    marginTop: 10,
  },
  chordsText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: '#1a6fd4',
    lineHeight: 20,
  },

  // Lyric line — directly below its chord line
  lyricsRow: {
    marginBottom: 2,
  },
  lyricsText: {
    fontSize: 16,
    color: '#111',
    lineHeight: 24,
  },

  // RTL text alignment
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
