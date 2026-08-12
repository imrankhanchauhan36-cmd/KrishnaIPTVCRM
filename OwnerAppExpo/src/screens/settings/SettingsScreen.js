import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Alert } from 'react-native';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import {
  registerForStaffPushNotifications,
  unregisterStaffPushNotifications,
  isStaffPushRegistered,
} from '../../utils/staffPushNotifications';
import { triggerTestStaffPush } from '../../services/api';

const SettingsScreen = ({ navigation, onLogout }) => {
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    isStaffPushRegistered().then(setPushRegistered);
  }, []);

  const handleTogglePush = useCallback(async () => {
    setPushBusy(true);
    try {
      if (pushRegistered) {
        await unregisterStaffPushNotifications();
        setPushRegistered(false);
      } else {
        const saved = await registerForStaffPushNotifications();
        if (saved) {
          setPushRegistered(true);
        } else {
          Alert.alert(
            'Could Not Enable Push',
            'Permission was not granted, or a push token could not be obtained on this device/build.'
          );
        }
      }
    } catch (error) {
      Alert.alert('Push Notification Error', error.message || 'Something went wrong.');
    } finally {
      setPushBusy(false);
    }
  }, [pushRegistered]);

  const handleSendTestPush = useCallback(async () => {
    setPushBusy(true);
    try {
      await triggerTestStaffPush();
      Alert.alert('Test Push Sent', 'Check this device for the notification.');
    } catch (error) {
      Alert.alert('Test Push Failed', error.message || 'Something went wrong.');
    } finally {
      setPushBusy(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Settings</Text>
      </View>

      <View style={styles.container}>
        <Text style={styles.sectionTitle}>Business</Text>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Plans')}>
          <Text style={styles.rowLabel}>Plans</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Employees')}>
          <Text style={styles.rowLabel}>Employees</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Portals')}>
          <Text style={styles.rowLabel}>Portal URLs</Text>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>Notifications</Text>

        <TouchableOpacity style={styles.row} onPress={handleTogglePush} disabled={pushBusy}>
          <Text style={styles.rowLabel}>
            {pushRegistered ? 'Push Notifications: Enabled' : 'Enable Push Notifications'}
          </Text>
          <Text style={styles.rowArrow}>{pushBusy ? '…' : '›'}</Text>
        </TouchableOpacity>

        {pushRegistered && (
          <TouchableOpacity style={styles.row} onPress={handleSendTestPush} disabled={pushBusy}>
            <Text style={styles.rowLabel}>Send Test Notification</Text>
            <Text style={styles.rowArrow}>{pushBusy ? '…' : '›'}</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.rowDisabled}>
          <Text style={styles.rowLabelDisabled}>Profile</Text>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>

        <View style={styles.rowDisabled}>
          <Text style={styles.rowLabelDisabled}>App Settings</Text>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>

        <View style={styles.rowDisabled}>
          <Text style={styles.rowLabelDisabled}>Backup & Restore</Text>
          <Text style={styles.comingSoon}>Coming soon</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={onLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarTitle: { color: colors.headerText, fontSize: 18, fontWeight: '700' },
  container: { padding: spacing.lg },
  sectionTitle: {
    ...typography.label,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  row: {
    ...commonStyles.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  rowLabel: { fontSize: 14, color: colors.text, fontWeight: '600' },
  rowArrow: { fontSize: 18, color: colors.textMuted },
  rowDisabled: {
    ...commonStyles.card,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    opacity: 0.6,
  },
  rowLabelDisabled: { fontSize: 14, color: colors.textSecondary },
  comingSoon: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },
  logoutButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.dangerBg,
    borderRadius: 6,
    paddingVertical: 13,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});

export default SettingsScreen;
