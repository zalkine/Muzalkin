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
import i18next from 'i18next';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SearchResult = {
  id: string;
  title: string;
  artist: string;
};

type Status = 'idle' | 'loading' | 'done' | 'error';

// ---------------------------------------------------------------------------
// Real search — calls backend (cache-first, scrapes if needed)
// ---------------------------------------------------------------------------

async function fetchSearchResults(query: string): Promise<SearchResult[]> {
  const lang = i18next.language === 'he' ? 'he' : 'en';
  const backendUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3001';
  const url = `${backendUrl}/api/chords/search?q=${encodeURIComponent(query.trim())}&lang=${lang}`;

  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Backend error ${resp.status}`);

  const data: Array<{ id: string; song_title: string; artist: string }> = await resp.json();
  return data.map((r) => ({ id: r.id, title: r.song_title, artist: r.artist }));
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const { t } = useTranslation();
  const isRTL = I18nManager.isRTL;

  const [query, setQuery]     = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus]   = useState<Status>('idle');
  const inputRef              = useRef<TextInput>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    Keyboard.dismiss();
    setStatus('loading');
    try {
      const data = await fetchSearchResults(query);
      setResults(data);
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }, [query]);

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

      {status === 'done' && results.length === 0 && (
        <View style={styles.center}>
          <Text style={[styles.hint, isRTL && styles.textRTL]}>
            {t('no_results')}
          </Text>
        </View>
      )}

      {status === 'done' && results.length > 0 && (
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
});
