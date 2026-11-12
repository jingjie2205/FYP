import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsPlan } from '@/hooks/useSavings';

interface Props {
  item: SavingsPlan;
  onEdit: (plan: SavingsPlan) => void;
}

export default function SavingsItem({ item, onEdit }: Props) {
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
            <Text style={styles.envelopeSub}>Target: {item.deadline || 'Ongoing'}</Text>
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
  savingsValuesRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 12 },
  savedHighlight: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginRight: 6 },
  goalTargetText: { color: '#64748B', fontSize: 13 },
});