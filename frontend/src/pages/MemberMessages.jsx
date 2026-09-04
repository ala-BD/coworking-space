import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import PortalLayout from '../components/layout/PortalLayout';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `${diffMin} min`;
  if (diffH < 24) return `${diffH}h`;
  if (diffD < 7) return `${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getDateLabel(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date >= today) return "Aujourd'hui";
  if (date >= yesterday) return 'Hier';
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ConversationItem({ conv, isActive, onClick }) {
  const lastMsg = conv.last_message;
  const senderLabel = lastMsg
    ? lastMsg.sender_id === conv.currentUserId ? 'Vous' : 'Support'
    : '';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl transition-all duration-200 ${
        isActive
          ? 'bg-secondary/8 border-2 border-secondary/20'
          : 'bg-white border border-outline-variant/10 hover:bg-surface-variant/20 hover:border-outline-variant/20'
      }`}
      style={{ boxShadow: isActive ? '0 4px 16px rgba(0,84,203,0.06)' : '0 2px 8px rgba(16,35,63,0.04)' }}
    >
      <div className="flex items-center justify-center w-11 h-11 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #f95d00, #ff7a28)' }}>
        <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>{conv.type === 'group' ? 'group' : 'headset_mic'}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-sm font-semibold text-primary truncate" style={{ fontFamily: 'Sora, sans-serif' }}>{conv.title}</span>
          {lastMsg && <span className="text-[11px] text-on-surface-variant/50 shrink-0">{getRelativeTime(lastMsg.created_at)}</span>}
        </div>
        {lastMsg ? (
          <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-on-surface-variant font-semibold' : 'text-on-surface-variant/60'}`}>
            {senderLabel && <span className="font-semibold">{senderLabel}: </span>}{lastMsg.content}
          </p>
        ) : (
          <p className="text-xs text-on-surface-variant/40 italic">Aucun message</p>
        )}
      </div>
      {conv.unread_count > 0 && (
        <span className="flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold text-white shrink-0 mt-1" style={{ background: '#f95d00' }}>
          {conv.unread_count > 99 ? '99+' : conv.unread_count}
        </span>
      )}
    </button>
  );
}

function MessageBubble({ msg, isOwn, showSender }) {
  const senderName = msg.profiles ? `${msg.profiles.prenom || ''} ${msg.profiles.nom || ''}`.trim() || 'Utilisateur' : 'Utilisateur';
  const isAdmin = msg.profiles?.role && ['super_admin', 'admin', 'staff'].includes(msg.profiles.role);

  return (
    <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} mb-3`}>
      {showSender && !isOwn && (
        <div className="flex items-center gap-1.5 mb-1 ml-1">
          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ background: isAdmin ? 'linear-gradient(135deg, #f95d00, #ff7a28)' : 'linear-gradient(135deg, #2FBE8F, #28a745)' }}>
            {senderName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-on-surface-variant">{senderName}</span>
          {isAdmin && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary/10 text-secondary">Staff</span>}
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isOwn ? 'text-white rounded-br-md' : 'bg-white border border-outline-variant/10 text-on-surface rounded-bl-md'}`}
        style={isOwn ? { background: 'linear-gradient(135deg, #f95d00, #ff7a28)', boxShadow: '0 4px 12px rgba(249,93,0,0.15)' } : { boxShadow: '0 2px 8px rgba(16,35,63,0.04)' }}
      >
        {msg.content}
      </div>
      <span className="text-[10px] text-on-surface-variant/40 mt-0.5 mx-2">
        {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        {msg._sending && ' ...'}
      </span>
    </div>
  );
}

