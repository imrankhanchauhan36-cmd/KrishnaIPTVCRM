import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getCustomerProfile,
  createDevice,
  updateDevice,
  deleteDevice,
  createSubscription,
  renewSubscription,
  deleteSubscription,
  getPlans,
  addPanelDays,
} from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const TABS = ['Overview', 'Devices', 'Subscriptions', 'History'];

const formatDateDisplay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return day + month + year;
};

const SubDateField = ({ value, onChange, colors, styles }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      onChange(selectedDate.toISOString());
    }
  };

  return (
    <View>
      <Text style={styles.label}>Starting Date *</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowPicker(true)}>
        <Text style={{ color: value ? colors.text : colors.textMuted }}>
          {value ? formatDateDisplay(value) : 'Select date'}
        </Text>
      </TouchableOpacity>
      {showPicker && (
        <DateTimePicker
          value={value ? new Date(value) : new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
        />
      )}
    </View>
  );
};

const CustomerDetailsScreen = ({ route, navigation }) => {
  const { customer } = route.params;
  const [activeTab, setActiveTab] = useState('Overview');
  const [devices, setDevices] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingDeviceId, setEditingDeviceId] = useState(null);
  const [editMac, setEditMac] = useState('');
  const [editDeviceName, setEditDeviceName] = useState('');
  const [subMacAddress, setSubMacAddress] = useState('');

  const [plans, setPlans] = useState([]);
  const [showRenewForm, setShowRenewForm] = useState(false);
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [subStartingDate, setSubStartingDate] = useState(new Date().toISOString());
  const [subPanelAddedDays, setSubPanelAddedDays] = useState('');
  const [showAddPanelDays, setShowAddPanelDays] = useState(false);
  const [panelDaysToAdd, setPanelDaysToAdd] = useState('');
  const [panelDaysMessage, setPanelDaysMessage] = useState('');

  useEffect(() => {
    getPlans().then(setPlans).catch(() => {});
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const data = await getCustomerProfile(customer._id);
      setDevices(data.devices || []);
      setSubscriptions(data.subscriptions || []);
      setActivityLog(data.activityLog || []);
    } catch (error) {
      Alert.alert('Error', 'Could not load customer profile.');
    } finally {
      setLoading(false);
    }
  }, [customer._id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleStartEditDevice = (device) => {
    setEditingDeviceId(device._id);
    setEditMac(device.macAddress);
    setEditDeviceName(device.deviceName || '');
  };

  const handleSaveEditDevice = async () => {
    if (!editMac) {
      Alert.alert('Missing info', 'MAC Address is required.');
      return;
    }
    try {
      await updateDevice(editingDeviceId, { macAddress: editMac, deviceName: editDeviceName });
      setEditingDeviceId(null);
      setEditMac('');
      setEditDeviceName('');
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not update device.');
    }
  };

  const handleCancelEditDevice = () => {
    setEditingDeviceId(null);
    setEditMac('');
    setEditDeviceName('');
  };

  const handleDeleteDevice = (id) => {

    Alert.alert('Delete Device', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDevice(id);
          loadProfile();
        },
      },
    ]);
  };

  const activeSubscription = subscriptions.find((s) => s.status === 'Active');

  const resetSubForm = () => {
    setSelectedPlan(null);
    setSubStartingDate(new Date().toISOString());
    setSubPanelAddedDays('');
    setSubMacAddress('');
    setShowRenewForm(false);
    setShowAddSubForm(false);
  };

  const handleSaveRenew = async () => {
    if (!selectedPlan) {
      Alert.alert('Missing info', 'Please select a plan.');
      return;
    }
    try {
      await renewSubscription({
        oldSubscriptionId: activeSubscription?._id,
        customer: customer._id,
        plan: selectedPlan.name,
        priceUSD: selectedPlan.priceUSD,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        startingDate: subStartingDate,
        panelAddedDays: subPanelAddedDays,
      });
      resetSubForm();
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not renew subscription.');
    }
  };

  const handleSaveAddSubscription = async () => {
    if (!selectedPlan) {
      Alert.alert('Missing info', 'Please select a plan.');
      return;
    }
    try {
      await createSubscription({
        customer: customer._id,
        plan: selectedPlan.name,
        priceUSD: selectedPlan.priceUSD,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        startingDate: subStartingDate,
        panelAddedDays: subPanelAddedDays,
        macAddress: subMacAddress,
      });
      resetSubForm();
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not add subscription.');
    }
  };

  const handleAddPanelDaysSubmit = async () => {
    if (!panelDaysToAdd || Number(panelDaysToAdd) <= 0) {
      Alert.alert('Missing info', 'Please enter a valid number of days.');
      return;
    }
    try {
      const result = await addPanelDays(activeSubscription._id, Number(panelDaysToAdd));
      setPanelDaysMessage(result.message);
      setPanelDaysToAdd('');
      setShowAddPanelDays(false);
      loadProfile();
      Alert.alert('Panel Days Added', result.message);
    } catch (error) {
      Alert.alert('Error', 'Could not add panel days.');
    }
  };

  const handleDeleteSubscription = (id) => {
    Alert.alert('Delete Subscription', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSubscription(id);
          loadProfile();
        },
      },
    ]);
  };

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
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.topBarLink}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('CustomerForm', { existingCustomer: customer })}>
          <Text style={styles.topBarLink}>Edit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.profileHeader}>
        <Text style={styles.name}>{customer.fullName}</Text>
        <Text style={styles.customerId}>{customer.customerId}</Text>
        <Text style={styles.contact}>{customer.whatsappNumber}</Text>
        {!!customer.email && <Text style={styles.contact}>{customer.email}</Text>}
      </View>

      <View style={styles.tabBar}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.tabContent}>
        {activeTab === 'Overview' && (
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{devices.length}</Text>
              <Text style={styles.statLabel}>Devices</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{subscriptions.length}</Text>
              <Text style={styles.statLabel}>Subscriptions</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statValue}>{customer.status}</Text>
              <Text style={styles.statLabel}>Status</Text>
            </View>
          </View>
        )}

        {activeTab === 'Devices' && (
          <View>
            <Text style={styles.hintNote}>Tap a device to edit its MAC address or name.</Text>

            {devices.length === 0 && (
              <Text style={styles.emptyText}>
                No devices yet. Devices are added when you create a subscription.
              </Text>
            )}

            {devices.map((d) => (
              <View key={d._id} style={styles.card}>
                {editingDeviceId === d._id ? (
                  <View>
                    <Text style={styles.label}>Device Name (optional)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="Device Name"
                      placeholderTextColor={colors.textMuted}
                      value={editDeviceName}
                      onChangeText={setEditDeviceName}
                    />
                    <Text style={styles.label}>MAC Address *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="MAC Address"
                      placeholderTextColor={colors.textMuted}
                      value={editMac}
                      onChangeText={setEditMac}
                      autoCapitalize="characters"
                    />
                    <TouchableOpacity style={styles.saveSmallButton} onPress={handleSaveEditDevice}>
                      <Text style={styles.saveSmallButtonText}>Save Changes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelSmallButton} onPress={handleCancelEditDevice}>
                      <Text style={styles.cancelSmallButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={() => handleStartEditDevice(d)}>
                    <Text style={styles.cardTitle}>{d.deviceName || d.deviceType}</Text>
                    <Text style={styles.cardMeta}>MAC: {d.macAddress}</Text>
                    <Text style={styles.editHint}>Tap to edit</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}


        {activeTab === 'Subscriptions' && (
          <View>
            {activeSubscription && (
              <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.success }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{activeSubscription.plan} — ${activeSubscription.priceUSD}</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>Starting: {new Date(activeSubscription.startingDate).toDateString()}</Text>
                <Text style={styles.cardMeta}>Panel Added Days: {activeSubscription.panelAddedDays || 0}</Text>
                <Text style={styles.cardMeta}>Renewal Date: {new Date(activeSubscription.renewalDate).toDateString()}</Text>
                <Text style={styles.cardMeta}>Panel Expiry: {new Date(activeSubscription.panelExpiryDate).toDateString()}</Text>
                <View style={styles.panelDaysRow}>
                  <Text style={styles.cardMeta}>
                    Renewal (subscription): {new Date(activeSubscription.renewalDate).toDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.renewButton}
                  onPress={() => { setShowRenewForm(true); setShowAddSubForm(false); }}
                >
                  <Text style={styles.renewButtonText}>Renew Subscription</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPanelDaysButton}
                  onPress={() => setShowAddPanelDays(!showAddPanelDays)}
                >
                  <Text style={styles.addPanelDaysButtonText}>
                    {showAddPanelDays ? 'Cancel' : '+ Add Panel Days'}
                  </Text>
                </TouchableOpacity>

                {showAddPanelDays && (
                  <View style={styles.panelDaysForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 30"
                      placeholderTextColor={colors.textMuted}
                      value={panelDaysToAdd}
                      onChangeText={setPanelDaysToAdd}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity style={styles.saveSmallButton} onPress={handleAddPanelDaysSubmit}>
                      <Text style={styles.saveSmallButtonText}>Add Days</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {!activeSubscription && (
              <Text style={styles.emptyText}>No active subscription. Add one below.</Text>
            )}

            {(showRenewForm || showAddSubForm) && (
              <View style={styles.inlineForm}>
                <Text style={styles.formTitle}>
                  {showRenewForm ? 'Renew Subscription' : 'Add Another Subscription'}
                </Text>

                <Text style={styles.label}>Plan *</Text>
                <View style={styles.planRow}>
                  {plans.map((p) => (
                    <TouchableOpacity
                      key={p._id}
                      style={[styles.planChip, selectedPlan?._id === p._id && styles.planChipActive]}
                      onPress={() => setSelectedPlan(p)}
                    >
                      <Text style={[styles.planChipText, selectedPlan?._id === p._id && styles.planChipTextActive]}>
                        {p.name} ({p.durationValue} {p.durationType})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {showAddSubForm && (
                  <>
                    <Text style={styles.label}>MAC Address (new device)</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 00:1A:79:F2:11:4F"
                      placeholderTextColor={colors.textMuted}
                      value={subMacAddress}
                      onChangeText={setSubMacAddress}
                      autoCapitalize="characters"
                    />
                  </>
                )}

                <SubDateField
                  value={subStartingDate}
                  onChange={setSubStartingDate}
                  colors={colors}
                  styles={styles}
                />

                <Text style={styles.label}>Panel Added Days</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 0"
                  placeholderTextColor={colors.textMuted}
                  value={subPanelAddedDays}
                  onChangeText={setSubPanelAddedDays}
                  keyboardType="number-pad"
                />

                <TouchableOpacity
                  style={styles.saveSmallButton}
                  onPress={showRenewForm ? handleSaveRenew : handleSaveAddSubscription}
                >
                  <Text style={styles.saveSmallButtonText}>
                    {showRenewForm ? 'Confirm Renewal' : 'Save Subscription'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelSmallButton} onPress={resetSubForm}>
                  <Text style={styles.cancelSmallButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {!showRenewForm && !showAddSubForm && (
              <TouchableOpacity
                style={styles.addSmallButton}
                onPress={() => { setShowAddSubForm(true); setShowRenewForm(false); }}
              >
                <Text style={styles.addSmallButtonText}>+ Add Another Subscription</Text>
              </TouchableOpacity>
            )}

            {subscriptions.filter((s) => s.status !== 'Active').length > 0 && (
              <>
                <Text style={styles.historySectionTitle}>Past Subscriptions</Text>
                {subscriptions.filter((s) => s.status !== 'Active').map((s) => (
                  <View key={s._id} style={styles.card}>
                    <View style={styles.cardHeaderRow}>
                      <Text style={styles.cardTitle}>{s.plan} — ${s.priceUSD}</Text>
                      <View style={styles.expiredBadge}>
                        <Text style={styles.expiredBadgeText}>{s.status.toUpperCase()}</Text>
                      </View>
                    </View>
                    <Text style={styles.cardMeta}>Starting: {new Date(s.startingDate).toDateString()}</Text>
                    <Text style={styles.cardMeta}>Renewal Date: {new Date(s.renewalDate).toDateString()}</Text>
                    <Text style={styles.cardMeta}>Panel Expiry: {new Date(s.panelExpiryDate).toDateString()}</Text>
                    <TouchableOpacity onPress={() => handleDeleteSubscription(s._id)}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {activeTab === 'History' && (
          <View>
            {activityLog.length === 0 && (
              <Text style={styles.emptyText}>No activity recorded yet.</Text>
            )}
            {activityLog.map((log) => (
              <View key={log._id} style={styles.historyItem}>
                <View style={styles.historyDot} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyAction}>{log.action}</Text>
                  {!!log.description && (
                    <Text style={styles.historyDesc}>{log.description}</Text>
                  )}
                  <Text style={styles.historyDate}>
                    {new Date(log.createdAt).toLocaleString()} — {log.performedByName}
                  </Text>
                </View>
              </View>
            ))}
          </View>
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
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarLink: { color: colors.headerText, fontSize: 14, fontWeight: '600' },
  profileHeader: {
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
  },
  name: { fontSize: 20, fontWeight: '700', color: '#ffffff' },
  customerId: { fontSize: 12, color: '#c9d8ef', fontWeight: '600', marginTop: 2 },
  contact: { fontSize: 12, color: '#c9d8ef', marginTop: 2 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingVertical: spacing.md, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  tabText: { color: colors.textMuted, fontSize: 13 },
  tabTextActive: { color: colors.primary, fontWeight: '700' },
  tabContent: { padding: spacing.lg, paddingBottom: 40 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statBox: {
    flex: 1,
    ...commonStyles.card,
    padding: spacing.md,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  statValue: { color: colors.text, fontSize: 18, fontWeight: '700' },
  statLabel: { ...typography.label, marginTop: 4 },
  addSmallButton: {
    borderRadius: 6,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  addSmallButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  inlineForm: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  input: { ...commonStyles.input, marginBottom: spacing.sm },
  saveSmallButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  saveSmallButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', marginTop: 20 },
  card: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  cardMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  deleteLink: { color: colors.danger, fontSize: 13, marginTop: spacing.sm, fontWeight: '600' },
  historyItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  historyAction: { fontSize: 13, fontWeight: '700', color: colors.text },
  historyDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  historyDate: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activeBadge: {
    backgroundColor: colors.successBg,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  activeBadgeText: { color: colors.success, fontSize: 10, fontWeight: '700' },
  expiredBadge: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  expiredBadgeText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
  renewButton: {
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  renewButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  formTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.sm },
  planChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planChipText: { color: colors.textSecondary, fontSize: 12 },
  planChipTextActive: { color: '#ffffff', fontWeight: '600' },
  cancelSmallButton: { paddingVertical: 10, alignItems: 'center', marginTop: spacing.xs },
  cancelSmallButtonText: { color: colors.textSecondary, fontSize: 13 },
  historySectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  panelDaysRow: { marginBottom: 4 },
  addPanelDaysButton: {
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
    backgroundColor: colors.successBg,
  },
  addPanelDaysButtonText: { color: colors.success, fontWeight: '600', fontSize: 13 },
  panelDaysForm: { marginTop: spacing.sm },
  hintNote: { ...typography.bodyMuted, marginBottom: spacing.md, fontSize: 12 },
  editHint: { color: colors.primary, fontSize: 11, marginTop: 6, fontWeight: '600' },
});

export default CustomerDetailsScreen;