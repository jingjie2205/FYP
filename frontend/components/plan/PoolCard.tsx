import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  availablePool: number;
  totalAccountsBalance: number;
}

export default function PoolCard({ availablePool, totalAccountsBalance }: Props) {
  const isNegative = availablePool < 0;

  return (
    <View style={styles.poolCard}>
      <View style={styles.poolHeader}>
        <Text style={styles.poolEyebrow}>UNALLOCATED CASH POOL</Text>
        <View style={[styles.statusTag, isNegative ? styles.statusTagNegative : styles.statusTagPositive]}>
          <Text style={[styles.statusTagText, isNegative ? styles.statusTextNegative : styles.statusTextPositive]}>
            {isNegative ? 'Overallocated' : 'Available'}
          </Text>
        </View>
      </View>
      <Text style={[styles.poolAmount, isNegative ? styles.poolAmountNegative : styles.poolAmountPositive]}>
        ${availablePool.toFixed(2)}
      </Text>
      <View style={styles.poolFooter}>
        <Text style={styles.poolSubtitle}>
          Total Net Balance: <Text style={styles.poolWhite}>${totalAccountsBalance.toFixed(2)}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  poolCard: { margin: 16, padding: 20, backgroundColor: '#0C1A25', borderRadius: 20, borderWidth: 1, borderColor: '#1E2D3D' },
  poolHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  poolEyebrow: { color: '#00D293', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  statusTag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusTagPositive: { backgroundColor: 'rgba(0, 210, 147, 0.1)' },
  statusTagNegative: { backgroundColor: 'rgba(255, 107, 107, 0.1)' },
  statusTagText: { fontSize: 10, fontWeight: '700' },
  statusTextPositive: { color: '#00D293' },
  statusTextNegative: { color: '#FF6B6B' },
  poolAmount: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  poolAmountPositive: { color: '#FFFFFF' },
  poolAmountNegative: { color: '#FF6B6B' },
  poolFooter: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1E2D3D' },
  poolSubtitle: { color: '#64748B', fontSize: 13 },
  poolWhite: { color: '#FFFFFF', fontWeight: '600' },
});