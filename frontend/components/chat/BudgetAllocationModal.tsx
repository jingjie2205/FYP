import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatMonthKey } from '@/utils/month';

export interface BudgetPlan {
  targetIncome: number;
  month: string;
  allocations: {
    categoryId: string;
    categoryName: string;
    groupName: string;
    currentAssigned: number;
    proposedAssigned: number;
  }[];
}

interface Props {
  visible: boolean;
  plan: BudgetPlan | null;
  onClose: () => void;
  /** Applies the plan; should throw an Error with a user-facing message on failure */
  onConfirm: (plan: BudgetPlan) => Promise<void>;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export default function BudgetAllocationModal({ visible, plan, onClose, onConfirm }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) {
      setSubmitting(false);
      setError('');
    }
  }, [visible]);

  if (!plan) return null;

  const totalProposed = plan.allocations.reduce((s, a) => s + a.proposedAssigned, 0);
  const remaining = plan.targetIncome - totalProposed;

  const handleConfirm = async () => {
    if (submitting) return;
    const changed = plan.allocations.filter((a) => Number(a.proposedAssigned) !== Number(a.currentAssigned));
    if (changed.length === 0) {
      setError('This plan matches your current budget, so there is nothing to apply.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(plan);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not apply this budget. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Ionicons name="pie-chart-outline" size={22} color="#00D293" />
            <Text style={styles.title}>Proposed Monthly Budget</Text>
          </View>
          <Text style={styles.subtitle}>
            {formatMonthKey(plan.month)} · based on {money(plan.targetIncome)} income
          </Text>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {plan.allocations.map((a) => {
              const changed = Math.abs(a.proposedAssigned - a.currentAssigned) >= 0.005;
              return (
                <View key={a.categoryId} style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{a.categoryName}</Text>
                    {!!a.groupName && <Text style={styles.group} numberOfLines={1}>{a.groupName}</Text>}
                  </View>
                  <Text style={styles.values}>
                    {money(a.currentAssigned)} →{' '}
                    <Text style={[styles.proposed, changed && styles.proposedChanged]}>{money(a.proposedAssigned)}</Text>
                  </Text>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total allocated</Text>
              <Text style={styles.totalValue}>{money(totalProposed)} / {money(plan.targetIncome)}</Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Left unallocated</Text>
              <Text style={styles.totalValue}>{money(Math.max(0, remaining))}</Text>
            </View>
          </View>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleConfirm} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#03151E" /> : <Text style={styles.confirmText}>Confirm Budget</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3, 21, 30, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  content: { width: '100%', maxHeight: '85%', backgroundColor: '#0C1A25', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E2D3D' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 12 },
  list: { backgroundColor: '#03151E', borderRadius: 12, borderWidth: 1, borderColor: '#1E2D3D', paddingHorizontal: 12, maxHeight: 300 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E2D3D' },
  name: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  group: { color: '#64748B', fontSize: 10, marginTop: 1 },
  values: { color: '#64748B', fontSize: 12 },
  proposed: { color: '#FFFFFF', fontWeight: '700' },
  proposedChanged: { color: '#00D293' },
  totals: { marginTop: 12, gap: 4 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#94A3B8', fontSize: 12 },
  totalValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
  errorText: { flex: 1, color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: '#64748B', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#00D293', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 130, alignItems: 'center' },
  confirmText: { color: '#03151E', fontWeight: '700' },
});
