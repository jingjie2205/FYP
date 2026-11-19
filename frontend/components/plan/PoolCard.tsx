import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface Props {
  availablePool: number;
  totalAccountsBalance?: number;
}

export default function PoolCard({ availablePool }: Props) {
  const normalizedPool = Math.abs(availablePool) < 0.005 ? 0 : availablePool;
  const isNegative = normalizedPool < 0;
  const isZero = normalizedPool === 0;

  const formattedPool = isNegative
    ? `-$${Math.abs(normalizedPool).toFixed(2)}`
    : `$${normalizedPool.toFixed(2)}`;

  const statusLabel = isNegative
    ? 'Overallocated'
    : isZero
      ? 'Fully Allocated'
      : 'Unallocated';

  return (
    <View style={[styles.poolCard, isNegative && styles.poolCardNegative]}>
      <View style={styles.leftCol}>
        <Text style={styles.poolEyebrow}>UNALLOCATED BUDGET</Text>
        <View
          style={[
            styles.statusTag,
            isNegative
              ? styles.statusTagNegative
              : isZero
                ? styles.statusTagZero
                : styles.statusTagPositive,
          ]}
        >
          <Text
            style={[
              styles.statusTagText,
              isNegative
                ? styles.statusTextNegative
                : isZero
                  ? styles.statusTextZero
                  : styles.statusTextPositive,
            ]}
          >
            {statusLabel}
          </Text>
        </View>
      </View>

      <Text
        style={[
          styles.poolAmount,
          isNegative
            ? styles.poolAmountNegative
            : isZero
              ? styles.poolAmountZero
              : styles.poolAmountPositive,
        ]}
      >
        {formattedPool}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  poolCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#0C1A25',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  poolCardNegative: {
    borderColor: '#3D2028',
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  poolEyebrow: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  statusTag: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusTagPositive: {
    backgroundColor: 'rgba(0, 210, 147, 0.12)',
  },
  statusTagZero: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
  },
  statusTagNegative: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextPositive: {
    color: '#00D293',
  },
  statusTextZero: {
    color: '#38BDF8',
  },
  statusTextNegative: {
    color: '#FF6B6B',
  },
  poolAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  poolAmountPositive: {
    color: '#FFFFFF',
  },
  poolAmountZero: {
    color: '#38BDF8',
  },
  poolAmountNegative: {
    color: '#FF6B6B',
  },
});