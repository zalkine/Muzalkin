/**
 * jamContext.tsx  —  שירה בציבור / Jam Session
 *
 * Manages a real-time jam session using Supabase Realtime.
 *
 * Architecture:
 *   - Each session has a 6-char code (e.g. "ABC123") stored in the
 *     `jam_sessions` Supabase table for persistence.
 *   - All live events (song changes, scroll position) travel through a
 *     Supabase Realtime Broadcast channel named "jam:<code>".
 *   - Presence is used to count and display connected participants.
 *
 * Roles:
 *   host   → created the session; can change songs, end session.
 *   viewer → joined via code; follows host's song & scroll.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JamRole = 'host' | 'viewer' | null;

export type SongRef = {
  songId: string;
  source: 'cached' | 'saved';
  title:  string;
  artist: string;
};

type JamBroadcastEvent =
  | { type: 'song_change';  payload: SongRef }
  | { type: 'scroll_sync';  payload: { position: number } }
  | { type: 'session_end';  payload: Record<string, never> };

export type JamContextValue = {
  role:             JamRole;
  sessionCode:      string | null;
  participantCount: number;
  isConnected:      boolean;

  /** Host: create a new session and navigate to the first song. */
  startSession: (song: SongRef) => Promise<string | null>;
  /** Viewer: join an existing session by code. Returns the current song if found. */
  joinSession:  (code: string) => Promise<SongRef | null>;
  /** Host: end the session for everyone. */
  endSession:   () => Promise<void>;
  /** Viewer: leave without ending the session. */
  leaveSession: () => void;

  /** Host: broadcast a song change to all viewers. */
  broadcastSongChange: (song: SongRef) => void;
  /** Host: broadcast current scroll position (~2 fps). */
  broadcastScroll:     (position: number) => void;

  /** Subscribe to song-change events (viewer). Returns an unsubscribe fn. */
  onSongChange: (handler: (song: SongRef) => void) => () => void;
  /** Subscribe to scroll-sync events (viewer). Returns an unsubscribe fn. */
  onScrollSync: (handler: (position: number) => void) => () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  return Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const JamContext = createContext<JamContextValue | null>(null);

