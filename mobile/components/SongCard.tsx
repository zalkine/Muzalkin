import { I18nManager, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export type Song = {
  id: string;
  title: string;
  artist: string;
  instrument?: string;
  language?: string;
};

type Props = {
  song: Song;
  onPress: (song: Song) => void;
  /** Optional right-side action (e.g. remove from playlist) */
  rightAction?: React.ReactNode;
};

/**
 * Reusable card for displaying a song in search results, playlist view,
 * or My Songs list. Respects RTL layout automatically.
 */
export default function SongCard({ song, onPress, rightAction }: Props) {
  const isRTL = I18nManager.isRTL;

  return (
    <TouchableOpacity
      style={[styles.row, isRTL && styles.rowRTL]}
      onPress={() => onPress(song)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${song.title} — ${song.artist}`}
    >
      {/* Instrument indicator pill */}
      <View style={styles.pill}>
        <Text style={styles.pillText}>
          {song.instrument === 'piano' ? '🎹' : '🎸'}
        </Text>
      </View>

      {/* Text block */}
      <View style={styles.textBlock}>
        <Text style={[styles.title, isRTL && styles.textRTL]} numberOfLines={1}>
          {song.title}
        </Text>
        <Text style={[styles.artist, isRTL && styles.textRTL]} numberOfLines={1}>
          {song.artist}
        </Text>
      </View>

      {/* Right-side slot (optional action or chevron) */}
      {rightAction ?? (
        <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  rowRTL: {
    flexDirection: 'row-reverse',
  },
  pill: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  pillText: {
    fontSize: 18,
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111',
  },
  artist: {
    fontSize: 13,
    color: '#666',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  chevron: {
    fontSize: 20,
    color: '#bbb',
    marginHorizontal: 4,
  },
});
