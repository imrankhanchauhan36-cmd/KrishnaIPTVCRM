import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import { getDashboardStats, getTrialsByDate, getAllTrials, updateSubscriptionStatus } from '../../services/api';
import WhatsAppQuickAction from '../../components/WhatsAppQuickAction';
import NotificationBell from '../../components/NotificationBell';

const FOLLOW_UP_CHIPS = ['Call Today', 'WhatsApp Today', 'No Response', 'Call Back Tomorrow'];

const copyToClipboard = async (text, label) => {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  Alert.alert('Copied', `${label} copied to clipboard`);
};

const getDateForOffset = (offsetDays) => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

const DashboardScreen = ({ navigation }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trialFilter, setTrialFilter] = useState('today');
  const [customDate, setCustomDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [trials, setTrials] = useState([]);
  const [trialsLoading, setTrialsLoading] = useState(true);
  const [trialSearch, setTrialSearch] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (error) {
      console.log('Could not load dashboard stats', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTrials = useCallback(async () => {
    setTrialsLoading(true);
    try {
      if (trialFilter === 'all') {
        const data = await getAllTrials();
        setTrials(data);
        return;
      }

      let date;
      if (trialFilter === 'today') date = getDateForOffset(0);
      else if (trialFilter === 'yesterday') date = getDateForOffset(-1);
      else if (trialFilter === 'dayBefore') date = getDateForOffset(-2);
      else date = customDate;

      const data = await getTrialsByDate(date);
      setTrials(data);
    } catch (error) {
      console.log('Could not load trials', error);
    } finally {
      setTrialsLoading(false);
    }
  }, [trialFilter, customDate]);

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setCustomDate(selectedDate);
      setTrialFilter('custom');
    }
  };

  const getFilteredTrials = () => {
    if (!trialSearch.trim()) return trials;
    const q = trialSearch.trim().toLowerCase();
    return trials.filter(
      (t) =>
        t.fullName?.toLowerCase().includes(q) ||
        t.whatsappNumber?.toLowerCase().includes(q) ||
        t.email?.toLowerCase().includes(q) ||
        t.macAddress?.toLowerCase().includes(q)
    );
  };

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadTrials();
  }, [loadTrials]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
    loadTrials();
  };

  const handleSetFollowUpStatus = async (subscriptionId, followUpStatus) => {
    try {
      await updateSubscriptionStatus(subscriptionId, { followUpStatus });
      loadTrials();
    } catch (error) {
      Alert.alert('Error', 'Could not update follow-up status.');
    }
  };

  const handleMarkLost = (subscriptionId) => {
    Alert.alert('Mark Trial as Lost', 'This trial will be marked as lost. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Lost',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateSubscriptionStatus(subscriptionId, { trialStatus: 'Lost', followUpStatus: 'Lost' });
            loadTrials();
          } catch (error) {
            Alert.alert('Error', 'Could not update trial status.');
          }
        },
      },
    ]);
  };

  const openTrialCustomer = (t) => {
    if (!t.customerObjectId) return;
    navigation.navigate('Customers', {
      screen: 'CustomerDetails',
      params: {
        customer: {
          _id: t.customerObjectId,
          customerId: t.customerCode,
          fullName: t.fullName,
          whatsappNumber: t.whatsappNumber,
          email: t.email,
        },
      },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // Each card navigates into the existing screen that already owns this
  // data, pre-selecting the matching filter there — no new screens, no
  // duplicated business logic. "Pending Payments" is the one exception:
  // the backend has no real query behind that stat (dashboard.controller.js
  // hardcodes pendingPayments: 0 — there's no "amount due" concept in this
  // CRM, payments are only ever recorded after being received), so it
  // opens Payments unfiltered rather than pretending a filter exists.
  const dashboardCards = [
    {
      id: '1',
      label: "Today's Renewals",
      value: stats?.todaysRenewals ?? 0,
      color: colors.primary,
      onPress: () => navigation.navigate('Renewals', { initialDateFilter: 'today' }),
    },
    {
      id: '2',
      label: "Tomorrow's Renewals",
      value: stats?.tomorrowsRenewals ?? 0,
      color: '#0ea5e9',
      onPress: () => navigation.navigate('Renewals', { initialDateFilter: 'tomorrow' }),
    },
    {
      id: '3',
      label: 'Next 7 Days',
      value: stats?.next7DaysRenewals ?? 0,
      color: '#0d9488',
      onPress: () => navigation.navigate('Renewals', { initialBucket: 'next7' }),
    },
    {
      id: '4',
      label: 'Expired Customers',
      value: stats?.expiredCustomers ?? 0,
      color: colors.danger,
      onPress: () =>
        navigation.navigate('Customers', { screen: 'CustomerList', params: { initialStatusFilter: 'Expired' } }),
    },
    {
      id: '5',
      label: 'Active Customers',
      value: stats?.activeCustomers ?? 0,
      color: colors.success,
      onPress: () =>
        navigation.navigate('Customers', { screen: 'CustomerList', params: { initialStatusFilter: 'Active' } }),
    },
    {
      id: '6',
      label: 'Monthly Revenue',
      value: `$${stats?.monthlyRevenue ?? 0}`,
      color: '#b45309',
      onPress: () => navigation.navigate('Payments', { initialMonth: 'current' }),
    },
    {
      id: '7',
      label: 'Pending Payments',
      value: stats?.pendingPayments ?? 0,
      color: '#be123c',
      onPress: () => navigation.navigate('Payments', {}),
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.topBar, styles.topBarRow]}>
        <View>
          <Text style={styles.topBarTitle}>Dashboard</Text>
          <Text style={styles.topBarSubtitle}>Krishna IPTV Owner Overview</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.grid}>
          {dashboardCards.map((card) => (
            <TouchableOpacity
              key={card.id}
              style={[styles.card, { borderLeftColor: card.color }]}
              onPress={card.onPress}
              activeOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={card.label}
            >
              <Text style={[styles.cardValue, { color: card.color }]}>{card.value}</Text>
              <Text style={styles.cardLabel}>{card.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Trial Follow-ups</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trialFilterRow}>
          {[
            { key: 'today', label: 'Today' },
            { key: 'yesterday', label: 'Yesterday' },
            { key: 'dayBefore', label: '2 Days Ago' },
            { key: 'all', label: 'All' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.trialChip, trialFilter === opt.key && styles.trialChipActive]}
              onPress={() => setTrialFilter(opt.key)}
            >
              <Text
                style={[
                  styles.trialChipText,
                  trialFilter === opt.key && styles.trialChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.trialChip, trialFilter === 'custom' && styles.trialChipActive]}
            onPress={() => setShowDatePicker(true)}
          >
            <Text
              style={[
                styles.trialChipText,
                trialFilter === 'custom' && styles.trialChipTextActive,
              ]}
            >
              📅 {trialFilter === 'custom' ? customDate.toDateString() : 'Pick Date'}
            </Text>
          </TouchableOpacity>
        </ScrollView>

        {showDatePicker && (
          <DateTimePicker
            value={customDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
          />
        )}

        <TextInput
          style={styles.trialSearchInput}
          placeholder="Search trials by name, phone, email, or MAC"
          placeholderTextColor={colors.textMuted}
          value={trialSearch}
          onChangeText={setTrialSearch}
          autoCapitalize="none"
        />

        {trialsLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.md }} />
        )}

        {!trialsLoading && getFilteredTrials().length === 0 && (
          <Text style={styles.emptyTrialText}>No trials given on this day.</Text>
        )}

        {!trialsLoading &&
          getFilteredTrials().map((t) => (
            <View key={t.subscriptionId} style={styles.trialCard}>
              <TouchableOpacity onPress={() => openTrialCustomer(t)}>
                <View style={styles.trialCardHeader}>
                  <Text style={styles.trialName}>{t.fullName}</Text>
                  <Text style={styles.trialPlan}>{t.plan}</Text>
                </View>
              </TouchableOpacity>

              {(t.trialStatus && t.trialStatus !== 'Pending') || (t.followUpStatus && t.followUpStatus !== 'Pending') ? (
                <View style={styles.trialStatusRow}>
                  {t.trialStatus && t.trialStatus !== 'Pending' && (
                    <View style={styles.trialStatusBadge}>
                      <Text style={styles.trialStatusBadgeText}>{t.trialStatus}</Text>
                    </View>
                  )}
                  {t.followUpStatus && t.followUpStatus !== 'Pending' && (
                    <View style={styles.followUpStatusBadge}>
                      <Text style={styles.followUpStatusBadgeText}>{t.followUpStatus}</Text>
                    </View>
                  )}
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.trialCopyRow}
                onPress={() => copyToClipboard(t.whatsappNumber, 'Phone number')}
              >
                <Text style={styles.trialCopyIcon}>📞</Text>
                <Text style={styles.trialCopyText}>{t.whatsappNumber}</Text>
              </TouchableOpacity>

              <WhatsAppQuickAction
                customer={{
                  fullName: t.fullName,
                  whatsappNumber: t.whatsappNumber,
                  activePlan: t.plan,
                  panelExpiryDate: t.panelExpiryDate,
                }}
              />

              {!!t.email && (
                <TouchableOpacity
                  style={styles.trialCopyRow}
                  onPress={() => copyToClipboard(t.email, 'Email')}
                >
                  <Text style={styles.trialCopyIcon}>📧</Text>
                  <Text style={styles.trialCopyText}>{t.email}</Text>
                </TouchableOpacity>
              )}

              {!!t.macAddress && (
                <TouchableOpacity
                  style={styles.trialCopyRow}
                  onPress={() => copyToClipboard(t.macAddress, 'MAC Address')}
                >
                  <Text style={styles.trialCopyIcon}>📺</Text>
                  <Text style={styles.trialCopyText}>{t.macAddress}</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.trialExpiry}>
                Trial ends: {new Date(t.panelExpiryDate).toDateString()}
              </Text>

              {t.trialStatus !== 'Converted' && t.trialStatus !== 'Lost' && (
                <>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followUpChipRow}>
                    {FOLLOW_UP_CHIPS.map((label) => (
                      <TouchableOpacity
                        key={label}
                        style={[
                          styles.followUpChip,
                          t.followUpStatus === label && styles.followUpChipActive,
                        ]}
                        onPress={() => handleSetFollowUpStatus(t.subscriptionId, label)}
                      >
                        <Text
                          style={[
                            styles.followUpChipText,
                            t.followUpStatus === label && styles.followUpChipTextActive,
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  <TouchableOpacity
                    style={styles.markLostButton}
                    onPress={() => handleMarkLost(t.subscriptionId)}
                  >
                    <Text style={styles.markLostButtonText}>Mark Lost</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
  topBar: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarTitle: { color: colors.headerText, fontSize: 18, fontWeight: '700' },
  topBarSubtitle: { color: '#c9d8ef', fontSize: 12, marginTop: 2 },
  container: { padding: spacing.lg, paddingBottom: 40 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  card: {
    width: '48%',
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardLabel: {
    ...typography.bodyMuted,
    fontSize: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  trialFilterRow: { flexDirection: 'row', marginBottom: spacing.sm },
  trialSearchInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginBottom: spacing.md,
  },
  trialChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  trialChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  trialChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  trialChipTextActive: { color: '#ffffff' },
  emptyTrialText: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.lg },
  trialCard: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  trialCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  trialName: { fontSize: 14, fontWeight: '700', color: colors.text },
  trialPlan: { fontSize: 12, color: colors.textSecondary },
  trialCopyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  trialCopyIcon: { fontSize: 12, marginRight: 6 },
  trialCopyText: { fontSize: 12, color: colors.text },
  trialExpiry: { fontSize: 11, color: colors.danger, marginTop: 6, fontWeight: '600' },
  trialStatusRow: { flexDirection: 'row', marginTop: 6, gap: 6 },
  trialStatusBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
  },
  trialStatusBadgeText: { fontSize: 10, fontWeight: '700', color: colors.primary },
  followUpStatusBadge: {
    backgroundColor: colors.successBg,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  followUpStatusBadgeText: { fontSize: 10, fontWeight: '700', color: colors.success },
  followUpChipRow: { flexDirection: 'row', marginTop: spacing.sm },
  followUpChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  followUpChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  followUpChipText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  followUpChipTextActive: { color: '#ffffff' },
  markLostButton: {
    marginTop: spacing.sm,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerBg,
  },
  markLostButtonText: { color: colors.danger, fontWeight: '600', fontSize: 12 },
});

export default DashboardScreen;
