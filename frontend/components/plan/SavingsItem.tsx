import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsPlan } from '@/hooks/useSavings';
import { formatDisplayDate } from '@/components/DatePickerField';

interface Props {
  item: SavingsPlan;
  onEdit: (plan: SavingsPlan) => void;
  onContribute?: (plan: SavingsPlan) => void;
  onWithdraw?: (plan: SavingsPlan) => void;
}

export default function SavingsItem({ item, onEdit, onContribute, onWithdraw }: Props) {
  const target = Number(item.target_amount) || 1;
  const saved = Number(item.saved_amount) || 0;
  const percentage = Math.min(100, Math.max(0, (saved / target) * 100));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={styles.goalIconBadge}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#00D293" />
          </View>
          <View>
            <Text style={styles.planName} numberOfLines={1}>{item.name}</Text>
            <Text style={styles.envelopeSub}>Target: {formatDisplayDate(item.deadline) || 'Ongoing'}</Text>
          </View>
        </View>
        <View style={styles.cardHeaderRight}>
          <View style={styles.percentBadge}>
            <Text style={styles.percentBadgeText}>{percentage.toFixed(0)}%</Text>
          </View>
          <TouchableOpacity onPress={() => onEdit(item)} style={styles.editBtn}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.savingsValuesRow}>
        <Text style={styles.savedHighlight}>${saved.toLocaleString()}</Text>
        <Text style={styles.goalTargetText}>of ${target.toLocaleString()}</Text>
      </View>
      <View style={styles.barBackground}>
        <View style={[styles.greenRemainingBar, { width: `${percentage}%` }]} />
      </View>

      {(onContribute || onWithdraw) && (
        <View style={styles.actionsRow}>
          {onContribute && (
            <TouchableOpacity style={styles.addFundsBtn} onPress={() => onContribute(item)}>
              <Ionicons name="add-circle-outline" size={16} color="#03151E" />
              <Text style={styles.addFundsText}>Add Funds</Text>
            </TouchableOpacity>
          )}
          {onWithdraw && (
            <TouchableOpacity
              style={[styles.withdrawBtn, saved <= 0 && styles.btnDisabled]}
              onPress={() => onWithdraw(item)}
              disabled={saved <= 0}
            >
              <Ionicons name="arrow-undo-outline" size={16} color="#94A3B8" />
              <Text style={styles.withdrawText}>Withdraw</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0C1A25', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E2D3D' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  goalIconBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0, 210, 147, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  planName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  envelopeSub: { color: '#64748B', fontSize: 12 },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  editBtn: { padding: 4 },
  barBackground: { height: 6, backgroundColor: '#1E2D3D', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  greenRemainingBar: { height: '100%', backgroundColor: '#00D293', borderRadius: 3 },
  percentBadge: { backgroundColor: '#1E2D3D', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 12 },
  percentBadgeText: { color: '#00D293', fontSize: 12, fontWeight: '700' },
  actionsRow: { flexDirection: 'row', gap: 10 },
  addFundsBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#00D293', paddingVertical: 10, borderRadius: 12 },
  addFundsText: { color: '#03151E', fontSize: 13, fontWeight: '700' },
  withdrawBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', paddingVertical: 10, borderRadius: 12 },
  withdrawText: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.4 },
  savingsValuesRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  savedHighlight: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginRight: 6 },
  goalTargetText: { color: '#64748B', fontSize: 13 },
});