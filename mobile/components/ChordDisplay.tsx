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

const BASE_CHORD_SIZE   = 14;
const BASE_LYRICS_SIZE  = 17;
const BASE_SECTION_SIZE = 12;

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
                <View style={styles.sectionBadge}>
                  <Text
                    style={[
                      styles.sectionText,
                      { fontSize: BASE_SECTION_SIZE * fontSize },
                      isRTL && styles.textRTL,
                    ]}
                  >
                    {line.content}
                  </Text>
                </View>
              </View>
            );

          case 'chords':
            return (
              <View key={index} style={styles.chordsRow}>
                <Text
                  style={[
                    styles.chordsText,
                    {
                      fontSize: BASE_CHORD_SIZE * fontSize,
                      lineHeight: BASE_CHORD_SIZE * fontSize * 1.4,
                    },
                    isRTL && styles.textRTL,
                  ]}
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
                  style={[
                    styles.lyricsText,
                    {
                      fontSize: BASE_LYRICS_SIZE * fontSize,
                      lineHeight: BASE_LYRICS_SIZE * fontSize * 1.55,
                    },
                    isRTL && styles.textRTL,
                  ]}
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
// Styles — Tab4U-inspired: orange chords, badged section headers
// ---------------------------------------------------------------------------

const CHORD_ORANGE = '#e8640c';

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 0,
  },

  // Section header — orange badge (e.g. "פזמון", "Chorus")
  sectionRow: {
    marginTop: 24,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sectionBadge: {
    borderWidth: 1,
    borderColor: CHORD_ORANGE,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(232,100,12,0.08)',
  },
  sectionText: {
    fontSize: 12,
    fontWeight: '700',
    color: CHORD_ORANGE,
    letterSpacing: 0.4,
  },

  // Chord line — monospace, Tab4U orange, tight above lyrics
  chordsRow: {
    marginTop: 14,
    marginBottom: 1,
  },
  chordsText: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700',
    color: CHORD_ORANGE,
    lineHeight: 20,
  },

  // Lyric line — directly below its chord line
  lyricsRow: {
    marginBottom: 2,
  },
  lyricsText: {
    fontSize: 17,
    color: '#111',
    lineHeight: 26,
  },

  // RTL text alignment
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
});
