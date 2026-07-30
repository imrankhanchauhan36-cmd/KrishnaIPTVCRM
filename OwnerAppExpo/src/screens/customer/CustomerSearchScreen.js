import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { searchCustomer } from '../../services/api';
import PhoneInput from '../../components/PhoneInput';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const CustomerSearchScreen = ({ navigation }) => {
  const [searchMode, setSearchMode] = useState('phone'); // 'phone' | 'email'
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [searching, setSearching] = useState(false);

  const buildQuery = () => {
    if (searchMode === 'email') return email.trim();
    return `${countryCode} ${phoneNumber.trim()}`;
  };

  const handleSearch = async () => {
    const query = buildQuery();
    const hasInput = searchMode === 'email' ? email.trim() : phoneNumber.trim();
    if (!hasInput) return;

    setSearching(true);
    try {
      const result = await searchCustomer(query);
      setSearching(false);

      if (result.exists) {
        navigation.replace('CustomerFound', { customer: result.customer });
      } else {
        navigation.replace('CustomerForm', { prefill: query });
      }
    } catch (error) {
      setSearching(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.subHeader}>
          Search by Phone or Email to check if this customer already exists.
        </Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleChip, searchMode === 'phone' && styles.toggleChipActive]}
            onPress={() => setSearchMode('phone')}
          >
            <Text style={[styles.toggleChipText, searchMode === 'phone' && styles.toggleChipTextActive]}>
              📞 Phone
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleChip, searchMode === 'email' && styles.toggleChipActive]}
            onPress={() => setSearchMode('email')}
          >
            <Text style={[styles.toggleChipText, searchMode === 'email' && styles.toggleChipTextActive]}>
              📧 Email
            </Text>
          </TouchableOpacity>
        </View>

        {searchMode === 'phone' ? (
          <PhoneInput
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            phoneNumber={phoneNumber}
            onPhoneNumberChange={setPhoneNumber}
          />
        ) : (
          <TextInput
            style={styles.input}
            placeholder="e.g. customer@gmail.com"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        )}

        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} disabled={searching}>
          {searching ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.headerBg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + spacing.md : spacing.md,
  },
  topBarLink: { color: colors.headerText, fontSize: 14, width: 60 },
  topBarTitle: { color: colors.headerText, fontSize: 16, fontWeight: '700' },
  container: { padding: spacing.lg, paddingTop: spacing.xl },
  subHeader: { ...typography.bodyMuted, marginBottom: spacing.lg, lineHeight: 18 },
  toggleRow: { flexDirection: 'row', marginBottom: spacing.lg },
  toggleChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: spacing.sm,
  },
  toggleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleChipText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  toggleChipTextActive: { color: '#ffffff' },
  input: { ...commonStyles.input, marginBottom: spacing.lg },
  searchButton: { ...commonStyles.primaryButton, marginTop: spacing.lg },
  searchButtonText: commonStyles.primaryButtonText,
});

export default CustomerSearchScreen;
