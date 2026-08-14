import React, { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { colors } from '../theme/theme';
import { getMyStaffUnreadCount } from '../services/api';

// One reusable bell, dropped into every screen's existing header row.
// Re-fetches the unread count every time its screen gains focus (matching
// the refresh-on-focus pattern already used elsewhere in this app, e.g.
// CustomerListScreen's useFocusEffect) rather than polling on a timer —
// simplest correct way to keep the badge from going stale as the operator
// moves between tabs.
const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      getMyStaffUnreadCount()
        .then((data) => {
          if (!cancelled) setUnreadCount(data.unreadCount || 0);
        })
        .catch(() => {
          // A failed unread-count fetch must never break the header —
          // just leave the last-known badge value in place.
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={() => router.push('/notification-center')}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
    >
      <Text style={styles.icon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: { padding: 4 },
  icon: { fontSize: 20 },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.headerBg,
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '700' },
});

export default NotificationBell;
