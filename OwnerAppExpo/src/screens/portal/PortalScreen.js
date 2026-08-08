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
import { getActivePortals, createPortal, updatePortal, deletePortal } from '../../services/api';
import { colors, spacing, typography, commonStyles } from '../../theme/theme';

const PortalScreen = ({ navigation }) => {
  const [visibleCount, setVisibleCount] = useState(20);
  const [portals, setPortals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPortal, setEditingPortal] = useState(null);

  const [portalUrl, setPortalUrl] = useState('');

  const loadPortals = useCallback(async () => {
    try {
      const data = await getActivePortals();
      setPortals(data);
    } catch (error) {
      Alert.alert('Error', 'Could not load portals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortals();
  }, [loadPortals]);

  const resetForm = () => {
    setPortalUrl('');
    setEditingPortal(null);
    setShowForm(false);
  };

  const handleEdit = (portal) => {
    setEditingPortal(portal);
    setPortalUrl(portal.portalUrl);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!portalUrl.trim()) {
      Alert.alert('Missing info', 'Portal URL is required.');
      return;
    }
    try {
      const payload = { portalUrl: portalUrl.trim() };
      if (editingPortal) {
        await updatePortal(editingPortal._id, payload);
      } else {
        await createPortal(payload);
      }
      resetForm();
      loadPortals();
    } catch (error) {
      Alert.alert('Error', 'Could not save portal.');
    }
  };

  const handleDelete = (portal) => {
    Alert.alert('Remove Portal', `Remove "${portal.portalUrl}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deletePortal(portal._id);
          loadPortals();
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
        <Text style={styles.topBarTitle}>Portal URLs</Text>
        <TouchableOpacity onPress={() => (showForm ? resetForm() : setShowForm(true))}>
          <Text style={styles.addLink}>{showForm ? 'Cancel' : '+ Add'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {showForm && (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingPortal ? 'Edit Portal' : 'New Portal'}</Text>

            <Text style={styles.label}>Portal URL *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://smart4k.me"
              placeholderTextColor={colors.textMuted}
              value={portalUrl}
              onChangeText={setPortalUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>{editingPortal ? 'Update Portal' : 'Save Portal'}</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.tableHeader}>
          <Text style={[styles.th, { flex: 1 }]}>Portal URL</Text>
        </View>

        {portals.length === 0 && <Text style={styles.emptyText}>No portals yet. Tap "+ Add" to create one.</Text>}

        {portals.slice(0, visibleCount).map((p, index) => (
          <TouchableOpacity
            key={p._id}
            style={[styles.tableRow, index % 2 === 1 && { backgroundColor: colors.tableRowAlt }]}
            onPress={() => handleEdit(p)}
            onLongPress={() => handleDelete(p)}
          >
            <Text style={[styles.td, { flex: 1, fontWeight: '600' }]}>{p.portalUrl}</Text>
          </TouchableOpacity>
        ))}

        {portals.length > visibleCount && (
          <TouchableOpacity
            style={styles.loadMoreButton}
            onPress={() => setVisibleCount((prev) => prev + 20)}
          >
            <Text style={styles.loadMoreText}>
              Load More ({portals.length - visibleCount} remaining)
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

export default PortalScreen;
