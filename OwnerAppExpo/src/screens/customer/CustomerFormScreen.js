import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getPlans, getActiveEmployees, getActivePortals, createCustomer, updateCustomer, deleteCustomer } from '../../services/api';
import PhoneInput from '../../components/PhoneInput';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const formatDateDisplay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const month = months[d.getMonth()];
  const year = String(d.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
};

// Must match PhoneInput.js's COUNTRY_CODES list. The canonical stored format
// (buildCanonicalPhone on the backend) is always "+<code><digits>" with no
// space, so splitting on a greedy "\d{1,4}" after "+" mis-parses any code
// shorter than 4 digits (e.g. "+19998887799" -> "+1999"/"8887799" instead of
// "+1"/"9998887799") — match against the real known codes first instead.
const KNOWN_COUNTRY_CODES = ['+1', '+91', '+44', '+971', '+61', '+92', '+880', '+27', '+65', '+974'];

const parseWhatsapp = (fullNumber) => {
  if (!fullNumber) return { code: '+1', number: '' };
  const knownMatch = [...KNOWN_COUNTRY_CODES]
    .sort((a, b) => b.length - a.length)
    .find((code) => fullNumber.startsWith(code));
  if (knownMatch) {
    return { code: knownMatch, number: fullNumber.slice(knownMatch.length).trim() };
  }
  const match = fullNumber.match(/^(\+\d{1,4})\s?(.*)$/);
  if (match) return { code: match[1], number: match[2] };
  return { code: '+1', number: fullNumber };
};

const DateField = ({ label, value, onChange }) => {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event, selectedDate) => {
    setShowPicker(Platform.OS === 'ios');
    if (selectedDate) {
      onChange(selectedDate.toISOString());
    }
  };

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
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

