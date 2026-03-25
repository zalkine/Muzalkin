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
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChordDisplay({ data, scrollRef, onScroll }: Props) {
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
                <Text style={[styles.sectionText, isRTL && styles.textRTL]}>
                  {line.content}
                </Text>
              </View>
            );

          case 'chords':
            return (
              <View key={index} style={styles.chordsRow}>
                <Text
                  style={[styles.chordsText, isRTL && styles.textRTL]}
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
                  style={[styles.lyricsText, isRTL && styles.textRTL]}
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
