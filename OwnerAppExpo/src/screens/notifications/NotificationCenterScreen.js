import React, { useCallback, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Platform,
  StatusBar,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import {
  getMyStaffNotifications,
  markAllStaffNotificationsRead,
  markStaffNotificationRead,
} from '../../services/api';

const formatTimestamp = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
};

// eventType -> short, readable label. Only STAFF_TEST_NOTIFICATION can
// actually reach this screen today (see backend audit — no real business
// event is wired to a staff recipient yet), but this stays a lookup rather
// than a single hardcoded label so it degrades gracefully if/when a real
// business event is added later, instead of silently mislabeling it.
const EVENT_LABELS = {
  STAFF_TEST_NOTIFICATION: 'Test',
};

const NotificationCenterScreen = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await getMyStaffNotifications();
      setNotifications(data.notifications || []);
    } catch (err) {
      setError(err.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleOpenNotification = async (item) => {
    if (item.readAt) return;
    // Optimistic — the badge/list should feel instant; if the request
    // fails the next load() naturally reconciles back to the real state.
    setNotifications((prev) =>
      prev.map((n) => (n._id === item._id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    try {
      await markStaffNotificationRead(item._id);
    } catch {
      load();
    }
  };

  const handleMarkAllRead = async () => {
    setMarkingAll(true);
    try {
      await markAllStaffNotificationsRead();
      load();
    } catch {
      // A failed bulk mark-read shouldn't be silent, but shouldn't block
      // the screen either — the list simply stays as-is until retried.
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadExists = notifications.some((n) => !n.readAt);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Notifications</Text>
        {unreadExists && (
          <TouchableOpacity onPress={handleMarkAllRead} disabled={markingAll}>
            <Text style={styles.markAllLink}>{markingAll ? 'Marking...' : 'Mark all read'}</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {notifications.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>No notifications yet.</Text>
            </View>
          )}

          {notifications.map((item) => (
            <TouchableOpacity
              key={item._id}
              style={[styles.card, !item.readAt && styles.cardUnread]}
              onPress={() => handleOpenNotification(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardTopRow}>
                <View style={styles.cardTitleRow}>
                  {!item.readAt && <View style={styles.unreadDot} />}
                  <Text style={styles.cardTitle}>{item.title}</Text>
                </View>
                <Text style={styles.cardTime}>{formatTimestamp(item.createdAt)}</Text>
              </View>
              <Text style={styles.cardBody}>{item.body}</Text>
              {!!EVENT_LABELS[item.eventType] && (
                <View style={styles.typeBadge}>
                  <Text style={styles.typeBadgeText}>{EVENT_LABELS[item.eventType]}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarTitle: { color: colors.headerText, fontSize: 18, fontWeight: '700' },
  markAllLink: { color: '#c9d8ef', fontSize: 13, fontWeight: '600' },
  container: { padding: spacing.lg, paddingBottom: 40 },
  emptyState: { alignItems: 'center', marginTop: spacing.xl * 2 },
  emptyIcon: { fontSize: 40, marginBottom: spacing.sm },
  emptyText: { ...typography.bodyMuted },
  errorText: { ...typography.body, color: colors.danger, textAlign: 'center', marginBottom: spacing.md },
  retryButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: { color: '#ffffff', fontWeight: '600' },
  card: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: spacing.sm },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 6,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  cardTime: { fontSize: 11, color: colors.textMuted },
  cardBody: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: spacing.sm,
  },
  typeBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
});

export default NotificationCenterScreen;
