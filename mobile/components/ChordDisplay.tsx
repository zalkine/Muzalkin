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
// Helpers
// ---------------------------------------------------------------------------

/**
 * Group the flat ChordLine array into renderable blocks:
 *   - A "pair" block: a chords line immediately followed by a lyrics line
 *   - A "lyrics-only" block: a lyrics line with no preceding chords line
 *   - A "chords-only" block: a chords line not followed by a lyrics line
 *   - A "section" block: section header
 */
type Block =
  | { kind: 'pair';        chords: string; lyrics: string }
  | { kind: 'chords-only'; chords: string }
  | { kind: 'lyrics-only'; lyrics: string }
  | { kind: 'section';     content: string };

function groupIntoBlocks(data: ChordLine[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < data.length) {
    const line = data[i];
    if (line.type === 'section') {
      blocks.push({ kind: 'section', content: line.content });
      i++;
    } else if (line.type === 'chords') {
      const next = data[i + 1];
      if (next && next.type === 'lyrics') {
        blocks.push({ kind: 'pair', chords: line.content, lyrics: next.content });
        i += 2;
      } else {
        blocks.push({ kind: 'chords-only', chords: line.content });
        i++;
      }
    } else {
      // lyrics with no preceding chords line
      blocks.push({ kind: 'lyrics-only', lyrics: line.content });
      i++;
    }
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BASE_SIZE         = 15;   // single size for BOTH chord and lyric rows
const BASE_SECTION_SIZE = 12;

export default function ChordDisplay({ data, scrollRef, onScroll, fontSize = 1.0 }: Props) {
  const isRTL = I18nManager.isRTL;
  const blocks = groupIntoBlocks(data);
  const size = BASE_SIZE * fontSize;

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
      {blocks.map((block, index) => {
        switch (block.kind) {
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
                    {block.content}
                  </Text>
                </View>
              </View>
            );

          case 'pair':
            return (
              <View key={index} style={styles.pairBlock}>
                {/* Chord row — right-aligned LTR so Tab4U's \xa0 positions align
                    with the RTL lyric below (last char at right edge) */}
                <Text
                  style={[
                    styles.chordsText,
                    { fontSize: size, lineHeight: size * 1.4 },
                    isRTL && styles.chordsTextRTL,
                  ]}
                  selectable
                >
                  {block.chords}
                </Text>
                {/* Lyric row — RTL direction so Hebrew renders right-to-left */}
                <Text
                  style={[
                    styles.lyricsText,
                    { fontSize: size, lineHeight: size * 1.55 },
                    isRTL && styles.textRTL,
                  ]}
                  selectable
                >
                  {block.lyrics}
                </Text>
              </View>
            );

          case 'chords-only':
            return (
              <View key={index} style={styles.pairBlock}>
                <Text
                  style={[
                    styles.chordsText,
                    { fontSize: size, lineHeight: size * 1.4 },
                    isRTL && styles.chordsTextRTL,
                  ]}
                  selectable
                >
                  {block.chords}
                </Text>
              </View>
            );

          case 'lyrics-only':
            return (
              <View key={index} style={styles.lyricsOnlyBlock}>
                <Text
                  style={[
                    styles.lyricsText,
                    { fontSize: size, lineHeight: size * 1.55 },
                    isRTL && styles.textRTL,
                  ]}
                  selectable
                >
                  {block.lyrics}
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

const CHORD_ORANGE = '#e8640c';
const MONO_FONT = 'monospace'; // Courier on iOS, monospace on Android — fixed-width guaranteed

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

  // Paired chord+lyric block
  pairBlock: {
    marginTop: 14,
    marginBottom: 2,
  },

  // Chord row — monospace, orange
  chordsText: {
    fontFamily: MONO_FONT,
    fontWeight: '700',
    color: CHORD_ORANGE,
  },

  // Lyric row — SAME monospace font so &nbsp; widths match the chord row above
  lyricsText: {
    fontFamily: MONO_FONT,
    color: '#111',
  },

  // Standalone lyrics (no paired chord line)
  lyricsOnlyBlock: {
    marginBottom: 2,
  },

  // RTL text alignment (for lyrics — Hebrew characters render right-to-left)
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },

  // RTL chord alignment — Tab4U encodes chord positions using \xa0 spacing
  // designed for right-aligned LTR display: the last char sits at the right
  // edge, so each chord's position-from-right matches its syllable's RTL
  // visual position. writingDirection MUST be 'ltr' (not 'rtl') so the first
  // char is NOT placed at the right edge.
  chordsTextRTL: {
    writingDirection: 'ltr',
    textAlign: 'right',
  },
});