const PlanSelector = ({ plans, selectedPlan, onChange }) => {
  if (plans.length === 0) {
    return (
      <Text style={styles.noPlansNote}>
        No plans found. Go to Settings → Plans to create one first.
      </Text>
    );
  }

  return (
    <View>
      <Text style={styles.label}>Plan *</Text>
      <View style={styles.planRow}>
        {plans.map((p) => (
          <TouchableOpacity
            key={p._id}
            style={[styles.planChip, selectedPlan?._id === p._id && styles.planChipActive]}
            onPress={() => onChange(p)}
          >
            <Text style={[styles.planChipText, selectedPlan?._id === p._id && styles.planChipTextActive]}>
              {p.name} ({p.durationValue} {p.durationType})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const EmployeeSelector = ({ employees, selectedEmployee, onChange }) => {
  if (employees.length === 0) {
    return (
      <Text style={styles.noPlansNote}>
        No employees found. Go to Settings → Employees to add one first.
      </Text>
    );
  }

  return (
    <View>
      <Text style={styles.label}>Employee</Text>
      <View style={styles.planRow}>
        <TouchableOpacity
          style={[styles.planChip, !selectedEmployee && styles.planChipActive]}
          onPress={() => onChange(null)}
        >
          <Text style={[styles.planChipText, !selectedEmployee && styles.planChipTextActive]}>None</Text>
        </TouchableOpacity>
        {employees.map((e) => (
          <TouchableOpacity
            key={e._id}
            style={[styles.planChip, selectedEmployee?._id === e._id && styles.planChipActive]}
            onPress={() => onChange(e)}
          >
            <Text style={[styles.planChipText, selectedEmployee?._id === e._id && styles.planChipTextActive]}>
              {e.employeeName}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const PortalSelector = ({ portals, selectedPortal, onChange }) => {
  if (portals.length === 0) {
    return (
      <Text style={styles.noPlansNote}>
        No portals found. Go to Settings → Portal URLs to add one first.
      </Text>
    );
  }

  return (
    <View>
      <Text style={styles.label}>Portal URL</Text>
      <View style={styles.planRow}>
        <TouchableOpacity
          style={[styles.planChip, !selectedPortal && styles.planChipActive]}
          onPress={() => onChange(null)}
        >
          <Text style={[styles.planChipText, !selectedPortal && styles.planChipTextActive]}>None</Text>
        </TouchableOpacity>
        {portals.map((p) => (
          <TouchableOpacity
            key={p._id}
            style={[styles.planChip, selectedPortal?._id === p._id && styles.planChipActive]}
            onPress={() => onChange(p)}
          >
            <Text style={[styles.planChipText, selectedPortal?._id === p._id && styles.planChipTextActive]}>
              {p.portalUrl}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const CustomerFormScreen = ({ route, navigation }) => {
  const existingCustomer = route.params?.existingCustomer || null;
  const prefill = route.params?.prefill || '';
  const isEditing = !!existingCustomer;
  const prefillIsEmail = prefill && prefill.includes('@');
  const existingParsed = parseWhatsapp(existingCustomer?.whatsappNumber);
  // The search screen composes its query as "{countryCode} {number}" (see
  // CustomerSearchScreen.buildQuery), so it must be parsed the same way
  // existing customers are — otherwise the whole "+91 9876543210" string
  // lands in the number field alone and produces a doubled country code
  // on save (e.g. "+1 +91 9876543210").
  const prefillParsed = !isEditing && prefill && !prefillIsEmail ? parseWhatsapp(prefill) : null;

  const [fullName, setFullName] = useState(existingCustomer?.fullName || '');
  const [email, setEmail] = useState(
    existingCustomer?.email || (prefillIsEmail ? prefill : '') || ''
  );
  const [countryCode, setCountryCode] = useState(
    isEditing ? existingParsed.code : (prefillParsed?.code || '+1')
  );
  const [phoneNumber, setPhoneNumber] = useState(
    isEditing ? existingParsed.number : (prefillParsed?.number || '')
  );
  const [macAddress, setMacAddress] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [startingDate, setStartingDate] = useState(new Date().toISOString());
  const [panelAddedDays, setPanelAddedDays] = useState('');
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [portals, setPortals] = useState([]);
  const [selectedPortal, setSelectedPortal] = useState(null);

  useEffect(() => {
    if (!isEditing) {
      getPlans()
        .then(setPlans)
        .catch(() => Alert.alert('Error', 'Could not load plans.'));
      getActiveEmployees()
        .then(setEmployees)
        .catch(() => {});
      getActivePortals()
        .then(setPortals)
        .catch(() => {});
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (!fullName || !phoneNumber) {
      Alert.alert('Missing info', 'Full Name and WhatsApp Number are required.');
      return;
    }

    if (!isEditing && (!selectedPlan || !startingDate)) {
      Alert.alert('Missing info', 'Plan and Starting Date are required.');
      return;
    }

    // The country picker is the source of truth and the backend owns the
    // final canonical format — send its raw parts as-is and let the server
    // combine/clean them the same way for every client (see
    // resolveCanonicalWhatsapp / buildCanonicalPhone on the backend).
    const customerData = {
      ...(existingCustomer?._id ? { _id: existingCustomer._id } : {}),
      fullName,
      email,
      countryCode,
      phoneNumber,
      status: existingCustomer?.status || 'Active',
      ...(!isEditing && {
        macAddress,
        plan: selectedPlan.name,
        planId: selectedPlan._id,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        priceUSD: selectedPlan.priceUSD,
        startingDate,
        panelAddedDays,
        employeeId: selectedEmployee?._id,
        employeeName: selectedEmployee?.employeeName,
        portalId: selectedPortal?._id,
        portalUrl: selectedPortal?.portalUrl,
      }),
    };

    try {
      if (customerData._id) {
        await updateCustomer(customerData._id, customerData);
      } else {
        await createCustomer(customerData);
      }
      navigation.navigate('CustomerList');
    } catch (error) {
      if (error.status === 409) {
        Alert.alert(
          'Customer Already Exists',
          `${error.customer?.fullName || 'This customer'} (${error.customer?.customerId}) already has this email or WhatsApp number.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Customer',
              onPress: () => navigation.replace('CustomerDetails', { customer: error.customer }),
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Could not save customer.');
      }
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Customer',
      `Are you sure you want to delete ${fullName}? This will also delete their devices and subscriptions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteCustomer(existingCustomer._id);
            navigation.navigate('CustomerList');
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {isEditing && (
          <View style={styles.idBadge}>
            <Text style={styles.idBadgeLabel}>Customer ID</Text>
            <Text style={styles.idBadgeValue}>{existingCustomer.customerId}</Text>
          </View>
        )}

        {!isEditing && (
          <Text style={styles.autoIdNote}>A unique Customer ID will be generated automatically.</Text>
        )}

        <Text style={styles.sectionTitle}>Basic Info</Text>

        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Mr Siddhartha Patel"
          placeholderTextColor={colors.textMuted}
          value={fullName}
          onChangeText={setFullName}
        />

        <Text style={styles.label}>WhatsApp Number *</Text>
        <PhoneInput
          countryCode={countryCode}
          onCountryCodeChange={setCountryCode}
          phoneNumber={phoneNumber}
          onPhoneNumberChange={setPhoneNumber}
        />

        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. sid1992123@gmail.com"
          placeholderTextColor={colors.textMuted}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {!isEditing && (
          <>
            <Text style={styles.sectionTitle}>Device</Text>
            <Text style={styles.label}>MAC Address</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 00:1A:79:F2:11:4F"
              placeholderTextColor={colors.textMuted}
              value={macAddress}
              onChangeText={setMacAddress}
              autoCapitalize="characters"
            />

            <Text style={styles.sectionTitle}>Subscription & Panel</Text>

            <PlanSelector plans={plans} selectedPlan={selectedPlan} onChange={setSelectedPlan} />

            {selectedPlan && (
              <Text style={styles.selectedPlanNote}>
                Selected: {selectedPlan.name} — ${selectedPlan.priceUSD}
              </Text>
            )}

            <DateField label="Starting Date *" value={startingDate} onChange={setStartingDate} />

            <Text style={styles.label}>Panel Added Days (extra days beyond plan)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 0"
              placeholderTextColor={colors.textMuted}
              value={panelAddedDays}
              onChangeText={setPanelAddedDays}
              keyboardType="number-pad"
            />

            <Text style={styles.autoIdNote}>
              Renewal Date and Panel Expiry Date will be calculated automatically based on the plan and starting date.
            </Text>

            <EmployeeSelector employees={employees} selectedEmployee={selectedEmployee} onChange={setSelectedEmployee} />

            <PortalSelector portals={portals} selectedPortal={selectedPortal} onChange={setSelectedPortal} />
          </>
        )}

        <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
          <Text style={styles.saveButtonText}>{isEditing ? 'Update Customer' : 'Save Customer'}</Text>
        </TouchableOpacity>

        {isEditing && (
          <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
            <Text style={styles.deleteButtonText}>Delete Customer</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 40 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
  },
  autoIdNote: {
    fontSize: 12,
    color: colors.textSecondary,
    backgroundColor: colors.primaryLight,
    padding: spacing.sm + 2,
    borderRadius: 6,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  noPlansNote: {
    fontSize: 12,
    color: colors.danger,
    backgroundColor: colors.dangerBg,
    padding: spacing.sm + 2,
    borderRadius: 6,
    marginTop: spacing.md,
  },
  selectedPlanNote: {
    fontSize: 12,
    color: colors.success,
    marginTop: 6,
    fontWeight: '600',
  },
  idBadge: {
    ...commonStyles.card,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  idBadgeLabel: { ...typography.label },
  idBadgeValue: { fontSize: 16, color: colors.text, fontWeight: '700', marginTop: 2 },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { ...commonStyles.input, marginBottom: spacing.sm },
  planRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  planChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  planChipText: { color: colors.textSecondary, fontSize: 13 },
  planChipTextActive: { color: '#ffffff', fontWeight: '600' },
  saveButton: { ...commonStyles.primaryButton, marginTop: spacing.xl },
  saveButtonText: commonStyles.primaryButtonText,
  deleteButton: {
    backgroundColor: colors.dangerBg,
    borderRadius: 6,
    paddingVertical: 13,
    marginTop: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  deleteButtonText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
});

export default CustomerFormScreen;
