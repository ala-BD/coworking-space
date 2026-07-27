import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { memberPortalApi } from '../services/api';
import PortalLayout from '../components/layout/PortalLayout';

const TYPE_ICONS = {
  reservation: 'calendar_month',
  payment: 'receipt_long',
  formation: 'school',
  system: 'info',
};

const TYPE_COLORS = {
  reservation: 'rgba(0,84,203,0.09)',
  payment: 'rgba(47,190,143,0.09)',
  formation: 'rgba(255,176,32,0.09)',
  system: 'rgba(0,13,35,0.09)',
};

function getRelativeTime(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

function getDateGroup(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  if (date >= today) return 'Aujourd\'hui';
  if (date >= yesterday) return 'Hier';
  if (date >= weekAgo) return 'Cette semaine';
  return 'Plus ancien';
}

function groupNotifications(notifications) {
  const groups = {};
  notifications.forEach((n) => {
    const group = getDateGroup(n.created_at);
    if (!groups[group]) groups[group] = [];
    groups[group].push(n);
  });
  return groups;
}

function NotificationItem({ notification, onRead }) {
  const { id, type, title, message, read, created_at } = notification;

  return (
    <button
      onClick={() => !read && onRead(id)}
      className={`w-full text-left flex items-start gap-4 rounded-2xl border transition-all duration-200 hover:-translate-y-0.5 ${
        read
          ? 'bg-white border-outline-variant/10'
          : 'bg-white border-secondary/20'
      }`}
      style={{
        padding: '16px 20px',
        boxShadow: read ? '0 2px 8px rgba(16,35,63,0.04)' : '0 4px 16px rgba(0,84,203,0.06)',
      }}
    >
      <span
        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 mt-0.5"
        style={{ background: TYPE_COLORS[type] || TYPE_COLORS.system }}
      >
        <span
          className="material-symbols-outlined"
          style={{ fontSize: 20, color: '#0054cb' }}
        >
          {TYPE_ICONS[type] || TYPE_ICONS.system}
        </span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-sm font-semibold truncate ${read ? 'text-on-surface-variant' : 'text-primary'}`}
            style={{ fontFamily: 'Sora, sans-serif' }}
          >
            {title}
          </span>
          {!read && (
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: '#0054cb' }} />
          )}
        </div>
        <p className={`text-sm leading-relaxed mb-1.5 ${read ? 'text-on-surface-variant/70' : 'text-on-surface-variant'}`}>
          {message}
        </p>
        <span className="text-xs text-on-surface-variant/50">{getRelativeTime(created_at)}</span>
      </div>
    </button>
  );
}

export default function MemberNotifications() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/login'); return; }
      const { data } = await supabase.from('members').select('*').eq('id', user.id).single();
      setProfile(data);
    };
    fetchProfile();
  }, [navigate]);

  const fetchNotifications = useCallback(async (pageNum, append = false) => {
    try {
      const res = await memberPortalApi.getNotifications({
        page: pageNum,
        limit: 20,
        unread_only: filter === 'unread',
      });
      const items = res.data?.notifications || res.notifications || res.data || [];
      const total = res.data?.total ?? res.total ?? items.length;
      if (append) {
        setNotifications((prev) => [...prev, ...items]);
      } else {
        setNotifications(items);
      }
      setHasMore(items.length === 20 && notifications.length + items.length < total);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [filter, notifications.length]);

  useEffect(() => {
    setLoading(true);
    setPage(1);
    setNotifications([]);
    fetchNotifications(1, false);
  }, [filter, fetchNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await memberPortalApi.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await memberPortalApi.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setLoadingMore(true);
    setPage(next);
    fetchNotifications(next, true);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const grouped = groupNotifications(notifications);
  const groupOrder = ['Aujourd\'hui', 'Hier', 'Cette semaine', 'Plus ancien'];

  return (
    <PortalLayout profile={profile}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: 'Sora, sans-serif' }}
            >
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span
                className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full text-xs font-bold text-white"
                style={{ background: '#0054cb' }}
              >
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-sm font-semibold text-secondary hover:text-primary transition-colors"
            >
              Tout marquer comme lu
            </button>
          )}
        </div>

        <div className="flex gap-2 mb-6">
          {[
            { key: 'all', label: 'Toutes' },
            { key: 'unread', label: 'Non lues' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
                filter === tab.key
                  ? 'text-white shadow-md'
                  : 'bg-white text-on-surface-variant border border-outline-variant/15 hover:bg-surface-variant/30'
              }`}
              style={filter === tab.key ? { background: '#0054cb' } : {}}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <span className="material-symbols-outlined animate-spin text-secondary" style={{ fontSize: 32 }}>
              progress_activity
            </span>
            <span className="text-sm text-on-surface-variant">Chargement...</span>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <span
              className="flex items-center justify-center w-16 h-16 rounded-full"
              style={{ background: 'rgba(0,84,203,0.06)' }}
            >
              <span className="material-symbols-outlined text-on-surface-variant/40" style={{ fontSize: 32 }}>
                notifications_none
              </span>
            </span>
            <p className="text-on-surface-variant/60 text-sm text-center">
              {filter === 'unread'
                ? 'Vous avez lu toutes vos notifications.'
                : 'Aucune notification pour le moment.'}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {groupOrder.map((group) => {
              const items = grouped[group];
              if (!items || items.length === 0) return null;
              return (
                <div key={group}>
                  <h2
                    className="text-xs font-bold uppercase tracking-widest text-on-surface-variant/50 mb-3 ml-1"
                    style={{ fontFamily: 'Sora, sans-serif' }}
                  >
                    {group}
                  </h2>
                  <div className="space-y-2">
                    {items.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={handleMarkRead}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center mt-8">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-full text-sm font-semibold border border-secondary/20 text-secondary hover:bg-secondary/5 transition-all duration-200 disabled:opacity-50"
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">
                  <span className="material-symbols-outlined animate-spin" style={{ fontSize: 16 }}>
                    progress_activity
                  </span>
                  Chargement...
                </span>
              ) : (
                'Charger plus'
              )}
            </button>
          </div>
        )}
      </div>
    </PortalLayout>
  );
}
