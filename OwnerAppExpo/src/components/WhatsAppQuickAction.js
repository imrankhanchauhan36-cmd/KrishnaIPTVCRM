import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Alert } from 'react-native';
import { colors, spacing } from '../theme/theme';
import { buildWhatsAppUrl, normalizePhoneForWhatsApp, WHATSAPP_MESSAGE_TEMPLATES } from '../utils/whatsapp';

// Compact WhatsApp quick action: tap the button to reveal a small template
// selector (matching the existing Assign-Device / Plan-selector chip-row
// pattern used elsewhere in this app), pick a template, and WhatsApp opens
// with the correct number and message already filled in — the operator
// still has to press Send inside WhatsApp themselves. Nothing is sent,
// marked as sent, or recorded as delivered by this component.
//
// `customer` is a plain object: { fullName, whatsappNumber, activePlan,
// renewalDate, panelExpiryDate } — the same shape already returned by
// getCustomers() and easily derived from CustomerDetailsScreen's own state.
const WhatsAppQuickAction = ({ customer }) => {
  const [showSelector, setShowSelector] = useState(false);
  const hasValidPhone = !!normalizePhoneForWhatsApp(customer?.whatsappNumber);
  const availableTemplates = WHATSAPP_MESSAGE_TEMPLATES.filter((t) => t.isAvailable(customer || {}));

  const handleSelectTemplate = (template) => {
    const message = template.build(customer);
    const url = buildWhatsAppUrl(customer.whatsappNumber, message);
    if (!url) {
      Alert.alert('No WhatsApp Number', 'This customer does not have a valid WhatsApp number on file.');
      return;
    }
    setShowSelector(false);
    Linking.openURL(url).catch(() => {
      Alert.alert('Could Not Open WhatsApp', 'Please make sure WhatsApp is installed or try again.');
    });
  };

  return (
    <View>
      <TouchableOpacity
        style={[styles.button, !hasValidPhone && styles.buttonDisabled]}
        onPress={() => hasValidPhone && setShowSelector((prev) => !prev)}
        disabled={!hasValidPhone}
        accessibilityRole="button"
        accessibilityLabel="WhatsApp Customer"
        accessibilityState={{ disabled: !hasValidPhone }}
      >
        <Text style={styles.icon}>💬</Text>
        <Text style={[styles.buttonText, !hasValidPhone && styles.buttonTextDisabled]}>
          {hasValidPhone ? 'WhatsApp' : 'No WhatsApp Number'}
        </Text>
      </TouchableOpacity>

      {showSelector && hasValidPhone && (
        <View style={styles.templateRow}>
          {availableTemplates.map((template) => (
            <TouchableOpacity
              key={template.key}
              style={styles.templateChip}
              onPress={() => handleSelectTemplate(template)}
            >
              <Text style={styles.templateChipText}>{template.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    marginTop: spacing.xs,
  },
  buttonDisabled: {
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.border,
  },
  icon: { fontSize: 13, marginRight: 6 },
  buttonText: { color: colors.success, fontWeight: '600', fontSize: 12 },
  buttonTextDisabled: { color: colors.textMuted },
  templateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: 6,
  },
  templateChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  templateChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
});

export default WhatsAppQuickAction;
