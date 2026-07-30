import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  StatusBar,
} from 'react-native';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const CustomerFoundScreen = ({ route, navigation }) => {
  const { customer } = route.params;
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.subHeader}>This customer already exists in your records.</Text>

        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Customer ID</Text>
            <Text style={styles.value}>{customer.customerId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Name</Text>
            <Text style={styles.value}>{customer.fullName}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Phone</Text>
            <Text style={styles.value}>{customer.whatsappNumber}</Text>
          </View>
          {!!customer.email && (
            <View style={styles.row}>
              <Text style={styles.label}>Email</Text>
              <Text style={styles.value}>{customer.email}</Text>
            </View>
          )}
          <View style={[styles.row, { borderBottomWidth: 0 }]}>
            <Text style={styles.label}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: customer.status === 'Active' ? colors.successBg : colors.dangerBg },
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: customer.status === 'Active' ? colors.success : colors.danger },
                ]}
              >
                {customer.status}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.openButton} onPress={() => navigation.replace('CustomerDetails', { customer })}>
          <Text style={styles.openButtonText}>Open Profile</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.navigate('CustomerList')}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
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
  subHeader: { ...typography.bodyMuted, marginBottom: spacing.lg },
  card: { ...commonStyles.card, padding: spacing.lg, marginBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: { ...typography.label },
  value: { fontSize: 14, color: colors.text, fontWeight: '600' },
  statusBadge: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  openButton: { ...commonStyles.primaryButton },
  openButtonText: commonStyles.primaryButtonText,
  cancelButton: { paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14 },
});

export default CustomerFoundScreen;
