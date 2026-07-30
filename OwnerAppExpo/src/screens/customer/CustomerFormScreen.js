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
import { getPlans, createCustomer, updateCustomer, deleteCustomer } from '../../services/api';
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

const parseWhatsapp = (fullNumber) => {
  if (!fullNumber) return { code: '+1', number: '' };
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

const CustomerFormScreen = ({ route, navigation }) => {
  const existingCustomer = route.params?.existingCustomer || null;
  const prefill = route.params?.prefill || '';
  const isEditing = !!existingCustomer;
  const prefillIsEmail = prefill && prefill.includes('@');
  const existingParsed = parseWhatsapp(existingCustomer?.whatsappNumber);

  const [fullName, setFullName] = useState(existingCustomer?.fullName || '');
  const [email, setEmail] = useState(
    existingCustomer?.email || (prefillIsEmail ? prefill : '') || ''
  );
  const [countryCode, setCountryCode] = useState(existingParsed.code);
  const [phoneNumber, setPhoneNumber] = useState(
    existingParsed.number || (!prefillIsEmail ? prefill : '') || ''
  );
  const [macAddress, setMacAddress] = useState('');
  const [plans, setPlans] = useState([]);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [startingDate, setStartingDate] = useState(new Date().toISOString());
  const [panelAddedDays, setPanelAddedDays] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [portalUrl, setPortalUrl] = useState('');

  useEffect(() => {
    if (!isEditing) {
      getPlans()
        .then(setPlans)
        .catch(() => Alert.alert('Error', 'Could not load plans.'));
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

    const fullWhatsapp = `${countryCode} ${phoneNumber}`;

    const customerData = {
      ...(existingCustomer?._id ? { _id: existingCustomer._id } : {}),
      fullName,
      email,
      whatsappNumber: fullWhatsapp,
      status: existingCustomer?.status || 'Active',
      ...(!isEditing && {
        macAddress,
        plan: selectedPlan.name,
        durationType: selectedPlan.durationType,
        durationValue: selectedPlan.durationValue,
        priceUSD: selectedPlan.priceUSD,
        startingDate,
        panelAddedDays,
        employeeName,
        portalUrl,
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
          `${error.customer?.fullName || 'This customer'} (${error.customer?.customerId}) already has this email or WhatsApp number.`
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

            <Text style={styles.label}>Employee Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Abhi"
              placeholderTextColor={colors.textMuted}
              value={employeeName}
              onChangeText={setEmployeeName}
            />

            <Text style={styles.label}>Portal URL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://smart4k.me"
              placeholderTextColor={colors.textMuted}
              value={portalUrl}
              onChangeText={setPortalUrl}
              autoCapitalize="none"
            />
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
