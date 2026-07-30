import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { colors, spacing } from '../theme/theme';

const COUNTRY_CODES = [
  { code: '+1', country: 'USA/Canada' },
  { code: '+91', country: 'India' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+61', country: 'Australia' },
  { code: '+92', country: 'Pakistan' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+27', country: 'South Africa' },
  { code: '+65', country: 'Singapore' },
  { code: '+974', country: 'Qatar' },
];

const PhoneInput = ({ countryCode, onCountryCodeChange, phoneNumber, onPhoneNumberChange }) => {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <View style={styles.row}>
      <TouchableOpacity style={styles.codeButton} onPress={() => setShowPicker(true)}>
        <Text style={styles.codeButtonText}>{countryCode}</Text>
        <Text style={styles.codeArrow}>▾</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.numberInput}
        placeholder="9876543210"
        placeholderTextColor={colors.textMuted}
        value={phoneNumber}
        onChangeText={onPhoneNumberChange}
        keyboardType="number-pad"
      />

      <Modal visible={showPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Select Country Code</Text>
            <ScrollView>
              {COUNTRY_CODES.map((item) => (
                <TouchableOpacity
                  key={item.code}
                  style={styles.modalRow}
                  onPress={() => {
                    onCountryCodeChange(item.code);
                    setShowPicker(false);
                  }}
                >
                  <Text style={styles.modalRowCode}>{item.code}</Text>
                  <Text style={styles.modalRowCountry}>{item.country}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: spacing.sm,
  },
  codeButtonText: { color: colors.text, fontSize: 14, fontWeight: '600', marginRight: 4 },
  codeArrow: { color: colors.textMuted, fontSize: 10 },
  numberInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.lg,
    maxHeight: 400,
  },
  modalTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.md },
  modalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowCode: { fontWeight: '700', color: colors.primary, width: 60 },
  modalRowCountry: { color: colors.textSecondary },
});

export default PhoneInput;
