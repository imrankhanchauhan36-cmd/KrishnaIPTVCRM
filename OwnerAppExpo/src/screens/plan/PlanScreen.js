import React, { useState, useEffect, useCallback } from 'react';
import { Platform, StatusBar } from 'react-native';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { getPlans, createPlan, updatePlan, deletePlan } from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const PlanScreen = ({ navigation }) => {
  const [visibleCount, setVisibleCount] = useState(20);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);

  const [name, setName] = useState('');
  const [durationType, setDurationType] = useState('months');
  const [durationValue, setDurationValue] = useState('');
  const [priceUSD, setPriceUSD] = useState('');
  const [description, setDescription] = useState('');

  const loadPlans = useCallback(async () => {
    try {
      const data = await getPlans();
      setPlans(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load plans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  const resetForm = () => {
    setName('');
    setDurationType('months');
    setDurationValue('');
    setPriceUSD('');
    setDescription('');
    setEditingPlan(null);
    setShowForm(false);
  };

  const handleEdit = (plan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDurationType(plan.durationType || 'months');
    setDurationValue(String(plan.durationValue));
    setPriceUSD(String(plan.priceUSD));
    setDescription(plan.description || '');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name || !durationValue || !priceUSD) {
      Alert.alert('Missing info', 'Name, duration, and price are required.');
      return;
    }
    try {
      const payload = {
        name,
        durationType,
        durationValue: Number(durationValue),
        priceUSD: Number(priceUSD),
        description,
      };
      if (editingPlan) {
        await updatePlan(editingPlan._id, payload);
      } else {
        await createPlan(payload);
      }
      resetForm();
      loadPlans();
    } catch (error) {
      Alert.alert('Error', 'Could not save plan.');
    }
  };

  const handleDelete = (plan) => {
    Alert.alert('Remove Plan', `Remove "${plan.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePlan(plan._id);
          loadPlans();
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
          <Text style={styles.backLink}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Plans</Text>
        <TouchableOpacity onPress={() => (showForm ? resetForm() : setShowForm(true))}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingPlan ? 'Edit Plan' : 'New Plan'}</Text>

            <Text style={styles.label}>Plan Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 6 Months"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
            />

            <Text style={styles.label}>Duration Type *</Text>
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[styles.toggleChip, durationType === 'days' && styles.toggleChipActive]}
                onPress={() => setDurationType('days')}
              >
                <Text style={[styles.toggleChipText, durationType === 'days' && styles.toggleChipTextActive]}>Days</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleChip, durationType === 'months' && styles.toggleChipActive]}
                onPress={() => setDurationType('months')}
              >
                <Text style={[styles.toggleChipText, durationType === 'months' && styles.toggleChipTextActive]}>Months</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Duration Value * ({durationType})</Text>
            <TextInput
              style={styles.input}
              placeholder={durationType === 'days' ? 'e.g. 2' : 'e.g. 6'}
              placeholderTextColor={colors.textMuted}
              value={durationValue}
              onChangeText={setDurationValue}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>Price (USD) *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 60"
              placeholderTextColor={colors.textMuted}
              value={priceUSD}
              onChangeText={setPriceUSD}
              keyboardType="decimal-pad"
            />

            <Text style={styles.label}>Description</Text>
            <TextInput
              style={styles.input}
              placeholder="Optional notes"
              placeholderTextColor={colors.textMuted}
              value={description}
              onChangeText={setDescription}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{editingPlan ? 'Update Plan' : 'Save Plan'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 2 }]}>Plan</Text>
          <Text style={[styles.th, { flex: 1 }]}>Duration</Text>
          <Text style={[styles.th, { flex: 1 }]}>Price</Text>
        </View>

        {plans.length === 0 && <Text style={styles.emptyText}>No plans yet. Tap "+ Add" to create one.</Text>}

        {plans.slice(0, visibleCount).map((p, index) => (
          <TouchableOpacity
            key={p._id}
            style={[styles.tableRow, index % 2 === 1 && { backgroundColor: colors.tableRowAlt }]}
            onPress={() => handleEdit(p)}
            onLongPress={() => handleDelete(p)}
          >
            <Text style={[styles.td, { flex: 2, fontWeight: '600' }]}>{p.name}</Text>
            <Text style={[styles.td, { flex: 1 }]}>{p.durationValue} {p.durationType}</Text>
            <Text style={[styles.td, { flex: 1 }]}>${p.priceUSD}</Text>
          </TouchableOpacity>
        ))}

        {plans.length > visibleCount && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((prev) => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({plans.length - visibleCount} remaining)
            </Text>
          </TouchableOpacity>
        )}

        <Text style={styles.hint}>Tap a row to edit. Long-press to remove.</Text>
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
  backLink: { color: colors.headerText, fontSize: 14 },
  topBarTitle: { color: colors.headerText, fontSize: 16, fontWeight: '700' },
  addLink: { color: colors.headerText, fontSize: 14, fontWeight: '600' },
  container: { padding: spacing.lg, paddingBottom: 40 },
  formCard: {
    ...commonStyles.card,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  formTitle: { ...typography.h2, marginBottom: spacing.md },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { ...commonStyles.input, marginBottom: spacing.sm },
  toggleRow: { flexDirection: 'row', marginBottom: spacing.sm },
  toggleChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  toggleChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleChipText: { color: colors.textSecondary, fontSize: 13, fontWeight: '600' },
  toggleChipTextActive: { color: '#ffffff' },
  saveButton: { ...commonStyles.primaryButton, marginTop: spacing.md },
  saveButtonText: commonStyles.primaryButtonText,
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.tableHeaderBg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  th: { ...typography.label, fontSize: 11 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  td: { ...typography.body, fontSize: 13 },
  emptyText: { ...typography.bodyMuted, textAlign: 'center', marginTop: 20 },
  hint: { ...typography.bodyMuted, textAlign: 'center', marginTop: 12, fontSize: 11 },
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

export default PlanScreen;
