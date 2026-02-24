import { useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  FlatList,
  I18nManager,
  Keyboard,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';

import { supabase } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
const PRIMARY = '#5B4FE8';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResult = {
  id?: string;
  title: string;
  artist: string;
  source: string;
  from_db: boolean;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  saved:           { label: 'שמור',   color: '#10B981' },
  tab4u:           { label: 'Tab4U',  color: '#F59E0B' },
  negina:          { label: 'Negina', color: '#8B5CF6' },
  nagnu:           { label: 'נגנו',   color: '#06B6D4' },
  ultimate_guitar: { label: 'UG',     color: '#EF4444' },
};

function sourceBadge(source: string) {
  return SOURCE_BADGE[source] ?? { label: source, color: '#6B7280' };
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function searchSavedSongs(query: string): Promise<SearchResult[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('songs')
    .select('id, title, artist')
    .eq('user_id', user.id)
    .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
    .limit(10);

  return (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    artist: s.artist,
    source: 'saved',
    from_db: true,
  }));
}

async function searchWeb(query: string, lang: string): Promise<SearchResult[]> {
  try {
    const params = new URLSearchParams({ q: query, lang });
    const res = await fetch(`${API_URL}/search?${params.toString()}`);
    if (!res.ok) return [];
    const items: Array<{ title: string; artist: string; source: string }> =
      await res.json();
    return items.map((item) => ({
      title:   item.title,
      artist:  item.artist,
      source:  item.source,
      from_db: false,
    }));
  } catch {
    return [];
  }
}

async function searchAll(query: string, lang: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const [saved, web] = await Promise.all([
    searchSavedSongs(q),
    searchWeb(q, lang),
  ]);

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const item of saved) {
    const key = `${item.title}|${item.artist}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); results.push(item); }
  }
  for (const item of web) {
    const key = `${item.title}|${item.artist}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); results.push(item); }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const isRTL = I18nManager.isRTL;
  const lang  = i18n.language === 'he' ? 'he' : 'en';

  const [query,   setQuery]   = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status,  setStatus]  = useState<Status>('idle');
  const inputRef              = useRef<TextInput>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setStatus('loading');
    try {
      const data = await searchAll(query, lang);
      setResults(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [query, lang]);

  const handleSelectResult = useCallback((item: SearchResult) => {
    if (item.from_db && item.id) {
      router.push(`/song/${item.id}`);
    } else {
      router.push(
        `/song/new?title=${encodeURIComponent(item.title)}&artist=${encodeURIComponent(item.artist ?? '')}&lang=${lang}`,
      );
    }
  }, [lang]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.textRTL]}>
          {t('search')}
        </Text>
        <View style={[styles.searchRow, isRTL && styles.searchRowRTL]}>
          <TextInput
            ref={inputRef}
            style={[styles.input, isRTL && styles.inputRTL]}
            placeholder={t('search_placeholder')}
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            textAlign={isRTL ? 'right' : 'left'}
          />
          <TouchableOpacity
            style={[styles.searchBtn, !query.trim() && styles.searchBtnDisabled]}
            onPress={handleSearch}
            disabled={!query.trim()}
          >
            <Text style={styles.searchBtnText}>{t('search')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Body ── */}
      <View style={styles.body}>

        {status === 'idle' && (
          <View style={styles.center}>
            <Text style={styles.hintEmoji}>🎵</Text>
            <Text style={[styles.hint, isRTL && styles.textRTL]}>
              {t('search_hint')}
            </Text>
          </View>
        )}

        {status === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={PRIMARY} />
            <Text style={[styles.loadingText, isRTL && styles.textRTL]}>
              {t('searching_sources')}
            </Text>
          </View>
        )}

        {status === 'error' && (
          <View style={styles.center}>
            <Text style={styles.hintEmoji}>😕</Text>
            <Text style={[styles.errorText, isRTL && styles.textRTL]}>
              {t('error_fetch')}
            </Text>
          </View>
        )}

        {status === 'done' && results.length === 0 && (
          <View style={styles.center}>
            <Text style={styles.hintEmoji}>🔇</Text>
            <Text style={[styles.hint, isRTL && styles.textRTL]}>
              {t('no_results')}
            </Text>
          </View>
        )}

        {status === 'done' && results.length > 0 && (
          <>
            <View style={[styles.countRow, isRTL && styles.countRowRTL]}>
              <Text style={styles.countText}>
                {results.length} {t('results_found')}
              </Text>
            </View>
            <FlatList
              data={results}
              keyExtractor={(item, idx) => item.id ?? `${item.source}-${idx}`}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <ResultItem item={item} isRTL={isRTL} onPress={handleSelectResult} />
              )}
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultItem({
  item,
  isRTL,
  onPress,
}: {
  item: SearchResult;
  isRTL: boolean;
  onPress: (item: SearchResult) => void;
}) {
  const badge = sourceBadge(item.source);

  return (
    <TouchableOpacity
      style={[styles.resultCard, isRTL && styles.resultCardRTL]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.resultIcon}>
        <Text style={styles.resultIconText}>🎵</Text>
      </View>

      <View style={[styles.resultText, isRTL && styles.resultTextRTL]}>
        <Text style={[styles.resultTitle, isRTL && styles.textRTL]} numberOfLines={1}>
          {item.title}
        </Text>
        {!!item.artist && (
          <Text style={[styles.resultArtist, isRTL && styles.textRTL]} numberOfLines={1}>
            {item.artist}
          </Text>
        )}
      </View>

      <View style={[styles.badge, { backgroundColor: badge.color }]}>
        <Text style={styles.badgeText}>{badge.label}</Text>
      </View>

      <Text style={styles.chevron}>{isRTL ? '‹' : '›'}</Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F4F3FF',
  },

  // Header
  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchRowRTL: {
    flexDirection: 'row-reverse',
  },
  input: {
    flex: 1,
    height: 46,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  searchBtn: {
    height: 46,
    paddingHorizontal: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    opacity: 0.5,
  },
  searchBtnText: {
    color: PRIMARY,
    fontWeight: '700',
    fontSize: 15,
  },

  // Body
  body: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  hintEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  hint: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#EF4444',
    textAlign: 'center',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },

  // Count
  countRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  countRowRTL: {
    flexDirection: 'row-reverse',
  },
  countText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  separator: {
    height: 8,
  },

  // Result card
  resultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  resultCardRTL: {
    flexDirection: 'row-reverse',
  },
  resultIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F4F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultIconText: {
    fontSize: 20,
  },
  resultText: {
    flex: 1,
    gap: 3,
  },
  resultTextRTL: {
    alignItems: 'flex-end',
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  resultArtist: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  chevron: {
    fontSize: 18,
    color: '#D1D5DB',
  },
});