export function useJam(): JamContextValue {
  const ctx = useContext(JamContext);
  if (!ctx) throw new Error('useJam must be used inside JamProvider');
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function JamProvider({ children }: { children: React.ReactNode }) {
  const [role,             setRole]             = useState<JamRole>(null);
  const [sessionCode,      setSessionCode]      = useState<string | null>(null);
  const [participantCount, setParticipantCount] = useState(0);
  const [isConnected,      setIsConnected]      = useState(false);

  const channelRef           = useRef<RealtimeChannel | null>(null);
  const songChangeHandlers   = useRef<Set<(song: SongRef) => void>>(new Set());
  const scrollSyncHandlers   = useRef<Set<(pos: number) => void>>(new Set());
  // Throttle scroll broadcast to ~2 fps
  const lastScrollBroadcast  = useRef(0);

  // ------------------------------------------------------------------
  // Internal: create/join a Realtime channel for a given code
  // ------------------------------------------------------------------
  const joinChannel = useCallback((code: string, asRole: 'host' | 'viewer') => {
    // Clean up any previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`jam:${code}`, {
      config: { presence: { key: asRole === 'host' ? 'host' : undefined } },
    });

    // Presence: count connected participants
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const count = Object.values(state).flat().length;
      setParticipantCount(count);
    });

    // Broadcast: receive events from host
    channel.on('broadcast', { event: 'song_change' }, ({ payload }: { payload: SongRef }) => {
      songChangeHandlers.current.forEach(h => h(payload));
    });

    channel.on('broadcast', { event: 'scroll_sync' }, ({ payload }: { payload: { position: number } }) => {
      scrollSyncHandlers.current.forEach(h => h(payload.position));
    });

    channel.on('broadcast', { event: 'session_end' }, () => {
      // Host ended the session — clean up viewer state
      setRole(null);
      setSessionCode(null);
      setIsConnected(false);
      setParticipantCount(0);
      supabase.removeChannel(channel);
      channelRef.current = null;
      // Notify song-change listeners with a sentinel so SongDetailPage can go back
      songChangeHandlers.current.forEach(h =>
        h({ songId: '', source: 'cached', title: '', artist: '' }),
      );
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: asRole });
        setIsConnected(true);
      }
    });

    channelRef.current = channel;
  }, []);

  // ------------------------------------------------------------------
  // startSession (host)
  // ------------------------------------------------------------------
  const startSession = useCallback(async (song: SongRef): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Try up to 5 times to get a unique code (collision extremely unlikely)
    let code = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const { error } = await supabase.from('jam_sessions').insert({
        code,
        host_user_id:        user.id,
        current_song_id:     song.songId,
        current_song_source: song.source,
        is_active:           true,
      });
      if (!error) break;
      code = '';
    }
    if (!code) return null;

    joinChannel(code, 'host');
    setRole('host');
    setSessionCode(code);
    return code;
  }, [joinChannel]);

  // ------------------------------------------------------------------
  // joinSession (viewer)
  // ------------------------------------------------------------------
  const joinSession = useCallback(async (code: string): Promise<SongRef | null> => {
    const upper = code.toUpperCase().trim();
    const { data, error } = await supabase
      .from('jam_sessions')
      .select('id, current_song_id, current_song_source, is_active')
      .eq('code', upper)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;

    joinChannel(upper, 'viewer');
    setRole('viewer');
    setSessionCode(upper);

    // Return the current song so the caller can navigate to it
    if (data.current_song_id) {
      return {
        songId: data.current_song_id,
        source: data.current_song_source as 'cached' | 'saved',
        title:  '',
        artist: '',
      };
    }
    return null;
  }, [joinChannel]);

  // ------------------------------------------------------------------
  // endSession (host)
  // ------------------------------------------------------------------
  const endSession = useCallback(async () => {
    if (!sessionCode || !channelRef.current) return;

    // Broadcast end event to all viewers
    await channelRef.current.send({
      type:    'broadcast',
      event:   'session_end',
      payload: {},
    });

    // Mark session as inactive in DB
    await supabase
      .from('jam_sessions')
      .update({ is_active: false })
      .eq('code', sessionCode);

    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setRole(null);
    setSessionCode(null);
    setIsConnected(false);
    setParticipantCount(0);
  }, [sessionCode]);

  // ------------------------------------------------------------------
  // leaveSession (viewer)
  // ------------------------------------------------------------------
  const leaveSession = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    setRole(null);
    setSessionCode(null);
    setIsConnected(false);
    setParticipantCount(0);
  }, []);

  // ------------------------------------------------------------------
  // Broadcast helpers (host only)
  // ------------------------------------------------------------------
  const broadcastSongChange = useCallback((song: SongRef) => {
    if (!channelRef.current || role !== 'host') return;

    channelRef.current.send({
      type:    'broadcast',
      event:   'song_change',
      payload: song,
    }).catch((err: unknown) => console.error('[jam] broadcastSongChange failed:', err));

    // Also persist current song to DB
    if (sessionCode) {
      supabase.from('jam_sessions').update({
        current_song_id:     song.songId,
        current_song_source: song.source,
      }).eq('code', sessionCode)
        .then(({ error }) => { if (error) console.error('[jam] DB update failed:', error.message); });
    }
  }, [role, sessionCode]);

  const broadcastScroll = useCallback((position: number) => {
    if (!channelRef.current || role !== 'host') return;
    const now = Date.now();
    if (now - lastScrollBroadcast.current < 500) return; // max 2fps
    lastScrollBroadcast.current = now;
    channelRef.current.send({
      type:    'broadcast',
      event:   'scroll_sync',
      payload: { position },
    });
  }, [role]);

  // ------------------------------------------------------------------
  // Subscription helpers
  // ------------------------------------------------------------------
  const onSongChange = useCallback((handler: (song: SongRef) => void) => {
    songChangeHandlers.current.add(handler);
    return () => { songChangeHandlers.current.delete(handler); };
  }, []);

  const onScrollSync = useCallback((handler: (pos: number) => void) => {
    scrollSyncHandlers.current.add(handler);
    return () => { scrollSyncHandlers.current.delete(handler); };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []);

  const value: JamContextValue = {
    role,
    sessionCode,
    participantCount,
    isConnected,
    startSession,
    joinSession,
    endSession,
    leaveSession,
    broadcastSongChange,
    broadcastScroll,
    onSongChange,
    onScrollSync,
  };

  return <JamContext.Provider value={value}>{children}</JamContext.Provider>;
}
