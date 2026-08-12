import React, { useEffect, useState } from 'react';
import type { MeResponse } from '../types';
import { getMe, getMyUnreadCount } from '../services/api';
import { useAuth } from '../context/AuthContext';
import SubscriptionCard from '../components/SubscriptionCard';
import WhatsAppButton from '../components/WhatsAppButton';
import { registerForPushNotifications, getPushPermissionState } from '../utils/push';

interface Props {
  onOpenNotifications: () => void;
}

const DashboardScreen: React.FC<Props> = ({ onOpenNotifications }) => {
  const { logout } = useAuth();
  const [data, setData] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushState, setPushState] = useState(getPushPermissionState());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, unread] = await Promise.all([getMe(), getMyUnreadCount().catch(() => ({ unreadCount: 0 }))]);
        if (!cancelled) {
          setData(me);
          setUnreadCount(unread.unreadCount);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your subscription');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleEnablePush = async () => {
    const ok = await registerForPushNotifications();
    setPushState(getPushPermissionState());
    if (!ok) {
      alert('Could not enable notifications. Please check your browser permission settings.');
    }
  };

  const activeSubscriptions = (data?.subscriptions || []).filter((s) => s.status === 'Active');
  const otherSubscriptions = (data?.subscriptions || []).filter((s) => s.status !== 'Active');

  return (
    <div className="screen">
      <div className="topbar">
        <div className="topbar-title">Krishna IPTV</div>
        <button className="topbar-icon-button" onClick={onOpenNotifications} aria-label="Notifications">
          🔔
          {unreadCount > 0 && <span className="topbar-badge">{unreadCount}</span>}
        </button>
      </div>

      <div className="content">
        {loading && (
          <div className="state-block">
            <span className="spinner" />
            Loading your subscription…
          </div>
        )}

        {!loading && error && (
          <div className="state-block">
            <span className="state-icon">⚠️</span>
            {error}
            <br />
            <button className="link-button" onClick={() => window.location.reload()}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <>
            <p className="subtitle" style={{ textAlign: 'left', marginBottom: 20 }}>
              Hello, {data.customer.fullName} 👋
              <br />
              <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
                Customer ID: {data.customer.customerId} · {data.customer.whatsappNumber}
              </span>
            </p>

            <div className="section-title">Your Service</div>
            {activeSubscriptions.length === 0 && otherSubscriptions.length === 0 && (
              <div className="state-block">
                <span className="state-icon">📺</span>
                No subscription on file yet. Please contact us on WhatsApp.
              </div>
            )}
            {activeSubscriptions.map((s) => (
              <SubscriptionCard key={s._id} subscription={s} devices={data.devices} />
            ))}

            {otherSubscriptions.length > 0 && (
              <>
                <div className="section-title">Service History</div>
                {otherSubscriptions.map((s) => (
                  <SubscriptionCard key={s._id} subscription={s} devices={data.devices} />
                ))}
              </>
            )}

            {pushState !== 'granted' && pushState !== 'unsupported' && (
              <button className="button button-secondary" style={{ marginTop: 10 }} onClick={handleEnablePush}>
                Enable Notifications
              </button>
            )}

            <WhatsAppButton />

            <button className="button button-danger" style={{ marginTop: 24 }} onClick={logout}>
              Logout
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default DashboardScreen;
