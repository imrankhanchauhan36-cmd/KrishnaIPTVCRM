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
import { useFocusEffect } from '@react-navigation/native';
import * as Clipboard from 'expo-clipboard';
import { getCustomers, addPanelDays } from '../../services/api';
import { colors, spacing, typography } from '../../theme/theme';
import WhatsAppQuickAction from '../../components/WhatsAppQuickAction';
import NotificationBell from '../../components/NotificationBell';

const copyToClipboard = async (text, label) => {
  if (!text) return;
  await Clipboard.setStringAsync(text);
  Alert.alert('Copied', `${label} copied to clipboard`);
};

const CustomerListScreen = ({ navigation, route }) => {
  const [customers, setCustomers] = useState([]);
  const [sortBy, setSortBy] = useState('panelExpiry');
  const [statusFilter, setStatusFilter] = useState('all');
  const [planFilter, setPlanFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [expiringFilter, setExpiringFilter] = useState('all');
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [panelDaysInputs, setPanelDaysInputs] = useState({});
  const [addingPanelFor, setAddingPanelFor] = useState(null);
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Entry point for Dashboard's "Expired Customers" / "Active Customers"
  // cards — applies the same status filter a manual chip tap would.
  useEffect(() => {
    if (route?.params?.initialStatusFilter) {
      setStatusFilter(route.params.initialStatusFilter);
    }
  }, [route?.params?.initialStatusFilter]);

  const loadCustomers = useCallback(async () => {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load customers. Check backend connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadCustomers();
    }, [loadCustomers])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadCustomers();
  };

  const handleQuickAddPanelDays = async (customer) => {
    const days = panelDaysInputs[customer._id];
    if (!days || Number(days) <= 0) {
      Alert.alert('Missing info', 'Please enter a valid number of days.');
      return;
    }
    if (!customer.activeSubscriptionId) {
      Alert.alert('No Subscription', 'This customer has no active subscription to add days to.');
      return;
    }
    try {
      const result = await addPanelDays(customer.activeSubscriptionId, Number(days));
      Alert.alert('Panel Days Added', result.message);
      setPanelDaysInputs((prev) => ({ ...prev, [customer._id]: '' }));
      setAddingPanelFor(null);
      loadCustomers();
    } catch (error) {
      Alert.alert('Error', 'Could not add panel days.');
    }
  };

  const getFilteredSortedCustomers = () => {
    let result = [...customers];

    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.whatsappNumber?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.macAddress?.toLowerCase().includes(q) ||
          c.customerId?.toLowerCase().includes(q)
      );
    }

    if (planFilter !== 'all') {
      result = result.filter((c) => c.activePlan === planFilter);
    }

    if (employeeFilter !== 'all') {
      result = result.filter((c) => c.employeeName === employeeFilter);
    }

    if (expiringFilter !== 'all') {
      const now = new Date();
      const days = expiringFilter === '7' ? 7 : 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + days);
      result = result.filter((c) => {
        if (!c.panelExpiryDate) return false;
        const expiry = new Date(c.panelExpiryDate);
        return expiry >= now && expiry <= cutoff;
      });
    }

    if (sortBy === 'panelExpiry') {
      result.sort((a, b) => {
        if (!a.panelExpiryDate) return 1;
        if (!b.panelExpiryDate) return -1;
        return new Date(a.panelExpiryDate) - new Date(b.panelExpiryDate);
      });
    } else if (sortBy === 'renewal') {
      result.sort((a, b) => {
        if (!a.renewalDate) return 1;
        if (!b.renewalDate) return -1;
        return new Date(a.renewalDate) - new Date(b.renewalDate);
      });
    } else if (sortBy === 'nameAsc') {
      result.sort((a, b) => a.fullName.localeCompare(b.fullName));
    } else if (sortBy === 'nameDesc') {
      result.sort((a, b) => b.fullName.localeCompare(a.fullName));
    } else if (sortBy === 'newest') {
      result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    return result;
  };

  const uniquePlans = [...new Set(customers.map((c) => c.activePlan).filter(Boolean))];
  const uniqueEmployees = [...new Set(customers.map((c) => c.employeeName).filter(Boolean))];

  const allFiltered = getFilteredSortedCustomers();
  const displayedCustomers = allFiltered.slice(0, visibleCount);
  const hasMore = allFiltered.length > visibleCount;

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.topBarTitle}>Customers</Text>
          <Text style={styles.topBarSubtitle}>{customers.length} total</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBell />
          <TouchableOpacity
            style={[styles.addButton, { marginRight: 8, marginLeft: 8 }]}
            onPress={() => setShowFilterPanel(!showFilterPanel)}
          >
            <Text style={styles.addButtonText}>{showFilterPanel ? 'Hide' : 'Filters'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CustomerSearch')}
          >
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {showFilterPanel && (
        <View style={styles.advancedFilterPanel}>
          <Text style={styles.filterSectionLabel}>Plan</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, planFilter === 'all' && styles.filterChipActive]}
              onPress={() => setPlanFilter('all')}
            >
              <Text style={[styles.filterChipText, planFilter === 'all' && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {uniquePlans.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.filterChip, planFilter === p && styles.filterChipActive]}
                onPress={() => setPlanFilter(p)}
              >
                <Text style={[styles.filterChipText, planFilter === p && styles.filterChipTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Employee</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterChip, employeeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setEmployeeFilter('all')}
            >
              <Text style={[styles.filterChipText, employeeFilter === 'all' && styles.filterChipTextActive]}>All</Text>
            </TouchableOpacity>
            {uniqueEmployees.map((e) => (
              <TouchableOpacity
                key={e}
                style={[styles.filterChip, employeeFilter === e && styles.filterChipActive]}
                onPress={() => setEmployeeFilter(e)}
              >
                <Text style={[styles.filterChipText, employeeFilter === e && styles.filterChipTextActive]}>{e}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterSectionLabel}>Expiring</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'all', label: 'All' },
              { key: '7', label: 'Next 7 Days' },
              { key: '30', label: 'Next 30 Days' },
            ].map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.filterChip, expiringFilter === opt.key && styles.filterChipActive]}
                onPress={() => setExpiringFilter(opt.key)}
              >
                <Text style={[styles.filterChipText, expiringFilter === opt.key && styles.filterChipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={styles.filterBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, phone, email, or MAC address"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {[
            { key: 'panelExpiry', label: 'Panel Expiry' },
            { key: 'renewal', label: 'Renewal Date' },
            { key: 'nameAsc', label: 'Name A-Z' },
            { key: 'nameDesc', label: 'Name Z-A' },
            { key: 'newest', label: 'Newest' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterChip, sortBy === opt.key && styles.filterChipActive]}
              onPress={() => setSortBy(opt.key)}
            >
              <Text style={[styles.filterChipText, sortBy === opt.key && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
          {[
            { key: 'all', label: 'All' },
            { key: 'Active', label: 'Active' },
            { key: 'Expired', label: 'Expired' },
          ].map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.filterChip, statusFilter === opt.key && styles.filterChipActiveAlt]}
              onPress={() => setStatusFilter(opt.key)}
            >
              <Text style={[styles.filterChipText, statusFilter === opt.key && styles.filterChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {displayedCustomers.length === 0 && (
          <Text style={styles.emptyText}>No customers yet. Tap "+ Add" to create one.</Text>
        )}

        {displayedCustomers.map((c, index) => (
          <View
            key={c._id}
            style={[styles.customerCard, index % 2 === 1 && { backgroundColor: colors.tableRowAlt }]}
          >
            <TouchableOpacity onPress={() => navigation.navigate('CustomerDetails', { customer: c })}>
              <View style={styles.cardTopRow}>
                <View>
                  <Text style={styles.nameText}>{c.fullName}</Text>
                  <Text style={styles.idText}>{c.customerId}</Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: c.status === 'Active' ? colors.successBg : colors.dangerBg },
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      { color: c.status === 'Active' ? colors.success : colors.danger },
                    ]}
                  >
                    {c.status}
                  </Text>
                </View>
              </View>
              {c.activePlan && <Text style={styles.planText}>Plan: {c.activePlan}</Text>}
              {c.renewalDate && (
                <Text style={styles.renewalText}>
                  Renewal: {new Date(c.renewalDate).toDateString()}
                </Text>
              )}
              {c.panelExpiryDate && (
                <Text style={styles.panelExpiryText}>
                  Panel Expiry: {new Date(c.panelExpiryDate).toDateString()}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.copyRow}
              onPress={() => copyToClipboard(c.whatsappNumber, 'Phone number')}
            >
              <Text style={styles.copyIcon}>📞</Text>
              <Text style={styles.copyText}>{c.whatsappNumber}</Text>
              <Text style={styles.copyHint}>Tap to copy</Text>
            </TouchableOpacity>

            <WhatsAppQuickAction customer={c} />

            {!!c.email && (
              <TouchableOpacity
                style={styles.copyRow}
                onPress={() => copyToClipboard(c.email, 'Email')}
              >
                <Text style={styles.copyIcon}>📧</Text>
                <Text style={styles.copyText}>{c.email}</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>
            )}

            {!!c.macAddress && (
              <TouchableOpacity
                style={styles.copyRow}
                onPress={() => copyToClipboard(c.macAddress, 'MAC Address')}
              >
                <Text style={styles.copyIcon}>📺</Text>
                <Text style={styles.copyText}>{c.macAddress}</Text>
                <Text style={styles.copyHint}>Tap to copy</Text>
              </TouchableOpacity>
            )}

            {c.activeSubscriptionId && (
              <>
                <TouchableOpacity
                  style={styles.quickPanelButton}
                  onPress={() =>
                    setAddingPanelFor(addingPanelFor === c._id ? null : c._id)
                  }
                >
                  <Text style={styles.quickPanelButtonText}>
                    {addingPanelFor === c._id ? 'Cancel' : '+ Add Panel Days'}
                  </Text>
                </TouchableOpacity>

                {addingPanelFor === c._id && (
                  <View style={styles.quickPanelRow}>
                    <TextInput
                      style={styles.quickPanelInput}
                      placeholder="Days e.g. 30"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      value={panelDaysInputs[c._id] || ''}
                      onChangeText={(val) =>
                        setPanelDaysInputs((prev) => ({ ...prev, [c._id]: val }))
                      }
                    />
                    <TouchableOpacity
                      style={styles.quickPanelSubmit}
                      onPress={() => handleQuickAddPanelDays(c)}
                    >
                      <Text style={styles.quickPanelSubmitText}>Add</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            )}
          </View>
        ))}

        {hasMore && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((prev) => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({allFiltered.length - visibleCount} remaining)
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center' },
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
  topBarSubtitle: { color: '#c9d8ef', fontSize: 12, marginTop: 2 },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  container: { padding: spacing.lg, paddingBottom: 40 },
  customerCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  nameText: { fontSize: 15, fontWeight: '700', color: colors.text },
  idText: { fontSize: 11, color: colors.primary, marginTop: 2, fontWeight: '600' },
  planText: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  renewalText: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  copyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
  },
  copyIcon: { fontSize: 13, marginRight: 6 },
  copyText: { flex: 1, fontSize: 13, color: colors.text },
  copyHint: { fontSize: 10, color: colors.textMuted, fontStyle: 'italic' },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', marginTop: 40 },
  searchInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
    marginBottom: 8,
  },
  filterBar: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterChipActiveAlt: { backgroundColor: colors.success, borderColor: colors.success },
  filterChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  filterChipTextActive: { color: '#ffffff' },
  advancedFilterPanel: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterSectionLabel: {
    ...typography.label,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  quickPanelButton: {
    marginTop: 8,
    borderRadius: 6,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  quickPanelButtonText: { color: colors.success, fontWeight: '600', fontSize: 12 },
  quickPanelRow: { flexDirection: 'row', marginTop: 8, gap: 8 },
  quickPanelInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.text,
  },
  quickPanelSubmit: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  quickPanelSubmitText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  loadMoreButton: {
    marginTop: spacing.md,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  loadMoreText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
});

export default CustomerListScreen;
