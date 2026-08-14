import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getRenewals } from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import WhatsAppQuickAction from '../../components/WhatsAppQuickAction';
import NotificationBell from '../../components/NotificationBell';

const copyToClipboard = async (text, label) => {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  Alert.alert('Copied', `${label} copied to clipboard`);
};

const TABS = [
  { key: 'expiredToday', label: '🔴 Expired Today' },
  { key: 'overdue', label: '🟠 Overdue' },
  { key: 'next7', label: '🟡 Next 7 Days' },
  { key: 'next30', label: '🟢 Next 30 Days' },
  { key: 'renewedToday', label: '🔵 Renewed Today' },
];

const DATE_FILTERS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'next7', label: 'Next 7 Days' },
  { key: 'thisMonth', label: 'This Month' },
  { key: 'lastMonth', label: 'Last Month' },
  { key: 'custom', label: '📅 Custom Date' },
  { key: 'customRange', label: '↔️ Custom Range' },
];

const toISODate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
};
const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
const formatShort = (d) => d.toDateString();

const RenewalScreen = ({ navigation, route }) => {
  const [filterMode, setFilterMode] = useState('bucket'); // 'bucket' | 'dateFilter'
  const [activeTab, setActiveTab] = useState('expiredToday');
  const [dateFilterKey, setDateFilterKey] = useState(null);
  const [customDate, setCustomDate] = useState(new Date());
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [showRangePanel, setShowRangePanel] = useState(false);
  const [customRangeFrom, setCustomRangeFrom] = useState(new Date());
  const [customRangeTo, setCustomRangeTo] = useState(new Date());
  const [showRangeFromPicker, setShowRangeFromPicker] = useState(false);
  const [showRangeToPicker, setShowRangeToPicker] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const getDateFilterParams = useCallback(
    (key) => {
      const today = new Date();
      if (key === 'today') return { date: toISODate(today) };
      if (key === 'tomorrow') return { date: toISODate(addDays(today, 1)) };
      if (key === 'yesterday') return { date: toISODate(addDays(today, -1)) };
      if (key === 'next7') return { from: toISODate(addDays(today, 1)), to: toISODate(addDays(today, 7)) };
      if (key === 'thisMonth') return { from: toISODate(startOfMonth(today)), to: toISODate(endOfMonth(today)) };
      if (key === 'lastMonth') {
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        return { from: toISODate(startOfMonth(lastMonth)), to: toISODate(endOfMonth(lastMonth)) };
      }
      if (key === 'custom') return { date: toISODate(customDate) };
      if (key === 'customRange') return { from: toISODate(customRangeFrom), to: toISODate(customRangeTo) };
      return null;
    },
    [customDate, customRangeFrom, customRangeTo]
  );

  const loadRenewals = useCallback(async () => {
    try {
      const params = filterMode === 'bucket' ? { bucket: activeTab } : getDateFilterParams(dateFilterKey);
      if (!params) {
        setRows([]);
        return;
      }
      const data = await getRenewals(params);
      setRows(data.results || []);
    } catch (error) {
      Alert.alert('Error', 'Could not load renewals. Check backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterMode, activeTab, dateFilterKey, getDateFilterParams]);

  useEffect(() => {
    setLoading(true);
    loadRenewals();
  }, [loadRenewals]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRenewals();
  };

  const handleSelectBucket = (key) => {
    setShowRangePanel(false);
    setFilterMode('bucket');
    setActiveTab(key);
  };

  const handleSelectDateFilter = (key) => {
    if (key === 'customRange') {
      setShowRangePanel((prev) => !prev);
      return;
    }
    setShowRangePanel(false);
    if (key === 'custom') {
      setShowCustomDatePicker(true);
      return;
    }
    setFilterMode('dateFilter');
    setDateFilterKey(key);
  };

  // Entry point for Dashboard's summary cards (e.g. "Today's Renewals" ->
  // initialDateFilter: 'today', "Next 7 Days" -> initialBucket: 'next7') —
  // reuses the exact same selection handlers a manual tap would call, so
  // the resulting filter state is identical either way. Only applied once
  // on arrival; the existing filter chips still work normally afterward.
  useEffect(() => {
    if (route?.params?.initialDateFilter) {
      handleSelectDateFilter(route.params.initialDateFilter);
    } else if (route?.params?.initialBucket) {
      handleSelectBucket(route.params.initialBucket);
    }
  }, [route?.params?.initialDateFilter, route?.params?.initialBucket]);

  const handleCustomDateChange = (event, selectedDate) => {
    setShowCustomDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setCustomDate(selectedDate);
      setFilterMode('dateFilter');
      setDateFilterKey('custom');
    }
  };

  const handleRangeFromChange = (event, selectedDate) => {
    setShowRangeFromPicker(Platform.OS === 'ios');
    if (selectedDate) setCustomRangeFrom(selectedDate);
  };

  const handleRangeToChange = (event, selectedDate) => {
    setShowRangeToPicker(Platform.OS === 'ios');
    if (selectedDate) setCustomRangeTo(selectedDate);
  };

  const handleApplyRange = () => {
    if (customRangeTo < customRangeFrom) {
      Alert.alert('Invalid Range', '"To" date must be on or after "From" date.');
      return;
    }
    setFilterMode('dateFilter');
    setDateFilterKey('customRange');
    setShowRangePanel(false);
  };

  const getFilteredRows = () => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.trim().toLowerCase();
    return rows.filter(
      (r) =>
        r.fullName?.toLowerCase().includes(q) ||
        r.whatsappNumber?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.macAddress?.toLowerCase().includes(q) ||
        r.customerId?.toLowerCase().includes(q)
    );
  };

  const openCustomer = (row) => {
    navigation.navigate('Customers', {
      screen: 'CustomerDetails',
      params: {
        customer: {
          _id: row.customerObjectId,
          customerId: row.customerId,
          fullName: row.fullName,
          whatsappNumber: row.whatsappNumber,
          email: row.email,
        },
      },
    });
  };

  const filteredRows = getFilteredRows();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.topBar, styles.topBarRow]}>
        <View>
          <Text style={styles.topBarTitle}>Renewals</Text>
          <Text style={styles.topBarSubtitle}>{rows.length} in this view</Text>
        </View>
        <NotificationBell />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabRowContent}
      >
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabChip,
              filterMode === 'bucket' && activeTab === tab.key && styles.tabChipActive,
            ]}
            onPress={() => handleSelectBucket(tab.key)}
          >
            <Text
              style={[
                styles.tabChipText,
                filterMode === 'bucket' && activeTab === tab.key && styles.tabChipTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Text style={styles.dateFilterLabel}>Date Filter</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabRow}
        contentContainerStyle={styles.tabRowContent}
      >
        {DATE_FILTERS.map((df) => {
          const isActive =
            filterMode === 'dateFilter' &&
            dateFilterKey === df.key;
          return (
            <TouchableOpacity
              key={df.key}
              style={[styles.tabChip, isActive && styles.tabChipActive]}
              onPress={() => handleSelectDateFilter(df.key)}
            >
              <Text style={[styles.tabChipText, isActive && styles.tabChipTextActive]}>
                {df.key === 'custom' && isActive
                  ? formatShort(customDate)
                  : df.key === 'customRange' && isActive
                  ? `${formatShort(customRangeFrom)} → ${formatShort(customRangeTo)}`
                  : df.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {showCustomDatePicker && (
        <DateTimePicker
          value={customDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleCustomDateChange}
        />
      )}

      {showRangePanel && (
        <View style={styles.rangePanel}>
          <View style={styles.rangeRow}>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>From</Text>
              <TouchableOpacity style={styles.rangeDateButton} onPress={() => setShowRangeFromPicker(true)}>
                <Text style={styles.rangeDateButtonText}>{formatShort(customRangeFrom)}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.rangeField}>
              <Text style={styles.rangeFieldLabel}>To</Text>
              <TouchableOpacity style={styles.rangeDateButton} onPress={() => setShowRangeToPicker(true)}>
                <Text style={styles.rangeDateButtonText}>{formatShort(customRangeTo)}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showRangeFromPicker && (
            <DateTimePicker
              value={customRangeFrom}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleRangeFromChange}
            />
          )}
          {showRangeToPicker && (
            <DateTimePicker
              value={customRangeTo}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleRangeToChange}
            />
          )}

          <TouchableOpacity style={styles.applyRangeButton} onPress={handleApplyRange}>
            <Text style={styles.applyRangeButtonText}>Apply Range</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, email, MAC, or customer ID"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {filteredRows.length === 0 && (
            <Text style={styles.emptyText}>Nothing in this view right now.</Text>
          )}

          {filteredRows.map((row) => (
            <View key={row.subscriptionId} style={styles.card}>
              <TouchableOpacity onPress={() => openCustomer(row)} activeOpacity={0.6}>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardNameCol}>
                    <Text style={styles.nameText}>{row.fullName}</Text>
                    <Text style={styles.idText}>{row.customerId}</Text>
                  </View>
                  <View style={styles.badgeColumn}>
                    {row.priceUSD === 0 && row.trialStatus && row.trialStatus !== 'Pending' && (
                      <View style={[styles.badge, styles.trialBadge]}>
                        <Text style={styles.badgeText}>{row.trialStatus}</Text>
                      </View>
                    )}
                    {row.followUpStatus && row.followUpStatus !== 'Pending' && (
                      <View style={[styles.badge, styles.followUpBadge]}>
                        <Text style={styles.badgeText}>{row.followUpStatus}</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.planText}>
                  {row.plan} {row.priceUSD ? `— $${row.priceUSD}` : '(Trial)'}
                </Text>
                {row.employeeName ? <Text style={styles.employeeText}>Staff: {row.employeeName}</Text> : null}
                <Text style={styles.renewalText}>
                  Renewal: {new Date(row.renewalDate).toDateString()}
                </Text>
              </TouchableOpacity>

              <View style={styles.actionColumn}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => copyToClipboard(row.whatsappNumber, 'Phone number')}
                  activeOpacity={0.6}
                >
                  <Text style={styles.actionButtonIcon}>📞</Text>
                  <Text style={styles.actionButtonLabel}>{row.whatsappNumber}</Text>
                  <Text style={styles.actionButtonHint}>Copy</Text>
                </TouchableOpacity>

                <WhatsAppQuickAction
                  customer={{
                    fullName: row.fullName,
                    whatsappNumber: row.whatsappNumber,
                    activePlan: row.plan,
                    renewalDate: row.renewalDate,
                    panelExpiryDate: row.panelExpiryDate,
                  }}
                />

                {!!row.macAddress && (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => copyToClipboard(row.macAddress, 'MAC Address')}
                    activeOpacity={0.6}
                  >
                    <Text style={styles.actionButtonIcon}>📺</Text>
                    <Text style={styles.actionButtonLabel}>{row.macAddress}</Text>
                    <Text style={styles.actionButtonHint}>Copy</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  topBar: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  topBarTitle: { color: colors.headerText, fontSize: 18, fontWeight: '700' },
  topBarSubtitle: { color: '#c9d8ef', fontSize: 12, marginTop: 2 },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabRowContent: {
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  tabChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  tabChipTextActive: { color: '#ffffff' },
  dateFilterLabel: {
    ...typography.label,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  rangePanel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rangeRow: { flexDirection: 'row', gap: spacing.sm },
  rangeField: { flex: 1 },
  rangeFieldLabel: { ...typography.label, marginBottom: spacing.xs },
  rangeDateButton: {
    ...commonStyles.input,
    minHeight: 44,
    justifyContent: 'center',
  },
  rangeDateButtonText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  applyRangeButton: {
    ...commonStyles.primaryButton,
    marginTop: spacing.sm,
    minHeight: 44,
    justifyContent: 'center',
  },
  applyRangeButtonText: commonStyles.primaryButtonText,
  searchBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  container: { padding: spacing.lg, paddingBottom: 40 },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', marginTop: 40 },
  card: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardNameCol: { flex: 1, paddingRight: spacing.sm },
  nameText: { fontSize: 15, fontWeight: '700', color: colors.text },
  idText: { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' },
  badgeColumn: { alignItems: 'flex-end', maxWidth: '45%', gap: 4 },
  badge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginBottom: 4 },
  trialBadge: { backgroundColor: colors.primaryLight },
  followUpBadge: { backgroundColor: colors.successBg },
  badgeText: { fontSize: 10, fontWeight: '700', color: colors.primary, textAlign: 'right' },
  planText: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  employeeText: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  renewalText: { fontSize: 11, color: colors.textSecondary, marginTop: 2, fontWeight: '600' },
  actionColumn: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionButtonIcon: { fontSize: 16, marginRight: spacing.sm },
  actionButtonLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text },
  actionButtonHint: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginLeft: spacing.sm,
  },
});

export default RenewalScreen;
