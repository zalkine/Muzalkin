/**
 * jamContext.tsx  —  שירה בציבור / Jam Session
 *
 * Manages a real-time jam session using Supabase Realtime.
 *
 * Roles:
 *   jamaneger → created the session or is the first to join;
 *               controls queue, transpose, scroll speed, can kick/promote.
 *   jamember  → joined after the first two; follows the jamaneger's state,
 *               can add songs to the queue.
 *
 * Manager rule: first two users (creator + first joiner) become jamanegers,
 * enforced atomically by the join_jam_session() DB function.
 * Jamanegers can also promote any jamember to jamaneger at any time.
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

export type JamRole = 'jamaneger' | 'jamember' | null;

export type SongRef = {
  songId: string;
  source: 'cached' | 'saved';
  title:  string;
  artist: string;
};

export type QueueItem = {
  id:       string;
  songId:   string;
  source:   'cached' | 'saved';
  title:    string;
  artist:   string;
  position: number;
  addedBy:  string | null;
};

export type JamMember = {
  userId:      string;   // auth user_id for logged-in users, guest_token for guests
  displayName: string;
  role:        'jamaneger' | 'jamember';
  isGuest:     boolean;
};

export type JamContextValue = {
  role:               JamRole;
  isLead:             boolean;   // true only for the session creator (host)
  sessionCode:        string | null;
  sessionId:          string | null;
  participantCount:   number;
  isConnected:        boolean;
  members:            JamMember[];
  queue:              QueueItem[];
  currentQueueItemId: string | null;
  semitones:          number;
  speedIndex:         number;

  /** Jamaneger: create a new session. Returns the 6-char code. */
  startSession:    (song: SongRef) => Promise<string | null>;
  /** Anyone: join an existing session by code. Returns the current song if found. */
  joinSession:     (code: string, nickname?: string, preferredRole?: 'jamaneger' | 'jamember') => Promise<SongRef | null>;
  /** Jamaneger: end the session for everyone. */
  endSession:      () => Promise<void>;
  /** Jamember: leave without ending the session. */
  leaveSession:    () => void;

  /** Jamaneger: broadcast a song change to all. */
  broadcastSongChange: (song: SongRef) => void;
  /** Jamaneger: broadcast scroll position (~2 fps throttle). */
  broadcastScroll:     (position: number) => void;
  /** Jamaneger: broadcast transpose change. */
  broadcastTranspose:  (semitones: number) => void;
  /** Jamaneger: broadcast scroll-speed index change. */
  broadcastSpeed:      (speedIndex: number) => void;

  /** Subscribe to song-change events. Returns unsubscribe fn. */
  onSongChange: (handler: (song: SongRef) => void) => () => void;
  /** Subscribe to scroll-sync events. Returns unsubscribe fn. */
  onScrollSync: (handler: (pos: number) => void) => () => void;

  /** Anyone: add a song to the queue. Broadcasts queue_update to all. */
  addToQueue:      (song: SongRef) => Promise<void>;
  /** Jamaneger: remove a song from the queue. */
  removeFromQueue: (queueItemId: string) => Promise<void>;
  /** Jamaneger: reorder queue by providing ordered item IDs. */
  reorderQueue:    (orderedIds: string[]) => Promise<void>;
  /** Jamaneger: set a queue item as the current song. */
  selectSong:      (queueItemId: string) => void;
  /** Jamaneger: advance to next song in queue. */
  playNext:        () => void;

  /** Jamaneger: remove a member from the session. */
  kickMember:      (userId: string) => Promise<void>;
  /** Jamaneger: promote a jamember to jamaneger. */
  promoteMember:   (userId: string) => Promise<void>;
  /** Non-lead jamanager: take screen control from the current lead. */
  takeLead:        () => Promise<void>;
  /** Anyone: add multiple songs to the queue in one batch. */
  addManyToQueue:  (songs: SongRef[]) => Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

