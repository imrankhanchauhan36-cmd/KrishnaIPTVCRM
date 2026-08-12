import React, { useEffect, useState } from 'react';
import type { NotificationItem } from '../types';
import { getMyNotifications, markAllMineAsRead } from '../services/api';

interface Props {
  onBack: () => void;
}

const NotificationsScreen: React.FC<Props> = ({ onBack }) => {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const result = await getMyNotifications();
        setItems(result.notifications);
        if (result.notifications.some((n) => !n.readAt)) {
          await markAllMineAsRead();
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load notifications');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="screen">
      <div className="topbar">
        <button className="topbar-back" onClick={onBack}>
          ← Back
        </button>
        <div className="topbar-title">Notifications</div>
        <div style={{ width: 60 }} />
      </div>

      <div className="content">
        {loading && (
          <div className="state-block">
            <span className="spinner" />
            Loading…
          </div>
        )}
        {!loading && error && (
          <div className="state-block">
            <span className="state-icon">⚠️</span>
            {error}
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <div className="state-block">
            <span className="state-icon">🔔</span>
            You have no notifications yet.
          </div>
        )}
        {!loading &&
          !error &&
          items.map((item) => (
            <div key={item._id} className={`notification-item ${!item.readAt ? 'unread' : ''}`}>
              <div className="notification-title">{item.title}</div>
              <div className="notification-body">{item.body}</div>
              <div className="notification-time">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          ))}
      </div>
    </div>
  );
};

export default NotificationsScreen;
