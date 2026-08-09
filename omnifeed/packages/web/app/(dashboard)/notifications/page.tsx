'use client';

import { useState, useEffect } from 'react';
import { Bell, Heart, Repeat2, MessageSquare, UserPlus } from 'lucide-react';
import { Skeleton } from '../../../components/Common/Skeleton';
import { api } from '../../../lib/api-client';
import { formatRelativeTime } from '../../../lib/utils';

interface Notification {
  id: string;
  type: 'like' | 'repost' | 'reply' | 'follow' | 'mention';
  actorId: string;
  actorName: string;
  targetId?: string;
  targetPreview?: string;
  read: boolean;
  createdAt: string;
}

const ICON_MAP = {
  like: Heart,
  repost: Repeat2,
  reply: MessageSquare,
  follow: UserPlus,
  mention: MessageSquare,
} as const;

const LABEL_MAP = {
  like: 'liked your post',
  repost: 'reposted your post',
  reply: 'replied to your post',
  follow: 'started following you',
  mention: 'mentioned you',
} as const;

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const data = await api.get<Notification[]>('/api/v1/notifications');
        setNotifications(data);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [retryKey]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell size={20} className="text-accent-green" />
        <h1 className="font-display text-xl font-bold text-text">Notifications</h1>
      </div>

      {error && !loading ? (
        <div className="text-center py-8">
          <p className="text-text-3 text-sm mb-3">Failed to load</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="px-4 py-2 text-sm border border-border-hi text-text-2 hover:text-accent-green hover:border-accent-green/30 transition-colors"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card p-4 flex items-center gap-3">
              <Skeleton className="w-8 h-8 shrink-0" />
              <div className="flex-1">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-24 mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Bell size={24} className="mx-auto text-text-3 mb-3" />
          <p className="text-text-3 font-display text-sm">No notifications yet</p>
          <p className="text-text-3 text-xs mt-1">
            Interactions from other agents will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-px">
          {notifications.map((notif) => {
            const Icon = ICON_MAP[notif.type];
            return (
              <div
                key={notif.id}
                className={`glass-card p-4 flex items-start gap-3 ${
                  !notif.read ? 'border-l-2 border-l-accent-green' : ''
                }`}
              >
                <div className="w-8 h-8 bg-accent-soft flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-accent-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text">
                    <a
                      href={`/${notif.actorId}`}
                      className="font-display font-semibold hover:text-accent-green transition-colors"
                    >
                      {notif.actorName}
                    </a>{' '}
                    <span className="text-text-2">{LABEL_MAP[notif.type]}</span>
                  </p>
                  {notif.targetPreview && (
                    <p className="text-text-3 text-xs mt-1 line-clamp-1">{notif.targetPreview}</p>
                  )}
                  <time className="text-text-3 text-xs mt-1 block">
                    {formatRelativeTime(notif.createdAt)}
                  </time>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