function generateCode(): string {
  return Array.from({ length: 6 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)],
  ).join('');
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
  const [role,               setRole]               = useState<JamRole>(null);
  const [isLead,             setIsLead]             = useState(false);
  const [sessionCode,        setSessionCode]        = useState<string | null>(null);
  const [sessionId,          setSessionId]          = useState<string | null>(null);
  const [participantCount,   setParticipantCount]   = useState(0);
  const [isConnected,        setIsConnected]        = useState(false);
  const [members,            setMembers]            = useState<JamMember[]>([]);
  const [queue,              setQueue]              = useState<QueueItem[]>([]);
  const [currentQueueItemId, setCurrentQueueItemId] = useState<string | null>(null);
  const [semitones,          setSemitones]          = useState(0);
  const [speedIndex,         setSpeedIndex]         = useState(1);

  const channelRef          = useRef<RealtimeChannel | null>(null);
  const sessionIdRef        = useRef<string | null>(null);
  const roleRef             = useRef<JamRole>(null);
  const currentUserIdRef    = useRef<string | null>(null);
  const guestTokenRef       = useRef<string | null>(null);
  const isGuestRef          = useRef<boolean>(false);
  const isLeadRef           = useRef<boolean>(false);
  const songChangeHandlers  = useRef<Set<(song: SongRef) => void>>(new Set());
  const scrollSyncHandlers  = useRef<Set<(pos: number) => void>>(new Set());
  const lastScrollBroadcast = useRef(0);

  // Keep refs in sync so callbacks always see current values without stale closures
  useEffect(() => { roleRef.current    = role; },   [role]);
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  useEffect(() => { isLeadRef.current  = isLead; }, [isLead]);

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  const dbRowsToQueueItems = (rows: Record<string, unknown>[]): QueueItem[] =>
    rows.map(r => ({
      id:       r.id as string,
      songId:   r.song_id as string,
      source:   r.source as 'cached' | 'saved',
      title:    r.title as string,
      artist:   r.artist as string,
      position: r.position as number,
      addedBy:  r.added_by as string | null,
    }));

  const broadcastQueueUpdate = useCallback((updatedQueue: QueueItem[]) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'queue_update',
      payload: { queue: updatedQueue },
    });
  }, []);

  const broadcastMemberList = useCallback((updatedMembers: JamMember[]) => {
    channelRef.current?.send({
      type: 'broadcast', event: 'member_list',
      payload: { members: updatedMembers },
    });
  }, []);

  // ---------------------------------------------------------------------------
  // joinChannel — internal; creates/reuses the Supabase Realtime channel
  // ---------------------------------------------------------------------------
  const joinChannel = useCallback((
    code: string,
    asRole: 'jamaneger' | 'jamember',
    userId: string,
    displayName: string,
  ) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`jam:${code}`, {
      config: { presence: { key: userId } },
    });

    // Presence: count connected users
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setParticipantCount(Object.values(state).flat().length);
    });

    // ── Broadcast listeners ────────────────────────────────────────────────

    channel.on('broadcast', { event: 'song_change' }, ({ payload }: { payload: SongRef }) => {
      songChangeHandlers.current.forEach(h => h(payload));
    });

    channel.on('broadcast', { event: 'scroll_sync' }, ({ payload }: { payload: { position: number } }) => {
      scrollSyncHandlers.current.forEach(h => h(payload.position));
    });

    channel.on('broadcast', { event: 'session_end' }, () => {
      setRole(null); setSessionCode(null); setSessionId(null);
      setIsConnected(false); setParticipantCount(0);
      setMembers([]); setQueue([]); setCurrentQueueItemId(null);
      supabase.removeChannel(channel);
      channelRef.current = null;
      // Empty songId signals SongDetailPage to navigate back
      songChangeHandlers.current.forEach(h =>
        h({ songId: '', source: 'cached', title: '', artist: '' }),
      );
    });

    channel.on('broadcast', { event: 'transpose_change' }, ({ payload }: { payload: { semitones: number } }) => {
      setSemitones(payload.semitones);
    });

    channel.on('broadcast', { event: 'speed_change' }, ({ payload }: { payload: { speedIndex: number } }) => {
      setSpeedIndex(payload.speedIndex);
    });

    channel.on('broadcast', { event: 'queue_update' }, ({ payload }: { payload: { queue: QueueItem[] } }) => {
      setQueue(payload.queue);
    });

    channel.on('broadcast', { event: 'song_selected' }, ({ payload }: { payload: { queueItemId: string } & SongRef }) => {
      setCurrentQueueItemId(payload.queueItemId);
      songChangeHandlers.current.forEach(h => h(payload));
    });

    channel.on('broadcast', { event: 'member_list' }, ({ payload }: { payload: { members: JamMember[] } }) => {
      setMembers(payload.members);
    });

    channel.on('broadcast', { event: 'role_change' }, ({ payload }: { payload: { userId: string; role: 'jamaneger' | 'jamember' } }) => {
      if (payload.userId === currentUserIdRef.current) {
        setRole(payload.role);
        roleRef.current = payload.role;
      }
      setMembers(prev => prev.map(m =>
        m.userId === payload.userId ? { ...m, role: payload.role } : m,
      ));
    });

    channel.on('broadcast', { event: 'lead_change' }, ({ payload }: { payload: { userId: string } }) => {
      const iAmLead = payload.userId === currentUserIdRef.current;
      isLeadRef.current = iAmLead;
      setIsLead(iAmLead);
    });

    channel.on('broadcast', { event: 'remove_participant' }, ({ payload }: { payload: { userId: string } }) => {
      if (payload.userId === currentUserIdRef.current) {
        // This user was kicked — clean up
        setRole(null); setSessionCode(null); setSessionId(null);
        setIsConnected(false); setParticipantCount(0);
        setMembers([]); setQueue([]); setCurrentQueueItemId(null);
        supabase.removeChannel(channel);
        channelRef.current = null;
        // Signal SongDetailPage to navigate back
        songChangeHandlers.current.forEach(h =>
          h({ songId: '', source: 'cached', title: '', artist: '' }),
        );
      } else {
        setMembers(prev => prev.filter(m => m.userId !== payload.userId));
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId, role: asRole, displayName });
        setIsConnected(true);
      }
    });

    channelRef.current = channel;
  }, []);

  // ---------------------------------------------------------------------------
  // startSession (jamaneger — creator)
  // ---------------------------------------------------------------------------
  const startSession = useCallback(async (song: SongRef): Promise<string | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    currentUserIdRef.current = user.id;

    const displayName = user.user_metadata?.full_name ?? user.email ?? 'Jamaneger';

    let code = '';
    let newSessionId = '';
    for (let attempt = 0; attempt < 5; attempt++) {
      code = generateCode();
      const { data, error } = await supabase.from('jam_sessions').insert({
        code,
        host_user_id:        user.id,
        lead_user_id:        user.id,
        current_song_id:     song.songId,
        current_song_source: song.source,
        is_active:           true,
        current_transpose:   0,
        current_speed_index: 1,
      }).select('id').single();
      if (!error && data) { newSessionId = data.id; break; }
      code = '';
    }
    if (!code || !newSessionId) return null;

    // Register creator as first jamaneger via DB function
    await supabase.rpc('join_jam_session', {
      p_session_id:   newSessionId,
      p_user_id:      user.id,
      p_display_name: displayName,
    });

    // Seed queue with the opening song
    const { data: queueRow } = await supabase.from('jam_queue').insert({
      session_id: newSessionId,
      song_id:    song.songId,
      source:     song.source,
      title:      song.title,
      artist:     song.artist,
      position:   0,
      added_by:   user.id,
    }).select('*').single();

    const initialQueue = queueRow ? dbRowsToQueueItems([queueRow]) : [];

    isGuestRef.current  = false;
    isLeadRef.current   = true;
    joinChannel(code, 'jamaneger', user.id, displayName);
    setRole('jamaneger');
    setIsLead(true);
    setSessionCode(code);
    setSessionId(newSessionId);
    setQueue(initialQueue);
    setCurrentQueueItemId(queueRow?.id ?? null);
    setSemitones(0);
    setSpeedIndex(1);
    setMembers([{ userId: user.id, displayName, role: 'jamaneger', isGuest: false }]);

    return code;
  }, [joinChannel]);

  // ---------------------------------------------------------------------------
  // joinSession (anyone joining by code — logged-in or guest)
  // ---------------------------------------------------------------------------
  const joinSession = useCallback(async (
    code: string,
    nickname?: string,
    preferredRole: 'jamaneger' | 'jamember' = 'jamember',
  ): Promise<SongRef | null> => {
    const upper = code.toUpperCase().trim();

    const { data: session, error } = await supabase
      .from('jam_sessions')
      .select('id, host_user_id, lead_user_id, current_song_id, current_song_source, current_transpose, current_speed_index')
      .eq('code', upper)
      .eq('is_active', true)
      .single();

    if (error || !session) return null;

    const { data: { user } } = await supabase.auth.getUser();

    let resolvedUserId:    string;
    let resolvedRole:      'jamaneger' | 'jamember';
    let resolvedName:      string;
    let isGuest:           boolean;
    let resolvedIsLead:    boolean;

    if (user) {
      // ── Logged-in path ──────────────────────────────────────────────────
      isGuest = false;
      resolvedUserId  = user.id;
      resolvedName    = nickname ?? (user.user_metadata?.full_name ?? user.email ?? 'Jamember');
      // lead_user_id takes precedence; falls back to host_user_id for older sessions
      const effectiveLead = session.lead_user_id ?? session.host_user_id;
      resolvedIsLead  = user.id === effectiveLead;

      const { data: assignedRole } = await supabase.rpc('join_jam_session', {
        p_session_id:     session.id,
        p_user_id:        user.id,
        p_display_name:   resolvedName,
        p_preferred_role: resolvedIsLead ? 'jamaneger' : preferredRole,
      }) as { data: 'jamaneger' | 'jamember' | null };

      resolvedRole = assignedRole ?? 'jamember';
    } else {
      // ── Guest path ───────────────────────────────────────────────────────
      isGuest = true;
      let guestToken = localStorage.getItem('muzalkin_guest_token');
      if (!guestToken) {
        guestToken = crypto.randomUUID();
        localStorage.setItem('muzalkin_guest_token', guestToken);
      }
      resolvedUserId = guestToken;
      resolvedName   = nickname ?? 'Guest';
      resolvedRole   = 'jamember';
      resolvedIsLead = false;

      await supabase.rpc('join_jam_session_guest', {
        p_session_id:   session.id,
        p_guest_token:  guestToken,
        p_display_name: resolvedName,
      });

      guestTokenRef.current = guestToken;
    }

    currentUserIdRef.current = resolvedUserId;
    isGuestRef.current       = isGuest;
    isLeadRef.current        = resolvedIsLead;

    // Fetch current queue
    const { data: queueRows } = await supabase
      .from('jam_queue')
      .select('*')
      .eq('session_id', session.id)
      .order('position', { ascending: true });

    // Fetch current member list (includes guest_token for guest rows)
    const { data: memberRows } = await supabase
      .from('jam_members')
      .select('user_id, guest_token, display_name, role')
      .eq('session_id', session.id);

    const currentQueue = dbRowsToQueueItems(queueRows ?? []);
    const currentMembers: JamMember[] = (memberRows ?? []).map(m => ({
      userId:      (m.user_id ?? m.guest_token) as string,
      displayName: m.display_name as string,
      role:        m.role as 'jamaneger' | 'jamember',
      isGuest:     !m.user_id,
    }));

    joinChannel(upper, resolvedRole, resolvedUserId, resolvedName);
    setRole(resolvedRole);
    setIsLead(resolvedIsLead);
    setSessionCode(upper);
    setSessionId(session.id);
    setQueue(currentQueue);
    setMembers(currentMembers);
    setSemitones(session.current_transpose ?? 0);
    setSpeedIndex(session.current_speed_index ?? 1);

    const currentItem = currentQueue.find(q => q.songId === session.current_song_id);
    setCurrentQueueItemId(currentItem?.id ?? null);

    if (session.current_song_id) {
      return {
        songId: session.current_song_id,
        source: session.current_song_source as 'cached' | 'saved',
        title:  '',
        artist: '',
      };
    }
    return null;
  }, [joinChannel]);

  // ---------------------------------------------------------------------------
  // endSession (jamaneger)
  // ---------------------------------------------------------------------------
  const endSession = useCallback(async () => {
    if (!sessionCode || !channelRef.current) return;

    await channelRef.current.send({
      type: 'broadcast', event: 'session_end', payload: {},
    });

    await supabase
      .from('jam_sessions')
      .update({ is_active: false })
      .eq('code', sessionCode);

    supabase.removeChannel(channelRef.current);
    channelRef.current = null;
    setRole(null); setIsLead(false); setSessionCode(null); setSessionId(null);
    setIsConnected(false); setParticipantCount(0);
    setMembers([]); setQueue([]); setCurrentQueueItemId(null);
  }, [sessionCode]);

  // ---------------------------------------------------------------------------
  // leaveSession (jamember)
  // ---------------------------------------------------------------------------
  const leaveSession = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (sessionIdRef.current) {
      if (isGuestRef.current && guestTokenRef.current) {
        supabase.rpc('leave_jam_guest', {
          p_session_id:  sessionIdRef.current,
          p_guest_token: guestTokenRef.current,
        }).then(() => {});
      } else if (currentUserIdRef.current) {
        supabase.from('jam_members')
          .delete()
          .eq('session_id', sessionIdRef.current)
          .eq('user_id', currentUserIdRef.current)
          .then(() => {});
      }
    }
    guestTokenRef.current = null;
    isGuestRef.current    = false;
    isLeadRef.current     = false;
    setRole(null); setIsLead(false); setSessionCode(null); setSessionId(null);
    setIsConnected(false); setParticipantCount(0);
    setMembers([]); setQueue([]); setCurrentQueueItemId(null);
  }, []);

  // ---------------------------------------------------------------------------
  // Broadcast helpers
  // ---------------------------------------------------------------------------

  const broadcastSongChange = useCallback((song: SongRef) => {
    if (!channelRef.current || !isLeadRef.current) return;

    channelRef.current.send({
      type: 'broadcast', event: 'song_change', payload: song,
    }).catch((err: unknown) => console.error('[jam] broadcastSongChange:', err));

    if (sessionIdRef.current) {
      supabase.from('jam_sessions').update({
        current_song_id:     song.songId,
        current_song_source: song.source,
      }).eq('id', sessionIdRef.current).then(() => {});
    }
  }, []);

  const broadcastScroll = useCallback((position: number) => {
    if (!channelRef.current || !isLeadRef.current) return;
    const now = Date.now();
    if (now - lastScrollBroadcast.current < 500) return;
    lastScrollBroadcast.current = now;
    channelRef.current.send({
      type: 'broadcast', event: 'scroll_sync', payload: { position },
    });
  }, []);

  const broadcastTranspose = useCallback((newSemitones: number) => {
    if (!channelRef.current || !isLeadRef.current) return;
    setSemitones(newSemitones);
    channelRef.current.send({
      type: 'broadcast', event: 'transpose_change', payload: { semitones: newSemitones },
    });
    if (sessionIdRef.current) {
      supabase.from('jam_sessions')
        .update({ current_transpose: newSemitones })
        .eq('id', sessionIdRef.current).then(() => {});
    }
  }, []);

  const broadcastSpeed = useCallback((newSpeedIndex: number) => {
    if (!channelRef.current || !isLeadRef.current) return;
    setSpeedIndex(newSpeedIndex);
    channelRef.current.send({
      type: 'broadcast', event: 'speed_change', payload: { speedIndex: newSpeedIndex },
    });
    if (sessionIdRef.current) {
      supabase.from('jam_sessions')
        .update({ current_speed_index: newSpeedIndex })
        .eq('id', sessionIdRef.current).then(() => {});
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Queue management
  // ---------------------------------------------------------------------------

  const addToQueue = useCallback(async (song: SongRef) => {
    if (!sessionIdRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();

    // Position = current max + 1
    const maxPos = queue.length > 0
      ? Math.max(...queue.map(q => q.position)) + 1
      : 0;

    const { data: row } = await supabase.from('jam_queue').insert({
      session_id: sessionIdRef.current,
      song_id:    song.songId,
      source:     song.source,
      title:      song.title,
      artist:     song.artist,
      position:   maxPos,
      added_by:   user?.id ?? null,
    }).select('*').single();

    if (!row) return;
    const updated = [...queue, ...dbRowsToQueueItems([row])];
    setQueue(updated);
    broadcastQueueUpdate(updated);
  }, [queue, broadcastQueueUpdate]);

  const removeFromQueue = useCallback(async (queueItemId: string) => {
    if (roleRef.current !== 'jamaneger') return;
    await supabase.from('jam_queue').delete().eq('id', queueItemId);
    const updated = queue.filter(q => q.id !== queueItemId);
    setQueue(updated);
    broadcastQueueUpdate(updated);
  }, [queue, broadcastQueueUpdate]);

  const reorderQueue = useCallback(async (orderedIds: string[]) => {
    if (roleRef.current !== 'jamaneger') return;
    const reordered = orderedIds
      .map((id, pos) => {
        const item = queue.find(q => q.id === id);
        return item ? { ...item, position: pos } : null;
      })
      .filter(Boolean) as QueueItem[];

    // Bulk update positions in DB
    await Promise.all(
      reordered.map(item =>
        supabase.from('jam_queue').update({ position: item.position }).eq('id', item.id),
      ),
    );
    setQueue(reordered);
    broadcastQueueUpdate(reordered);
  }, [queue, broadcastQueueUpdate]);

  const selectSong = useCallback((queueItemId: string) => {
    if (roleRef.current !== 'jamaneger') return;
    const item = queue.find(q => q.id === queueItemId);
    if (!item) return;
    setCurrentQueueItemId(queueItemId);

    const songRef: SongRef = {
      songId: item.songId,
      source: item.source,
      title:  item.title,
      artist: item.artist,
    };

    channelRef.current?.send({
      type: 'broadcast', event: 'song_selected',
      payload: { ...songRef, queueItemId },
    });

    // Also update DB current song
    if (sessionIdRef.current) {
      supabase.from('jam_sessions').update({
        current_song_id:     item.songId,
        current_song_source: item.source,
      }).eq('id', sessionIdRef.current).then(() => {});
    }

    // Notify local song-change handlers (so SongDetailPage navigates)
    songChangeHandlers.current.forEach(h => h(songRef));
  }, [queue]);

  const playNext = useCallback(() => {
    if (roleRef.current !== 'jamaneger' || queue.length === 0) return;
    const sorted = [...queue].sort((a, b) => a.position - b.position);
    const currentIndex = sorted.findIndex(q => q.id === currentQueueItemId);
    const next = sorted[currentIndex + 1] ?? sorted[0];
    if (next) selectSong(next.id);
  }, [queue, currentQueueItemId, selectSong]);

  // ---------------------------------------------------------------------------
  // Member management
  // ---------------------------------------------------------------------------

  const kickMember = useCallback(async (userId: string) => {
    if (roleRef.current !== 'jamaneger' || !sessionIdRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const target = members.find(m => m.userId === userId);
    if (!target) return;

    if (target.isGuest) {
      await supabase.rpc('kick_jam_guest', {
        p_session_id:         sessionIdRef.current,
        p_guest_token:        userId,
        p_requesting_user_id: user.id,
      });
    } else {
      await supabase.rpc('kick_jam_member', {
        p_session_id:         sessionIdRef.current,
        p_target_user_id:     userId,
        p_requesting_user_id: user.id,
      });
    }

    channelRef.current?.send({
      type: 'broadcast', event: 'remove_participant', payload: { userId },
    });

    const updated = members.filter(m => m.userId !== userId);
    setMembers(updated);
    broadcastMemberList(updated);
  }, [members, broadcastMemberList]);

  const promoteMember = useCallback(async (userId: string) => {
    if (roleRef.current !== 'jamaneger' || !sessionIdRef.current) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.rpc('promote_jam_member', {
      p_session_id:         sessionIdRef.current,
      p_target_user_id:     userId,
      p_requesting_user_id: user.id,
    });

    channelRef.current?.send({
      type: 'broadcast', event: 'role_change',
      payload: { userId, role: 'jamaneger' },
    });

    const updated = members.map(m =>
      m.userId === userId ? { ...m, role: 'jamaneger' as const } : m,
    );
    setMembers(updated);
    broadcastMemberList(updated);
  }, [members, broadcastMemberList]);

  // ---------------------------------------------------------------------------
  // Take Lead (non-lead jamanager takes screen control)
  // ---------------------------------------------------------------------------

  const takeLead = useCallback(async () => {
    if (roleRef.current !== 'jamaneger' || !sessionIdRef.current || !currentUserIdRef.current) return;
    if (isLeadRef.current) return;

    await supabase.rpc('take_jam_lead', {
      p_session_id: sessionIdRef.current,
      p_user_id:    currentUserIdRef.current,
    });

    isLeadRef.current = true;
    setIsLead(true);

    channelRef.current?.send({
      type: 'broadcast', event: 'lead_change',
      payload: { userId: currentUserIdRef.current },
    });
  }, []);

  // ---------------------------------------------------------------------------
  // addManyToQueue — batch add, single broadcast
  // ---------------------------------------------------------------------------

  const addManyToQueue = useCallback(async (songs: SongRef[]) => {
    if (!sessionIdRef.current || songs.length === 0) return;
    const { data: { user } } = await supabase.auth.getUser();
    const userId = user?.id ?? null;

    const maxPos = queue.length > 0 ? Math.max(...queue.map(q => q.position)) + 1 : 0;
    const rows = songs.map((song, i) => ({
      session_id: sessionIdRef.current!,
      song_id:    song.songId,
      source:     song.source,
      title:      song.title,
      artist:     song.artist,
      position:   maxPos + i,
      added_by:   userId,
    }));

    const { data: insertedRows } = await supabase.from('jam_queue').insert(rows).select('*');
    if (!insertedRows) return;

    const updated = [...queue, ...dbRowsToQueueItems(insertedRows)];
    setQueue(updated);
    broadcastQueueUpdate(updated);
  }, [queue, broadcastQueueUpdate]);

  // ---------------------------------------------------------------------------
  // Subscription helpers
  // ---------------------------------------------------------------------------

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
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, []);

  const value: JamContextValue = {
    role, isLead, sessionCode, sessionId, participantCount, isConnected,
    members, queue, currentQueueItemId, semitones, speedIndex,
    startSession, joinSession, endSession, leaveSession,
    broadcastSongChange, broadcastScroll, broadcastTranspose, broadcastSpeed,
    onSongChange, onScrollSync,
    addToQueue, removeFromQueue, reorderQueue, selectSong, playNext,
    kickMember, promoteMember, takeLead, addManyToQueue,
  };

  return <JamContext.Provider value={value}>{children}</JamContext.Provider>;
}
