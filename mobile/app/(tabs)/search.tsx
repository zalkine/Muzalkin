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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single search result row shown to the user. */
type SearchResult = {
  /** DB id — only set for results already stored in Supabase. */
  id?: string;
  title: string;
  artist: string;
  /**
   * Where this result came from:
   *   'saved'   – user's own saved song (songs table)
   *   'tab4u'   – found on Tab4U.com
   *   'negina'  – found on negina.co.il
   *   'nagnu'   – found on nagnu.co.il
   *   'ultimate_guitar' – found on ultimate-guitar.com
   */
  source: string;
  /** True when the result is already in Supabase (navigate by id). */
  from_db: boolean;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Source badge config
// ---------------------------------------------------------------------------

const SOURCE_BADGE: Record<string, { label: string; color: string }> = {
  saved:           { label: 'שמור',    color: '#27ae60' },
  tab4u:           { label: 'Tab4U',   color: '#e67e22' },
  negina:          { label: 'Negina',  color: '#8e44ad' },
  nagnu:           { label: 'נגנו',    color: '#16a085' },
  ultimate_guitar: { label: 'UG',      color: '#c0392b' },
};

function sourceBadge(source: string) {
  return SOURCE_BADGE[source] ?? { label: source, color: '#555' };
}

// ---------------------------------------------------------------------------
// Data fetching helpers
// ---------------------------------------------------------------------------

/** Search the user's saved songs in Supabase. */
async function searchSavedSongs(query: string): Promise<SearchResult[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
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

/** Search web sources via the backend /search endpoint. */
async function searchWeb(
  query: string,
  lang: string,
): Promise<SearchResult[]> {
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

/**
 * Full search: saved songs first (fastest, needs no web call),
 * then web sources (Tab4U → Negina → Nagnu).
 * Deduplicates by title+artist.
 */
async function searchAll(
  query: string,
  lang: string,
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // Run both in parallel — saved songs search is fast, web search is slower
  const [saved, web] = await Promise.all([
    searchSavedSongs(q),
    searchWeb(q, lang),
  ]);

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  // Saved songs have priority — they appear first
  for (const item of saved) {
    const key = `${item.title}|${item.artist}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(item);
    }
  }

  // Then web results in source order (tab4u, negina, nagnu)
  for (const item of web) {
    const key = `${item.title}|${item.artist}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(item);
    }
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
      // Already in DB — load directly
      router.push(`/song/${item.id}`);
    } else {
      // Fetch from web via backend chord_router
      router.push(
        `/song/new?title=${encodeURIComponent(item.title)}&artist=${encodeURIComponent(item.artist ?? '')}&lang=${lang}`,
      );
    }
  }, [lang]);

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Search bar ── */}
      <View style={[styles.searchRow, isRTL && styles.searchRowRTL]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, isRTL && styles.inputRTL]}
          placeholder={t('search_placeholder')}
          placeholderTextColor="#aaa"
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

      {/* ── Idle hint ── */}
      {status === 'idle' && (
        <View style={styles.center}>
          <Text style={[styles.hint, isRTL && styles.textRTL]}>
            {t('search_hint')}
          </Text>
        </View>
      )}

      {/* ── Loading ── */}
      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={[styles.loadingText, isRTL && styles.textRTL]}>
            {t('searching_sources')}
          </Text>
        </View>
      )}

      {/* ── Error ── */}
      {status === 'error' && (
        <View style={styles.center}>
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {t('error_fetch')}
          </Text>
        </View>
      )}

      {/* ── Results ── */}
      {status === 'done' && (
        <>
          {results.length === 0 ? (
            <View style={styles.center}>
              <Text style={[styles.hint, isRTL && styles.textRTL]}>
                {t('no_results')}
              </Text>
            </View>
          ) : (
            <>
              {/* Result count */}
              <View style={[styles.countRow, isRTL && styles.countRowRTL]}>
                <Text style={[styles.countText, isRTL && styles.textRTL]}>
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
                  <ResultItem
                    item={item}
                    isRTL={isRTL}
                    onPress={handleSelectResult}
                  />
                )}
              />
            </>
          )}
        </>
      )}
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
      style={[styles.resultRow, isRTL && styles.resultRowRTL]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      {/* Text block */}
      <View style={[styles.resultText, isRTL && styles.resultTextRTL]}>
        <Text
          style={[styles.resultTitle, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        {!!item.artist && (
          <Text
            style={[styles.resultArtist, isRTL && styles.textRTL]}
            numberOfLines={1}
          >
            {item.artist}
          </Text>
        )}
      </View>

      {/* Source badge */}
      <View style={[styles.badge, { backgroundColor: badge.color }]}>
        <Text style={styles.badgeText}>{badge.label}</Text>
      </View>

      {/* Chevron */}
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
    backgroundColor: '#fff',
  },

  // Search bar
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  searchRowRTL: {
    flexDirection: 'row-reverse',
  },
  input: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputRTL: {
    writingDirection: 'rtl',
  },
  searchBtn: {
    height: 44,
    paddingHorizontal: 18,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    backgroundColor: '#aaa',
  },
  searchBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Centered states
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  hint: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#888',
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    color: '#cc3333',
    textAlign: 'center',
  },
  textRTL: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },

  // Result count row
  countRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#f5f5f5',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  countRowRTL: {
    flexDirection: 'row-reverse',
  },
  countText: {
    fontSize: 12,
    color: '#999',
  },

  // Results list
  list: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e8e8e8',
    marginHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 10,
  },
  resultRowRTL: {
    flexDirection: 'row-reverse',
  },
  resultText: {
    flex: 1,
    gap: 3,
  },
  resultTextRTL: {
    alignItems: 'flex-end',
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
  },
  resultArtist: {
    fontSize: 13,
    color: '#666',
  },

  // Source badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.3,
  },

  chevron: {
    fontSize: 18,
    color: '#bbb',
  },
});
