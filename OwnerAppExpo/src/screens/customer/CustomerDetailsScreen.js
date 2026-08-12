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
  getActiveEmployees,
  getActivePortals,
  addPanelDays,
  updateSubscriptionStatus,
  assignDeviceToSubscription,
  getCustomerNotes,
  createCustomerNote,
  getCustomerTimeline,
} from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import WhatsAppQuickAction from '../../components/WhatsAppQuickAction';

const TABS = ['Overview', 'Subscription', 'Notes', 'Timeline'];
const FOLLOW_UP_CHIPS = ['Call Today', 'WhatsApp Today', 'No Response', 'Call Back Tomorrow'];

// Local accent colors for timeline event types the shared theme doesn't
// define (orange/purple) — kept muted to match the app's existing sober
// palette rather than introducing bright new tones.
const EVENT_META = {
  customer_created: { icon: '🟢', color: colors.success, bg: colors.successBg },
  customer_updated: { icon: '🔵', color: colors.primary, bg: colors.primaryLight },
  phone_changed: { icon: '🔴', color: colors.danger, bg: colors.dangerBg },
  customer_archived: { icon: '⚫', color: colors.textMuted, bg: colors.surfaceAlt },
  device_added: { icon: '🟢', color: colors.success, bg: colors.successBg },
  device_updated: { icon: '🔵', color: colors.primary, bg: colors.primaryLight },
  mac_changed: { icon: '🔴', color: colors.danger, bg: colors.dangerBg },
  device_removed: { icon: '🔴', color: colors.danger, bg: colors.dangerBg },
  trial_started: { icon: '🟠', color: '#b45309', bg: '#fef3e0' },
  subscription_created: { icon: '🟢', color: colors.success, bg: colors.successBg },
  trial_converted: { icon: '🟢', color: colors.success, bg: colors.successBg },
  plan_changed: { icon: '🟠', color: '#b45309', bg: '#fef3e0' },
  price_changed: { icon: '🟠', color: '#b45309', bg: '#fef3e0' },
  subscription_renewed: { icon: '🟢', color: colors.success, bg: colors.successBg },
  subscription_removed: { icon: '🔴', color: colors.danger, bg: colors.dangerBg },
  panel_days_added: { icon: '🔵', color: colors.primary, bg: colors.primaryLight },
  followup_status_changed: { icon: '🔵', color: colors.primary, bg: colors.primaryLight },
  note_added: { icon: '🟣', color: '#6b46c1', bg: '#f2edfc' },
};
const DEFAULT_EVENT_META = { icon: '⚪', color: colors.textMuted, bg: colors.surfaceAlt };

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
  const [showAddDeviceForm, setShowAddDeviceForm] = useState(false);
  const [newDeviceMac, setNewDeviceMac] = useState('');
  const [newDeviceName, setNewDeviceName] = useState('');

  const [plans, setPlans] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [portals, setPortals] = useState([]);
  // A customer can have several concurrent Active subscriptions (one per
  // device), so "which one is being renewed" is tracked by id rather than
  // a single global flag.
  const [renewTargetId, setRenewTargetId] = useState(null);
  const [showAddSubForm, setShowAddSubForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedPortal, setSelectedPortal] = useState(null);
  const [subStartingDate, setSubStartingDate] = useState(new Date().toISOString());
  const [subPanelAddedDays, setSubPanelAddedDays] = useState('');
  // Same reasoning as renewTargetId: which subscription's "+ Add Panel Days"
  // form is open, since a customer can have several Active subscriptions.
  const [panelDaysTargetId, setPanelDaysTargetId] = useState(null);
  const [panelDaysToAdd, setPanelDaysToAdd] = useState('');
  const [panelDaysMessage, setPanelDaysMessage] = useState('');
  // Which subscription's "Assign Device" picker is open — the one-time
  // repair flow for subscriptions created before device-linking existed.
  const [assignDeviceTargetId, setAssignDeviceTargetId] = useState(null);
  const [notes, setNotes] = useState([]);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [timeline, setTimeline] = useState([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [timelineLoaded, setTimelineLoaded] = useState(false);

  useEffect(() => {
    getPlans().then(setPlans).catch(() => {});
    getActiveEmployees().then(setEmployees).catch(() => {});
    getActivePortals().then(setPortals).catch(() => {});
  }, []);

  // Timeline is read-only and additive on top of the profile load — fetched
  // lazily the first time its tab is opened rather than on every screen
  // visit, since most visits won't check it.
  useEffect(() => {
    if (activeTab !== 'Timeline' || timelineLoaded) return;
    setTimelineLoading(true);
    getCustomerTimeline(customer._id)
      .then((data) => {
        setTimeline(data || []);
        setTimelineLoaded(true);
      })
      .catch(() => Alert.alert('Error', 'Could not load timeline.'))
      .finally(() => setTimelineLoading(false));
  }, [activeTab, timelineLoaded, customer._id]);

  const loadProfile = useCallback(async () => {
    try {
      const [data, notesData] = await Promise.all([
        getCustomerProfile(customer._id),
        getCustomerNotes(customer._id).catch(() => []),
      ]);
      setDevices(data.devices || []);
      setSubscriptions(data.subscriptions || []);
      setActivityLog(data.activityLog || []);
      setNotes(notesData || []);
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

  // Adding a device on its own must never touch subscription state — this
  // calls the plain device-creation endpoint directly, not the subscription
  // flow, so it works regardless of whether the customer already has an
  // active subscription.
  const handleAddDevice = async () => {
    if (!newDeviceMac.trim()) {
      Alert.alert('Missing info', 'MAC Address is required.');
      return;
    }
    try {
      await createDevice({
        customer: customer._id,
        macAddress: newDeviceMac.trim(),
        deviceName: newDeviceName.trim(),
      });
      setNewDeviceMac('');
      setNewDeviceName('');
      setShowAddDeviceForm(false);
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not add device.');
    }
  };

  // A customer can have multiple concurrent Active subscriptions (e.g. one
  // per device), so every Active one gets its own card rather than only
  // ever showing the first match.
  const activeSubscriptions = subscriptions.filter((s) => s.status === 'Active');
  // subscriptions is already sorted newest-first by the backend, so [0] is
  // the latest regardless of status. A customer whose latest subscription
  // has already expired must still be able to renew from it — Renew must
  // not depend on an Active subscription existing.
  const latestSubscription = subscriptions[0];
  const subscriptionToRenew = subscriptions.find((s) => s._id === renewTargetId) || null;
  const showRenewForm = !!renewTargetId;
  // A customer can run several concurrent subscriptions (one per device);
  // this is the only way to tell which physical device a given subscription
  // card belongs to. Resolved purely from the existing device reference on
  // the subscription — nothing about the device is duplicated or re-stored.
  // Only populated for subscriptions created or renewed after this field was
  // added — older records resolve to undefined and the UI shows "No Device
  // Linked" for those, rather than guessing.
  const deviceForSub = (sub) => devices.find((d) => d._id === sub.device);
  const latestSubscriptionDevice = latestSubscription ? deviceForSub(latestSubscription) : null;
  // Same shape as the customer list's WhatsApp data (activePlan/renewalDate/
  // panelExpiryDate all sourced from an Active subscription only, never
  // Expired) — keeps the two screens' message templates identical.
  const whatsappCustomerData = {
    fullName: customer.fullName,
    whatsappNumber: customer.whatsappNumber,
    activePlan: activeSubscriptions[0]?.plan || null,
    renewalDate: activeSubscriptions[0]?.renewalDate || null,
    panelExpiryDate: activeSubscriptions[0]?.panelExpiryDate || null,
  };

  const resetSubForm = () => {
    setSelectedPlan(null);
    setSelectedEmployee(null);
    setSelectedPortal(null);
    setSubStartingDate(new Date().toISOString());
    setSubPanelAddedDays('');
    setSubMacAddress('');
    setRenewTargetId(null);
    setShowAddSubForm(false);
  };

  const handleSaveRenew = async () => {
    if (!selectedPlan) {
      Alert.alert('Missing info', 'Please select a plan.');
      return;
    }
    try {
      await renewSubscription({
        oldSubscriptionId: subscriptionToRenew?._id,
        customer: customer._id,
        plan: selectedPlan.name,
        planId: selectedPlan._id,
        priceUSD: selectedPlan.priceUSD,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        startingDate: subStartingDate,
        panelAddedDays: subPanelAddedDays,
        employeeId: selectedEmployee?._id,
        employeeName: selectedEmployee?.employeeName,
        portalId: selectedPortal?._id,
        portalUrl: selectedPortal?.portalUrl,
        macAddress: subMacAddress,
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
        planId: selectedPlan._id,
        priceUSD: selectedPlan.priceUSD,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        startingDate: subStartingDate,
        panelAddedDays: subPanelAddedDays,
        macAddress: subMacAddress,
        employeeId: selectedEmployee?._id,
        employeeName: selectedEmployee?.employeeName,
        portalId: selectedPortal?._id,
        portalUrl: selectedPortal?.portalUrl,
      });
      resetSubForm();
      loadProfile();
    } catch (error) {
      if (error.status === 409) {
        Alert.alert(
          'Already Has an Active Subscription',
          error.message || 'This customer already has an active subscription. Use Renew instead.'
        );
      } else {
        Alert.alert('Error', 'Could not add subscription.');
      }
    }
  };

  const handleSetFollowUpStatus = async (subscriptionId, followUpStatus) => {
    try {
      await updateSubscriptionStatus(subscriptionId, { followUpStatus });
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not update follow-up status.');
    }
  };

  const handleMarkTrialLost = (subscriptionId) => {
    Alert.alert('Mark Trial as Lost', 'This trial will be marked as lost. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Mark Lost',
        style: 'destructive',
        onPress: async () => {
          try {
            await updateSubscriptionStatus(subscriptionId, { trialStatus: 'Lost', followUpStatus: 'Lost' });
            loadProfile();
          } catch (error) {
            Alert.alert('Error', 'Could not update trial status.');
          }
        },
      },
    ]);
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    setSavingNote(true);
    try {
      await createCustomerNote({ customer: customer._id, note: newNoteText.trim() });
      setNewNoteText('');
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not save note.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddPanelDaysSubmit = async (subscriptionId) => {
    if (!panelDaysToAdd || Number(panelDaysToAdd) <= 0) {
      Alert.alert('Missing info', 'Please enter a valid number of days.');
      return;
    }
    try {
      const result = await addPanelDays(subscriptionId, Number(panelDaysToAdd));
      setPanelDaysMessage(result.message);
      setPanelDaysToAdd('');
      setPanelDaysTargetId(null);
      loadProfile();
      Alert.alert('Panel Days Added', result.message);
    } catch (error) {
      Alert.alert('Error', 'Could not add panel days.');
    }
  };

  // One-time repair for a subscription that predates device-linking — the
  // operator picks the exact device once, from this customer's own devices
  // only; nothing is ever inferred automatically.
  const handleAssignDevice = async (subscriptionId, deviceId) => {
    try {
      await assignDeviceToSubscription(subscriptionId, deviceId);
      setAssignDeviceTargetId(null);
      loadProfile();
    } catch (error) {
      Alert.alert('Error', 'Could not assign device.');
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
        <WhatsAppQuickAction customer={whatsappCustomerData} />
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
          <View>
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
          </View>
        )}

        {activeTab === 'Subscription' && (
          <View>
            {activeSubscriptions.map((sub) => {
              const dev = deviceForSub(sub);
              return (
              <View key={sub._id} style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.success }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{sub.plan} — ${sub.priceUSD}</Text>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>Starting: {new Date(sub.startingDate).toDateString()}</Text>
                <Text style={styles.cardMeta}>Panel Added Days: {sub.panelAddedDays || 0}</Text>
                <Text style={styles.cardMeta}>Renewal Date: {new Date(sub.renewalDate).toDateString()}</Text>
                <Text style={styles.cardMeta}>Panel Expiry: {new Date(sub.panelExpiryDate).toDateString()}</Text>
                {dev ? (
                  <>
                    <Text style={styles.cardMeta}>Device Name: {dev.deviceName || dev.deviceType}</Text>
                    <Text style={styles.cardMeta}>MAC Address: {dev.macAddress}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardMeta}>Device: Not Assigned</Text>
                    <TouchableOpacity
                      style={styles.addPanelDaysButton}
                      onPress={() => setAssignDeviceTargetId(assignDeviceTargetId === sub._id ? null : sub._id)}
                    >
                      <Text style={styles.addPanelDaysButtonText}>
                        {assignDeviceTargetId === sub._id ? 'Cancel' : 'Assign Device'}
                      </Text>
                    </TouchableOpacity>
                    {assignDeviceTargetId === sub._id && (
                      devices.length === 0 ? (
                        <Text style={styles.hintNote}>No devices yet for this customer — add one below first.</Text>
                      ) : (
                        <View style={styles.planRow}>
                          {devices.map((d) => (
                            <TouchableOpacity
                              key={d._id}
                              style={styles.planChip}
                              onPress={() => handleAssignDevice(sub._id, d._id)}
                            >
                              <Text style={styles.planChipText}>{d.deviceName || d.deviceType} — {d.macAddress}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )
                    )}
                  </>
                )}
                <View style={styles.panelDaysRow}>
                  <Text style={styles.cardMeta}>
                    Renewal (subscription): {new Date(sub.renewalDate).toDateString()}
                  </Text>
                </View>

                {(sub.trialStatus && sub.trialStatus !== 'Pending') ||
                (sub.followUpStatus && sub.followUpStatus !== 'Pending') ? (
                  <View style={styles.trialStatusRow}>
                    {sub.trialStatus && sub.trialStatus !== 'Pending' && (
                      <View style={styles.trialStatusBadge}>
                        <Text style={styles.trialStatusBadgeText}>{sub.trialStatus}</Text>
                      </View>
                    )}
                    {sub.followUpStatus && sub.followUpStatus !== 'Pending' && (
                      <View style={styles.followUpStatusBadge}>
                        <Text style={styles.followUpStatusBadgeText}>{sub.followUpStatus}</Text>
                      </View>
                    )}
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.renewButton}
                  onPress={() => { setRenewTargetId(sub._id); setSubMacAddress(dev?.macAddress || ''); setShowAddSubForm(false); }}
                >
                  <Text style={styles.renewButtonText}>
                    {sub.priceUSD === 0 ? 'Convert to Paid' : 'Renew Subscription'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addPanelDaysButton}
                  onPress={() => setPanelDaysTargetId(panelDaysTargetId === sub._id ? null : sub._id)}
                >
                  <Text style={styles.addPanelDaysButtonText}>
                    {panelDaysTargetId === sub._id ? 'Cancel' : '+ Add Panel Days'}
                  </Text>
                </TouchableOpacity>

                {panelDaysTargetId === sub._id && (
                  <View style={styles.panelDaysForm}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 30"
                      placeholderTextColor={colors.textMuted}
                      value={panelDaysToAdd}
                      onChangeText={setPanelDaysToAdd}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity style={styles.saveSmallButton} onPress={() => handleAddPanelDaysSubmit(sub._id)}>
                      <Text style={styles.saveSmallButtonText}>Add Days</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {sub.trialStatus !== 'Converted' && sub.trialStatus !== 'Lost' && (
                  <>
                    <Text style={styles.followUpLabel}>Follow-up Status</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.followUpChipRow}>
                      {FOLLOW_UP_CHIPS.map((label) => (
                        <TouchableOpacity
                          key={label}
                          style={[
                            styles.followUpChip,
                            sub.followUpStatus === label && styles.followUpChipActive,
                          ]}
                          onPress={() => handleSetFollowUpStatus(sub._id, label)}
                        >
                          <Text
                            style={[
                              styles.followUpChipText,
                              sub.followUpStatus === label && styles.followUpChipTextActive,
                            ]}
                          >
                            {label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    {sub.priceUSD === 0 && (
                      <TouchableOpacity
                        style={styles.markLostButton}
                        onPress={() => handleMarkTrialLost(sub._id)}
                      >
                        <Text style={styles.markLostButtonText}>Mark Trial Lost</Text>
                      </TouchableOpacity>
                    )}
                  </>
                )}
              </View>
              );
            })}

            {activeSubscriptions.length === 0 && latestSubscription && (
              <View style={[styles.card, { borderLeftWidth: 3, borderLeftColor: colors.textMuted }]}>
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{latestSubscription.plan} — ${latestSubscription.priceUSD}</Text>
                  <View style={styles.expiredBadge}>
                    <Text style={styles.expiredBadgeText}>{latestSubscription.status.toUpperCase()}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>Panel Added Days: {latestSubscription.panelAddedDays || 0}</Text>
                <Text style={styles.cardMeta}>Renewal Date: {new Date(latestSubscription.renewalDate).toDateString()}</Text>
                <Text style={styles.cardMeta}>Panel Expiry: {new Date(latestSubscription.panelExpiryDate).toDateString()}</Text>
                {latestSubscriptionDevice ? (
                  <>
                    <Text style={styles.cardMeta}>Device Name: {latestSubscriptionDevice.deviceName || latestSubscriptionDevice.deviceType}</Text>
                    <Text style={styles.cardMeta}>MAC Address: {latestSubscriptionDevice.macAddress}</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.cardMeta}>Device: Not Assigned</Text>
                    <TouchableOpacity
                      style={styles.addPanelDaysButton}
                      onPress={() => setAssignDeviceTargetId(assignDeviceTargetId === latestSubscription._id ? null : latestSubscription._id)}
                    >
                      <Text style={styles.addPanelDaysButtonText}>
                        {assignDeviceTargetId === latestSubscription._id ? 'Cancel' : 'Assign Device'}
                      </Text>
                    </TouchableOpacity>
                    {assignDeviceTargetId === latestSubscription._id && (
                      devices.length === 0 ? (
                        <Text style={styles.hintNote}>No devices yet for this customer — add one below first.</Text>
                      ) : (
                        <View style={styles.planRow}>
                          {devices.map((d) => (
                            <TouchableOpacity
                              key={d._id}
                              style={styles.planChip}
                              onPress={() => handleAssignDevice(latestSubscription._id, d._id)}
                            >
                              <Text style={styles.planChipText}>{d.deviceName || d.deviceType} — {d.macAddress}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )
                    )}
                  </>
                )}

                <TouchableOpacity
                  style={styles.renewButton}
                  onPress={() => { setRenewTargetId(latestSubscription._id); setSubMacAddress(latestSubscriptionDevice?.macAddress || ''); setShowAddSubForm(false); }}
                >
                  <Text style={styles.renewButtonText}>
                    {latestSubscription.priceUSD === 0 ? 'Convert to Paid' : 'Renew Subscription'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {!latestSubscription && (
              <Text style={styles.emptyText}>No active subscription. Add one below.</Text>
            )}

            {(showRenewForm || showAddSubForm) && (
              <View style={styles.inlineForm}>
                <Text style={styles.formTitle}>
                  {showRenewForm
                    ? subscriptionToRenew?.priceUSD === 0
                      ? 'Convert to Paid'
                      : 'Renew Subscription'
                    : 'Add Another Subscription'}
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

                <Text style={styles.label}>Employee</Text>
                <View style={styles.planRow}>
                  <TouchableOpacity
                    style={[styles.planChip, !selectedEmployee && styles.planChipActive]}
                    onPress={() => setSelectedEmployee(null)}
                  >
                    <Text style={[styles.planChipText, !selectedEmployee && styles.planChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {employees.map((e) => (
                    <TouchableOpacity
                      key={e._id}
                      style={[styles.planChip, selectedEmployee?._id === e._id && styles.planChipActive]}
                      onPress={() => setSelectedEmployee(e)}
                    >
                      <Text style={[styles.planChipText, selectedEmployee?._id === e._id && styles.planChipTextActive]}>
                        {e.employeeName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Portal URL</Text>
                <View style={styles.planRow}>
                  <TouchableOpacity
                    style={[styles.planChip, !selectedPortal && styles.planChipActive]}
                    onPress={() => setSelectedPortal(null)}
                  >
                    <Text style={[styles.planChipText, !selectedPortal && styles.planChipTextActive]}>None</Text>
                  </TouchableOpacity>
                  {portals.map((p) => (
                    <TouchableOpacity
                      key={p._id}
                      style={[styles.planChip, selectedPortal?._id === p._id && styles.planChipActive]}
                      onPress={() => setSelectedPortal(p)}
                    >
                      <Text style={[styles.planChipText, selectedPortal?._id === p._id && styles.planChipTextActive]}>
                        {p.portalUrl}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>
                  {showRenewForm ? 'MAC Address (device for this subscription)' : 'MAC Address (new device)'}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 00:1A:79:F2:11:4F"
                  placeholderTextColor={colors.textMuted}
                  value={subMacAddress}
                  onChangeText={setSubMacAddress}
                  autoCapitalize="characters"
                />
                {showRenewForm && (
                  <Text style={styles.hintNote}>
                    Already correct? Leave as is. Known MACs are reused — this won't create a duplicate device.
                  </Text>
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
                    {showRenewForm
                      ? subscriptionToRenew?.priceUSD === 0
                        ? 'Confirm Conversion'
                        : 'Confirm Renewal'
                      : 'Save Subscription'}
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
                {subscriptions.filter((s) => s.status !== 'Active').map((s) => {
                  // The single "no active subscriptions at all" card above already
                  // features the latest one with its own Renew button — skip a
                  // second, redundant one here for that specific subscription.
                  // Every other past subscription (the common case: this one
                  // expired while sibling devices' subscriptions are still
                  // Active) gets its own Renew button, which it never had before.
                  const alreadyFeaturedAtTop = activeSubscriptions.length === 0 && s._id === latestSubscription?._id;
                  const dev = deviceForSub(s);
                  return (
                    <View key={s._id} style={styles.card}>
                      <View style={styles.cardHeaderRow}>
                        <Text style={styles.cardTitle}>{s.plan} — ${s.priceUSD}</Text>
                        <View style={styles.expiredBadge}>
                          <Text style={styles.expiredBadgeText}>{s.status.toUpperCase()}</Text>
                        </View>
                      </View>
                      <Text style={styles.cardMeta}>Starting: {new Date(s.startingDate).toDateString()}</Text>
                      <Text style={styles.cardMeta}>Panel Added Days: {s.panelAddedDays || 0}</Text>
                      <Text style={styles.cardMeta}>Renewal Date: {new Date(s.renewalDate).toDateString()}</Text>
                      <Text style={styles.cardMeta}>Panel Expiry: {new Date(s.panelExpiryDate).toDateString()}</Text>
                      {dev ? (
                        <>
                          <Text style={styles.cardMeta}>Device Name: {dev.deviceName || dev.deviceType}</Text>
                          <Text style={styles.cardMeta}>MAC Address: {dev.macAddress}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.cardMeta}>Device: Not Assigned</Text>
                          <TouchableOpacity
                            style={styles.addPanelDaysButton}
                            onPress={() => setAssignDeviceTargetId(assignDeviceTargetId === s._id ? null : s._id)}
                          >
                            <Text style={styles.addPanelDaysButtonText}>
                              {assignDeviceTargetId === s._id ? 'Cancel' : 'Assign Device'}
                            </Text>
                          </TouchableOpacity>
                          {assignDeviceTargetId === s._id && (
                            devices.length === 0 ? (
                              <Text style={styles.hintNote}>No devices yet for this customer — add one below first.</Text>
                            ) : (
                              <View style={styles.planRow}>
                                {devices.map((d) => (
                                  <TouchableOpacity
                                    key={d._id}
                                    style={styles.planChip}
                                    onPress={() => handleAssignDevice(s._id, d._id)}
                                  >
                                    <Text style={styles.planChipText}>{d.deviceName || d.deviceType} — {d.macAddress}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>
                            )
                          )}
                        </>
                      )}
                      {!alreadyFeaturedAtTop && (
                        <TouchableOpacity
                          style={styles.renewButton}
                          onPress={() => { setRenewTargetId(s._id); setSubMacAddress(dev?.macAddress || ''); setShowAddSubForm(false); }}
                        >
                          <Text style={styles.renewButtonText}>
                            {s.priceUSD === 0 ? 'Convert to Paid' : 'Renew Subscription'}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity onPress={() => handleDeleteSubscription(s._id)}>
                        <Text style={styles.deleteLink}>Delete</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </>
            )}

            <Text style={styles.historySectionTitle}>Devices</Text>
            <Text style={styles.hintNote}>Tap a device to edit its MAC address or name.</Text>

            {showAddDeviceForm ? (
              <View style={styles.card}>
                <Text style={styles.label}>Device Name (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Device Name"
                  placeholderTextColor={colors.textMuted}
                  value={newDeviceName}
                  onChangeText={setNewDeviceName}
                />
                <Text style={styles.label}>MAC Address *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 00:1A:79:F2:11:4F"
                  placeholderTextColor={colors.textMuted}
                  value={newDeviceMac}
                  onChangeText={setNewDeviceMac}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.saveSmallButton} onPress={handleAddDevice}>
                  <Text style={styles.saveSmallButtonText}>Save Device</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.cancelSmallButton}
                  onPress={() => {
                    setShowAddDeviceForm(false);
                    setNewDeviceMac('');
                    setNewDeviceName('');
                  }}
                >
                  <Text style={styles.cancelSmallButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addSmallButton} onPress={() => setShowAddDeviceForm(true)}>
                <Text style={styles.addSmallButtonText}>+ Add Device</Text>
              </TouchableOpacity>
            )}

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
                  <View>
                    <TouchableOpacity onPress={() => handleStartEditDevice(d)}>
                      <Text style={styles.cardTitle}>{d.deviceName || d.deviceType}</Text>
                      <Text style={styles.cardMeta}>MAC: {d.macAddress}</Text>
                      <Text style={styles.editHint}>Tap to edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteDevice(d._id)}>
                      <Text style={styles.deleteLink}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Notes' && (
          <View>
            <View style={styles.addNoteRow}>
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder="Add a note — e.g. called, no answer"
                placeholderTextColor={colors.textMuted}
                value={newNoteText}
                onChangeText={setNewNoteText}
                multiline
              />
              <TouchableOpacity
                style={[styles.saveSmallButton, styles.addNoteButton]}
                onPress={handleAddNote}
                disabled={savingNote}
              >
                <Text style={styles.saveSmallButtonText}>{savingNote ? '...' : 'Add'}</Text>
              </TouchableOpacity>
            </View>

            {notes.length === 0 && <Text style={styles.emptyText}>No notes yet.</Text>}
            {notes.map((n) => (
              <View key={n._id} style={styles.card}>
                <Text style={styles.cardTitle}>{n.note}</Text>
                <Text style={styles.cardMeta}>
                  {new Date(n.createdAt).toLocaleString()} — {n.createdByName}
                </Text>
              </View>
            ))}
          </View>
        )}

        {activeTab === 'Timeline' && (
          <View>
            {timelineLoading && (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.lg }} />
            )}

            {!timelineLoading && timeline.length === 0 && (
              <Text style={styles.emptyText}>No history recorded yet.</Text>
            )}

            {!timelineLoading &&
              timeline.map((event, index) => {
                const meta = EVENT_META[event.type] || DEFAULT_EVENT_META;
                const createdAt = new Date(event.createdAt);
                return (
                  <View key={`${event.type}-${event.createdAt}-${index}`} style={styles.timelineCard}>
                    <View style={styles.timelineHeaderRow}>
                      <View style={[styles.timelineIconDot, { backgroundColor: meta.bg }]}>
                        <Text style={styles.timelineIconText}>{meta.icon}</Text>
                      </View>
                      <Text style={[styles.timelineTitle, { color: meta.color }]}>{event.title}</Text>
                    </View>
                    <Text style={styles.timelineDate}>
                      {createdAt.toDateString()} · {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {!!event.performedBy && (
                      <Text style={styles.timelinePerformedBy}>By {event.performedBy}</Text>
                    )}
                    {!!event.description && (
                      <Text style={styles.timelineDescription}>{event.description}</Text>
                    )}
                  </View>
                );
              })}
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
  trialStatusRow: { flexDirection: 'row', marginTop: spacing.sm, gap: 6 },
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
  followUpLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  followUpChipRow: { flexDirection: 'row' },
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
  addNoteRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md, alignItems: 'flex-start' },
  noteInput: { flex: 1, marginBottom: 0, minHeight: 44 },
  addNoteButton: { paddingHorizontal: spacing.lg },
  timelineCard: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  timelineHeaderRow: { flexDirection: 'row', alignItems: 'center' },
  timelineIconDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  timelineIconText: { fontSize: 13 },
  timelineTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  timelineDate: { fontSize: 11, color: colors.textMuted, marginTop: 6, marginLeft: 36 },
  timelinePerformedBy: { fontSize: 11, color: colors.textSecondary, marginTop: 2, marginLeft: 36 },
  timelineDescription: { fontSize: 12, color: colors.text, marginTop: 6, marginLeft: 36 },
});

export default CustomerDetailsScreen;