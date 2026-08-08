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
import { getActiveEmployees, createEmployee, updateEmployee, deleteEmployee } from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const EmployeeScreen = ({ navigation }) => {
  const [visibleCount, setVisibleCount] = useState(20);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);

  const [employeeName, setEmployeeName] = useState('');

  const loadEmployees = useCallback(async () => {
    try {
      const data = await getActiveEmployees();
      setEmployees(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load employees.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  const resetForm = () => {
    setEmployeeName('');
    setEditingEmployee(null);
    setShowForm(false);
  };

  const handleEdit = (employee) => {
    setEditingEmployee(employee);
    setEmployeeName(employee.employeeName);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!employeeName.trim()) {
      Alert.alert('Missing info', 'Employee name is required.');
      return;
    }
    try {
      const payload = { employeeName: employeeName.trim() };
      if (editingEmployee) {
        await updateEmployee(editingEmployee._id, payload);
      } else {
        await createEmployee(payload);
      }
      resetForm();
      loadEmployees();
    } catch (error) {
      Alert.alert('Error', 'Could not save employee.');
    }
  };

  const handleDelete = (employee) => {
    Alert.alert('Remove Employee', `Remove "${employee.employeeName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteEmployee(employee._id);
          loadEmployees();
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
        <Text style={styles.topBarTitle}>Employees</Text>
        <TouchableOpacity onPress={() => (showForm ? resetForm() : setShowForm(true))}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingEmployee ? 'Edit Employee' : 'New Employee'}</Text>

            <Text style={styles.label}>Employee Name *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Abhi"
              placeholderTextColor={colors.textMuted}
              value={employeeName}
              onChangeText={setEmployeeName}
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{editingEmployee ? 'Update Employee' : 'Save Employee'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1 }]}>Name</Text>
        </View>

        {employees.length === 0 && <Text style={styles.emptyText}>No employees yet. Tap "+ Add" to create one.</Text>}

        {employees.slice(0, visibleCount).map((e, index) => (
          <TouchableOpacity
            key={e._id}
            style={[styles.tableRow, index % 2 === 1 && { backgroundColor: colors.tableRowAlt }]}
            onPress={() => handleEdit(e)}
            onLongPress={() => handleDelete(e)}
          >
            <Text style={[styles.td, { flex: 1, fontWeight: '600' }]}>{e.employeeName}</Text>
          </TouchableOpacity>
        ))}

        {employees.length > visibleCount && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((prev) => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({employees.length - visibleCount} remaining)
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

export default EmployeeScreen;
