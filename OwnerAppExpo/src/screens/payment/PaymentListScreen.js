import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAllPayments, createPayment, deletePayment, getCustomers } from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';
import WhatsAppQuickAction from '../../components/WhatsAppQuickAction';
import NotificationBell from '../../components/NotificationBell';

const PAYMENT_METHODS = ['Cash', 'UPI', 'Bank Transfer', 'PayPal', 'Card', 'Other'];

const currentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const currentMonthLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

const PaymentListScreen = ({ route }) => {
  const [payments, setPayments] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Set from Dashboard's "Monthly Revenue" card (initialMonth: 'current');
  // null means the original all-time view. See getAllPayments(?month=).
  const [monthScope, setMonthScope] = useState(null);

  useEffect(() => {
    if (route?.params?.initialMonth === 'current') {
      setMonthScope(currentMonthKey());
    }
  }, [route?.params?.initialMonth]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [notes, setNotes] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);

  const loadPayments = useCallback(async () => {
    try {
      const data = await getAllPayments(monthScope ? { month: monthScope } : {});
      setPayments(data.payments);
      setTotalRevenue(data.totalRevenue);
    } catch (error) {
      Alert.alert('Error', 'Could not load payments.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [monthScope]);

  useEffect(() => {
    setLoading(true);
    loadPayments();
  }, [loadPayments]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadPayments();
  };

  const handleOpenAddForm = async () => {
    setShowAddForm(true);
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load customers.');
    }
  };

  const handleSavePayment = async () => {
    if (!selectedCustomer || !amount) {
      Alert.alert('Missing info', 'Please select a customer and enter an amount.');
      return;
    }
    try {
      await createPayment({
        customer: selectedCustomer._id,
        amount,
        paymentMethod,
        transactionDate,
        notes,
      });
      setSelectedCustomer(null);
      setCustomerSearch('');
      setAmount('');
      setNotes('');
      setShowAddForm(false);
      loadPayments();
    } catch (error) {
      Alert.alert('Error', 'Could not save payment.');
    }
  };

  const handleDeletePayment = (id) => {
    Alert.alert('Delete Payment', 'Are you sure you want to remove this payment record?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deletePayment(id);
          loadPayments();
        },
      },
    ]);
  };

  const handleDateChange = (event, selectedDate) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTransactionDate(selectedDate.toISOString());
    }
  };

  const filteredCustomers = customers.filter((c) =>
    c.fullName.toLowerCase().includes(customerSearch.toLowerCase())
  );

  const allFilteredPayments = payments.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    return (
      p.customerName?.toLowerCase().includes(q) ||
      p.whatsappNumber?.toLowerCase().includes(q) ||
      p.customerIdCode?.toLowerCase().includes(q)
    );
  });
  const filteredPayments = allFilteredPayments.slice(0, visibleCount);
  const hasMorePayments = allFilteredPayments.length > visibleCount;

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
          <Text style={styles.topBarTitle}>Payments</Text>
          <Text style={styles.topBarSubtitle}>
            {monthScope ? `${currentMonthLabel()} Revenue: $${totalRevenue}` : `Total: $${totalRevenue}`}
          </Text>
          {!!monthScope && (
            <TouchableOpacity onPress={() => setMonthScope(null)}>
              <Text style={styles.clearScopeLink}>View all-time total</Text>
            </TouchableOpacity>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <NotificationBell />
          <TouchableOpacity
            style={[styles.addButton, { marginLeft: 8 }]}
            onPress={() => (showAddForm ? setShowAddForm(false) : handleOpenAddForm())}
          >
            <Text style={styles.addButtonText}>{showAddForm ? 'Cancel' : '+ Add'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        {showAddForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>New Payment</Text>

            <Text style={styles.label}>Customer *</Text>
            {selectedCustomer ? (
              <View style={styles.selectedCustomerBox}>
                <Text style={styles.selectedCustomerText}>
                  {selectedCustomer.fullName} ({selectedCustomer.customerId})
                </Text>
                <TouchableOpacity onPress={() => setSelectedCustomer(null)}>
                  <Text style={styles.changeLink}>Change</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Search customer by name"
                  placeholderTextColor={colors.textMuted}
                  value={customerSearch}
                  onChangeText={setCustomerSearch}
                />
                {customerSearch.length > 0 &&
                  filteredCustomers.slice(0, 5).map((c) => (
                    <TouchableOpacity
                      key={c._id}
                      style={styles.customerOption}
                      onPress={() => {
                        setSelectedCustomer(c);
                        setCustomerSearch('');
                      }}
                    >
                      <Text style={styles.customerOptionText}>
                        {c.fullName} ({c.customerId})
                      </Text>
                    </TouchableOpacity>
                  ))}
              </>
            )}

            <Text style={styles.label}>Amount (USD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 33"
              placeholderTextColor={colors.textMuted}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.methodRow}>
              {PAYMENT_METHODS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.methodChip, paymentMethod === m && styles.methodChipActive]}
                  onPress={() => setPaymentMethod(m)}
                >
                  <Text
                    style={[
                      styles.methodChipText,
                      paymentMethod === m && styles.methodChipTextActive,
                    ]}
                  >
                    {m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Date</Text>
            <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
              <Text style={{ color: colors.text }}>{new Date(transactionDate).toDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && (
              <DateTimePicker
                value={new Date(transactionDate)}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
              />
            )}

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional notes"
              placeholderTextColor={colors.textMuted}
              value={notes}
              onChangeText={setNotes}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSavePayment}>
              <Text style={styles.saveButtonText}>Save Payment</Text>
            </TouchableOpacity>
          </View>
        )}

        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer name, phone, or ID"
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {filteredPayments.length === 0 && (
          <Text style={styles.emptyText}>No payments recorded yet.</Text>
        )}

        {filteredPayments.map((p) => (
          <View key={p._id} style={styles.paymentCard}>
            <View style={styles.paymentTopRow}>
              <View>
                <Text style={styles.customerName}>{p.customerName}</Text>
                <Text style={styles.customerIdText}>{p.customerIdCode}</Text>
              </View>
              <Text style={styles.amountText}>${p.amount}</Text>
            </View>
            <Text style={styles.metaText}>{p.paymentMethod} • {new Date(p.transactionDate).toDateString()}</Text>
            {!!p.notes && <Text style={styles.notesText}>{p.notes}</Text>}
            <WhatsAppQuickAction customer={{ fullName: p.customerName, whatsappNumber: p.whatsappNumber }} />
            <TouchableOpacity onPress={() => handleDeletePayment(p._id)}>
              <Text style={styles.deleteLink}>Delete</Text>
            </TouchableOpacity>
          </View>
        ))}

        {hasMorePayments && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((prev) => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({allFilteredPayments.length - visibleCount} remaining)
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
  clearScopeLink: { color: '#c9d8ef', fontSize: 11, marginTop: 2, textDecorationLine: 'underline' },
  addButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addButtonText: { color: '#ffffff', fontWeight: '600', fontSize: 13 },
  container: { padding: spacing.lg, paddingBottom: 40 },
  formCard: { ...commonStyles.card, padding: spacing.lg, marginBottom: spacing.lg },
  formTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { ...commonStyles.input, marginBottom: spacing.sm },
  selectedCustomerBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 6,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  selectedCustomerText: { fontSize: 13, color: colors.text, fontWeight: '600' },
  changeLink: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  customerOption: {
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  customerOptionText: { fontSize: 13, color: colors.text },
  methodRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  methodChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  methodChipText: { color: colors.textSecondary, fontSize: 12 },
  methodChipTextActive: { color: '#ffffff', fontWeight: '600' },
  saveButton: { ...commonStyles.primaryButton, marginTop: spacing.md },
  saveButtonText: commonStyles.primaryButtonText,
  searchInput: { ...commonStyles.input, marginBottom: spacing.md },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', marginTop: spacing.lg },
  paymentCard: { ...commonStyles.card, padding: spacing.md, marginBottom: spacing.sm },
  paymentTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  customerName: { fontSize: 14, fontWeight: '700', color: colors.text },
  customerIdText: { fontSize: 11, color: colors.primary, marginTop: 2 },
  amountText: { fontSize: 18, fontWeight: '700', color: colors.success },
  metaText: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  notesText: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontStyle: 'italic' },
  deleteLink: { color: colors.danger, fontSize: 12, marginTop: spacing.sm, fontWeight: '600' },
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

export default PaymentListScreen;
