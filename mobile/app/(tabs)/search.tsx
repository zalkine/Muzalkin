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
// Types
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  title: string;
  artist: string;
  source?: string;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Search against Supabase cached_chords + user's saved songs
// ---------------------------------------------------------------------------

async function searchSongs(query: string): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  // 1. Search cached_chords
  const { data: cached } = await supabase
    .from('cached_chords')
    .select('id, song_title, artist, source')
    .or(`song_title.ilike.%${q}%,artist.ilike.%${q}%`)
    .limit(20);

  // 2. Search user's saved songs (if authenticated)
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let saved: Array<{ id: string; title: string; artist: string }> = [];
  if (user) {
    const { data } = await supabase
      .from('songs')
      .select('id, title, artist')
      .eq('user_id', user.id)
      .or(`title.ilike.%${q}%,artist.ilike.%${q}%`)
      .limit(10);
    saved = (data ?? []) as typeof saved;
  }

  // Merge: saved songs first (preferred), then cache — dedup by title+artist
  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const s of saved) {
    const key = `${s.title}|${s.artist}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ id: s.id, title: s.title, artist: s.artist, source: 'saved' });
    }
  }

  for (const c of cached ?? []) {
    const key = `${c.song_title}|${c.artist}`.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      results.push({ id: c.id, title: c.song_title, artist: c.artist, source: c.source });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [query, setQuery]                 = useState('');
  const [results, setResults]             = useState<SearchResult[]>([]);
  const [status, setStatus]               = useState<Status>('idle');
  const [showFetchForm, setShowFetchForm] = useState(false);
  const [fetchArtist, setFetchArtist]     = useState('');
  const inputRef                          = useRef<TextInput>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setStatus('loading');
    setShowFetchForm(false);
    try {
      const data = await searchSongs(query);
      setResults(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [query]);

  const handleFetchFromWeb = useCallback(() => {
    if (!query.trim() || !fetchArtist.trim()) return;
    Keyboard.dismiss();
    const lang = isRTL ? 'he' : 'en';
    router.push(
      `/song/new?title=${encodeURIComponent(query.trim())}&artist=${encodeURIComponent(fetchArtist.trim())}&lang=${lang}`,
    );
  }, [query, fetchArtist, isRTL]);

  return (
    <SafeAreaView style={[styles.safe, isRTL && styles.safeRTL]}>

      {/* ── Search bar ── */}
      <View style={styles.searchRow}>
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

      {/* ── Content area ── */}
      {status === 'idle' && (
        <View style={styles.center}>
          <Text style={[styles.hint, isRTL && styles.textRTL]}>
            {t('search_hint')}
          </Text>
        </View>
      )}

      {status === 'loading' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4285F4" />
          <Text style={styles.loadingText}>{t('loading')}</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={styles.center}>
          <Text style={[styles.errorText, isRTL && styles.textRTL]}>
            {t('error_fetch')}
          </Text>
        </View>
      )}

      {status === 'done' && (
        <>
          {results.length === 0 && (
            <View style={styles.noResultsContainer}>
              <Text style={[styles.hint, isRTL && styles.textRTL]}>
                {t('no_results')}
              </Text>
            </View>
          )}

          {results.length > 0 && (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              renderItem={({ item }) => (
                <ResultItem item={item} isRTL={isRTL} />
              )}
            />
          )}

          {/* ── Fetch from web ── */}
          {!showFetchForm ? (
            <TouchableOpacity
              style={[styles.fetchRow, isRTL && styles.fetchRowRTL]}
              onPress={() => setShowFetchForm(true)}
            >
              <Text style={[styles.fetchRowText, isRTL && styles.textRTL]}>
                {t('fetch_from_web')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.fetchForm, isRTL && styles.fetchFormRTL]}>
              <TextInput
                style={[styles.fetchInput, isRTL && styles.inputRTL]}
                placeholder={t('artist_placeholder')}
                placeholderTextColor="#aaa"
                value={fetchArtist}
                onChangeText={setFetchArtist}
                autoCapitalize="none"
                autoCorrect={false}
                textAlign={isRTL ? 'right' : 'left'}
                autoFocus
              />
              <TouchableOpacity
                style={[styles.fetchBtn, !fetchArtist.trim() && styles.searchBtnDisabled]}
                onPress={handleFetchFromWeb}
                disabled={!fetchArtist.trim()}
              >
                <Text style={styles.searchBtnText}>{t('fetch')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Result row
// ---------------------------------------------------------------------------

function ResultItem({ item, isRTL }: { item: SearchResult; isRTL: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.resultRow, isRTL && styles.resultRowRTL]}
      onPress={() => router.push(`/song/${item.id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.resultText}>
        <Text
          style={[styles.resultTitle, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {item.title}
        </Text>
        <Text
          style={[styles.resultArtist, isRTL && styles.textRTL]}
          numberOfLines={1}
        >
          {item.artist}
        </Text>
      </View>
      {/* Chevron flips direction for RTL */}
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
  safeRTL: {
    direction: 'rtl',
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
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
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

  // Results list
  list: {
    paddingVertical: 4,
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 16,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  resultRowRTL: {
    flexDirection: 'row-reverse',
  },
  resultText: {
    flex: 1,
    gap: 3,
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
  chevron: {
    fontSize: 20,
    color: '#bbb',
    marginHorizontal: 4,
  },

  // Fetch from web
  fetchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
    alignItems: 'center',
  },
  fetchRowRTL: {
    flexDirection: 'row-reverse',
  },
  fetchRowText: {
    fontSize: 14,
    color: '#4285F4',
    fontWeight: '500',
  },
  fetchForm: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  fetchFormRTL: {
    flexDirection: 'row-reverse',
  },
  fetchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#f9f9f9',
  },
  fetchBtn: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#4285F4',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
