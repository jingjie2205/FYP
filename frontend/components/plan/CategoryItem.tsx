import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '@/hooks/useCategories';

interface Props {
  category: Category;
  spentAmount: number;
  onEdit: (category: Category) => void;
  // In the event of overspending
  onCover?: (category: Category) => void;
}

export default function CategoryItem({ category, spentAmount, onEdit, onCover }: Props) {
  const target = Number(category.target_amount) || 0;
  const available = target - spentAmount;
  
  const targetSafe = target > 0 ? target : 1;
  const remainingPercentage = Math.min(100, Math.max(0, (available / targetSafe) * 100));

  // State calculations
  const isOverspent = available < 0;
  const isExhausted = available === 0 && target > 0;

  return (
    <View style={[
      styles.card,
      isOverspent && styles.cardOverspent,
      isExhausted && styles.cardExhausted
    ]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <View style={[
            styles.envelopeIconBadge, 
            isOverspent && styles.iconBadgeOverspent,
            isExhausted && styles.iconBadgeExhausted
          ]}>
            <Ionicons 
              name="wallet-outline" 
              size={16} 
              color={isOverspent ? '#FF6B6B' : isExhausted ? '#94A3B8' : '#00D293'} 
            />
          </View>
          <View>
            <View style={styles.nameRow}>
              <Text style={[styles.planName, isExhausted && styles.textMuted]} numberOfLines={1}>
                {category.name}
              </Text>
              {isOverspent && <Ionicons name="warning" size={14} color="#FF6B6B" style={{ marginLeft: 6 }} />}
            </View>
            <Text style={styles.envelopeSub}>
              Spent: <Text style={isOverspent ? styles.spentHighlight : styles.textMuted}>
                ${spentAmount.toFixed(2)}
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.cardHeaderRight}>
          <Text style={[styles.targetValue, isExhausted && styles.textMuted]}>
            ${target.toFixed(2)}
          </Text>
          <TouchableOpacity onPress={() => onEdit(category)} style={styles.editBtn}>
            <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.barBackground}>
        <View style={[
          styles.remainingBar, 
          { width: `${remainingPercentage}%` },
          isOverspent ? { backgroundColor: '#FF6B6B' } : isExhausted ? { backgroundColor: '#475569' } : { backgroundColor: '#00D293' }
        ]} />
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.footerLabel}>Available</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {isOverspent && onCover && (
            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255, 107, 107, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}
              onPress={() => onCover(category)}
            >
              <Text style={{ color: '#FF6B6B', fontSize: 12, fontWeight: '700' }}>Cover</Text>
            </TouchableOpacity>
          )}
          <Text style={[
            styles.availableAmount, 
            isOverspent && styles.negativeText,
            isExhausted && styles.textMuted
          ]}>
            ${available.toFixed(2)}
          </Text>
        </View>
    </View>
  </View>  
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#0C1A25', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1E2D3D' },

  cardOverspent: { borderColor: 'rgba(255, 107, 107, 0.3)', backgroundColor: 'rgba(255, 107, 107, 0.02)' },
  cardExhausted: { opacity: 0.5, borderColor: 'rgba(30, 45, 61, 0.5)' },
  iconBadgeOverspent: { backgroundColor: 'rgba(255, 107, 107, 0.1)' },
  iconBadgeExhausted: { backgroundColor: '#1E2D3D' },
  textMuted: { color: '#64748B' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  envelopeIconBadge: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(0, 210, 147, 0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  planName: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  envelopeSub: { color: '#64748B', fontSize: 12 },
  spentHighlight: { color: '#FF6B6B', fontWeight: '600' },
  cardHeaderRight: { flexDirection: 'row', alignItems: 'center' },
  targetValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginRight: 12 },
  editBtn: { padding: 4 },
  barBackground: { height: 6, backgroundColor: '#1E2D3D', borderRadius: 3, marginBottom: 12, overflow: 'hidden' },
  remainingBar: { height: '100%', borderRadius: 3 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: '#64748B', fontSize: 12 },
  availableAmount: { color: '#00D293', fontSize: 14, fontWeight: '700' },
  negativeText: { color: '#FF6B6B' },
});