export default function MemberMessages() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);
  const inputRef = useRef(null);
  const activeConvRef = useRef(null);
  const profileRef = useRef(null);
  const joinedRooms = useRef(new Set());

  useEffect(() => { profileRef.current = profile; }, [profile]);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setProfile(data);
    };
    fetchProfile();
  }, [navigate]);

  const fetchConversations = useCallback(async () => {
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${SOCKET_URL}/api/conversations`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      let convs = (data.conversations || []).map(c => ({ ...c, currentUserId: profile?.id }));

      if (convs.length === 0 && profile) {
        const createRes = await fetch(`${SOCKET_URL}/api/conversations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ title: 'Support 33S', type: 'support' }),
        });
        const createData = await createRes.json();
        if (createData.conversation) {
          convs = [{ ...createData.conversation, currentUserId: profile.id, last_message: null, unread_count: 0 }];
        }
      }
      setConversations(convs);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [profile?.id, profile]);

  useEffect(() => { if (profile) fetchConversations(); }, [profile, fetchConversations]);

  // Stable socket — never reconnects
  useEffect(() => {
    if (!profile) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'], reconnection: true, reconnectionDelay: 1000 });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('join:user', profile.id);
      joinedRooms.current.clear();
      joinedRooms.current.add(`user:${profile.id}`);
      // Rejoin all conversation rooms
      conversations.forEach(c => {
        socket.emit('join:conversation', c.id);
        joinedRooms.current.add(`conv:${c.id}`);
      });
    });

    socket.on('message:received', ({ conversation_id, message }) => {
      const active = activeConvRef.current;
      if (active?.id === conversation_id) {
        setMessages(prev => {
          if (prev.find(m => m.id === message.id)) return prev;
          return [...prev, { ...message, _sending: false }];
        });
      }
      setConversations(prev => prev.map(c =>
        c.id === conversation_id
          ? {
              ...c,
              last_message: { id: message.id, content: message.content, sender_id: message.sender_id, created_at: message.created_at },
              unread_count: active?.id === conversation_id ? 0 : (c.unread_count || 0) + (message.sender_id !== profileRef.current?.id ? 1 : 0),
              currentUserId: profileRef.current?.id,
            }
          : c
      ));
    });

    socket.on('conversation:update', ({ conversation_id, last_message, title }) => {
      setConversations(prev => {
        const exists = prev.find(c => c.id === conversation_id);
        if (exists) {
          return prev.map(c => c.id === conversation_id ? { ...c, last_message } : c);
        }
        // New conversation from admin — add it
        return [{ id: conversation_id, title: title || 'Conversation', type: 'support', last_message, unread_count: 1, currentUserId: profileRef.current?.id }, ...prev];
      });
    });

    socket.on('disconnect', () => console.log('🔌 Socket déconnecté'));
    socket.on('reconnect', () => {
      socket.emit('join:user', profile.id);
    });

    return () => { socket.disconnect(); };
  }, [profile]);

  // Join conversation room when selecting
  const joinConversation = useCallback((convId) => {
    if (socketRef.current && !joinedRooms.current.has(`conv:${convId}`)) {
      socketRef.current.emit('join:conversation', convId);
      joinedRooms.current.add(`conv:${convId}`);
    }
  }, []);

  const selectConversation = useCallback(async (conv) => {
    setActiveConv(conv);
    setShowMobileChat(true);
    setMessages([]);
    joinConversation(conv.id);

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${SOCKET_URL}/api/conversations/${conv.id}/messages?limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      setMessages((data.messages || []).reverse().map(m => ({ ...m, _sending: false })));

      await fetch(`${SOCKET_URL}/api/conversations/${conv.id}/read`, {
        method: 'PATCH', headers: { Authorization: `Bearer ${token}` },
      });

      setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, unread_count: 0, currentUserId: profile?.id } : c));
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [profile?.id, joinConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !activeConv || sending) return;
    const content = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    const optimisticMsg = {
      id: tempId, conversation_id: activeConv.id, sender_id: profile.id, content, created_at: now,
      profiles: { id: profile.id, nom: profile.nom, prenom: profile.prenom, role: profile.role }, _sending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setNewMessage('');
    setSending(true);
    setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, last_message: { id: tempId, content, sender_id: profile.id, created_at: now }, currentUserId: profile.id } : c));

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const res = await fetch(`${SOCKET_URL}/api/conversations/${activeConv.id}/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...data.message, _sending: false } : m));
        setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, last_message: { id: data.message.id, content, sender_id: profile.id, created_at: data.message.created_at } } : c));
      } else { throw new Error(data.error || 'Erreur envoi'); }
    } catch (err) {
      console.error('Failed to send:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, _sending: false, _error: true } : m));
      setNewMessage(content);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <PortalLayout profile={profile}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: 'Sora, sans-serif' }}>Messagerie</h1>
            {totalUnread > 0 && <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold text-white" style={{ background: '#f95d00' }}>{totalUnread}</span>}
          </div>
        </div>
        <div className="flex rounded-3xl overflow-hidden border border-outline-variant/10 bg-white" style={{ height: 'calc(100vh - 200px)', minHeight: '500px', boxShadow: '0 8px 32px rgba(16,35,63,0.08)' }}>
          {/* Left */}
          <div className={`w-full md:w-[340px] shrink-0 border-r border-outline-variant/10 flex flex-col bg-surface-variant/10 ${showMobileChat ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-outline-variant/10">
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/40" style={{ fontSize: 20 }}>search</span>
                <input type="text" placeholder="Rechercher..." className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-outline-variant/15 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary/40 transition-colors" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12"><span className="material-symbols-outlined animate-spin text-secondary" style={{ fontSize: 28 }}>progress_activity</span></div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 40 }}>chat_bubble_outline</span>
                  <p className="text-sm text-on-surface-variant/50 text-center">Aucune conversation</p>
                </div>
              ) : conversations.map(conv => (
                <ConversationItem key={conv.id} conv={{ ...conv, currentUserId: profile?.id }} isActive={activeConv?.id === conv.id} onClick={() => selectConversation(conv)} />
              ))}
            </div>
          </div>
          {/* Right */}
          <div className={`flex-1 flex flex-col bg-white ${showMobileChat ? 'flex' : 'hidden md:flex'}`}>
            {!activeConv ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-4">
                <span className="flex items-center justify-center w-20 h-20 rounded-full" style={{ background: 'rgba(0,84,203,0.06)' }}>
                  <span className="material-symbols-outlined text-on-surface-variant/30" style={{ fontSize: 40 }}>forum</span>
                </span>
                <div className="text-center">
                  <p className="text-on-surface-variant/60 text-sm font-medium" style={{ fontFamily: 'Sora, sans-serif' }}>Sélectionnez une conversation</p>
                  <p className="text-on-surface-variant/40 text-xs mt-1">Pour commencer à discuter</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/10">
                  <button onClick={() => setShowMobileChat(false)} className="md:hidden flex items-center justify-center w-9 h-9 rounded-full hover:bg-surface-variant/30">
                    <span className="material-symbols-outlined text-on-surface-variant" style={{ fontSize: 20 }}>arrow_back</span>
                  </button>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f95d00, #ff7a28)' }}>
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 20 }}>headset_mic</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary" style={{ fontFamily: 'Sora, sans-serif' }}>{activeConv.title}</p>
                    <p className="text-xs text-on-surface-variant/50">En ligne</p>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4" style={{ background: '#F8F9FB' }}>
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3">
                      <span className="material-symbols-outlined text-on-surface-variant/20" style={{ fontSize: 48 }}>chat_bubble_outline</span>
                      <p className="text-sm text-on-surface-variant/40 text-center">Démarrez la conversation</p>
                    </div>
                  ) : (
                    <>
                      {messages.map((msg, idx) => {
                        const isOwn = msg.sender_id === profile?.id;
                        const prevMsg = messages[idx - 1];
                        const showSender = !prevMsg || prevMsg.sender_id !== msg.sender_id;
                        const showDate = !prevMsg || getDateLabel(msg.created_at) !== getDateLabel(prevMsg.created_at);
                        return (
                          <React.Fragment key={msg.id}>
                            {showDate && <div className="flex items-center justify-center my-4"><span className="text-[11px] font-semibold text-on-surface-variant/40 px-3 py-1 rounded-full bg-white border border-outline-variant/10">{getDateLabel(msg.created_at)}</span></div>}
                            <MessageBubble msg={msg} isOwn={isOwn} showSender={showSender} />
                          </React.Fragment>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </>
                  )}
                </div>
                <div className="px-5 py-4 border-t border-outline-variant/10 bg-white">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <textarea ref={inputRef} value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={handleKeyDown} placeholder="Écrivez votre message..." rows={1} className="w-full px-4 py-3 rounded-2xl bg-surface-variant/30 border border-outline-variant/15 text-sm text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none focus:border-secondary/40 transition-colors resize-none" style={{ minHeight: '44px', maxHeight: '120px' }} />
                    </div>
                    <button onClick={handleSend} disabled={!newMessage.trim() || sending} className="flex items-center justify-center w-11 h-11 rounded-full text-white shrink-0 transition-all duration-200 disabled:opacity-40 hover:scale-105 active:scale-95" style={{ background: 'linear-gradient(135deg, #f95d00, #ff7a28)', boxShadow: '0 4px 12px rgba(249,93,0,0.2)' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>send</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </PortalLayout>
  );
}
