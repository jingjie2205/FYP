import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface PoolBreakdown {
  /** Cash already unallocated before the selected month */
  prior: number;
  /** Positive envelope leftovers from the previous month, returned to the pool */
  lastUnspent: number;
  /** Previous month overspending (already reflected in cash; shown as a note only) */
  lastOverspent: number;
  income: number;
  /** Total monthly set-aside budgets */
  budgets: number;
  /** Net funds added to (positive) or withdrawn from (negative) savings goals this month */
  netSaved: number;
  /** Spending above envelope budgets plus uncategorized expenses this month */
  overspending: number;
  /** Net cash movement dated after the selected month (only when viewing a past month) */
  laterNet: number;
  total: number;
}

interface Props {
  availablePool: number;
  totalAccountsBalance?: number;
  breakdown?: PoolBreakdown;
}

const fmt = (n: number) =>
  `$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const signed = (n: number) => (n < -0.005 ? `-${fmt(n)}` : fmt(n));

interface LineProps {
  sign: '+' | '−' | '=';
  label: string;
  value: string;
  accent?: 'green' | 'red' | 'blue' | 'neutral';
  badge?: string;
  bold?: boolean;
}

function BreakdownLine({ sign, label, value, accent = 'neutral', badge, bold }: LineProps) {
  const accentColor =
    accent === 'green'
      ? '#00D293'
      : accent === 'red'
        ? '#FF6B6B'
        : accent === 'blue'
          ? '#38BDF8'
          : '#94A3B8';

  const badgeBg =
    accent === 'green'
      ? 'rgba(0, 210, 147, 0.12)'
      : accent === 'red'
        ? 'rgba(255, 107, 107, 0.12)'
        : accent === 'blue'
          ? 'rgba(56, 189, 248, 0.12)'
          : '#132232';

  return (
    <View style={styles.lineRow}>
      <View style={styles.lineLeft}>
        <View style={[styles.signPill, { backgroundColor: badgeBg }]}>
          <Text style={[styles.signText, { color: accentColor }]}>{sign}</Text>
        </View>
        <Text style={[styles.lineLabel, bold && styles.lineLabelBold]} numberOfLines={1}>
          {label}
        </Text>
        {!!badge && (
          <View style={styles.inlineWarnPill}>
            <Text style={styles.inlineWarnText}>{badge}</Text>
          </View>
        )}
      </View>

      <Text
        style={[
          styles.lineValue,
          bold && styles.lineValueBold,
          accent !== 'neutral' && { color: accentColor },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export default function PoolCard({ availablePool, breakdown }: Props) {
  const [expanded, setExpanded] = useState(false);
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

  const b = breakdown;

  // Visual bar ratio: assigned vs. total pool capacity
  const totalIn = b
    ? Math.max(0, b.prior + b.lastUnspent + b.income + (b.laterNet > 0 ? b.laterNet : 0))
    : 0;
  const totalOut = b
    ? Math.max(
        0,
        b.budgets +
          Math.max(0, b.netSaved) +
          b.overspending +
          (b.laterNet < 0 ? Math.abs(b.laterNet) : 0)
      )
    : 0;
  const usedRatio =
    totalIn > 0 ? Math.min(1, totalOut / totalIn) : totalOut > 0 ? 1 : 0;

  return (
    <View style={[styles.poolCard, isNegative && styles.poolCardNegative]}>
      <TouchableOpacity
        activeOpacity={b ? 0.75 : 1}
        disabled={!b}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.headerRow}
      >
        <View style={styles.leftCol}>
          <Text style={styles.poolEyebrow}>UNALLOCATED BUDGET</Text>
          <View style={styles.tagRow}>
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

            {!!b && (
              <View style={styles.detailsPill}>
                <Text style={styles.detailsPillText}>
                  {expanded ? 'Hide' : 'Breakdown'}
                </Text>
                <Ionicons
                  name={expanded ? 'chevron-up' : 'chevron-down'}
                  size={12}
                  color="#94A3B8"
                />
              </View>
            )}
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
      </TouchableOpacity>

      {!!b && expanded && (
        <View style={styles.breakdown}>
          {/* Visual Allocation Bar */}
          <View style={styles.meterWrap}>
            <View style={styles.meterTrack}>
              <View
                style={[
                  styles.meterFill,
                  {
                    width: `${Math.round(usedRatio * 100)}%`,
                    backgroundColor: isNegative ? '#FF6B6B' : '#38BDF8',
                  },
                ]}
              />
            </View>
            <View style={styles.meterLabels}>
              <Text style={styles.meterText}>
                {Math.round(usedRatio * 100)}% assigned
              </Text>
              <Text style={styles.meterText}>Pool: {fmt(totalIn)}</Text>
            </View>
          </View>

          {/* Cash In Section */}
          <Text style={styles.groupHeader}>CASH IN</Text>
          <BreakdownLine
            sign="+"
            label="Carried Over"
            value={signed(b.prior)}
            accent={b.prior < 0 ? 'red' : 'neutral'}
            badge={b.lastOverspent > 0 ? `-${fmt(b.lastOverspent)} overspent` : undefined}
          />
          {b.lastUnspent >= 0.005 && (
            <BreakdownLine
              sign="+"
              label="Unspent Returned"
              value={fmt(b.lastUnspent)}
              accent="green"
            />
          )}
          <BreakdownLine
            sign="+"
            label="Income"
            value={fmt(b.income)}
            accent={b.income > 0 ? 'green' : 'neutral'}
          />
          {b.netSaved < -0.005 && (
            <BreakdownLine
              sign="+"
              label="Goal Withdrawal"
              value={fmt(b.netSaved)}
              accent="green"
            />
          )}

          {/* Assigned / Out Section */}
          <Text style={[styles.groupHeader, { marginTop: 10 }]}>ASSIGNED</Text>
          <BreakdownLine
            sign="−"
            label="Envelopes"
            value={fmt(b.budgets)}
            accent="neutral"
          />
          {b.netSaved > 0.005 && (
            <BreakdownLine
              sign="−"
              label="Savings Goals"
              value={fmt(b.netSaved)}
              accent="blue"
            />
          )}
          {b.overspending >= 0.005 && (
            <BreakdownLine
              sign="−"
              label="Overspent"
              value={fmt(b.overspending)}
              accent="red"
            />
          )}
          {Math.abs(b.laterNet) >= 0.005 && (
            <BreakdownLine
              sign={b.laterNet < 0 ? '−' : '+'}
              label="Later Months"
              value={fmt(b.laterNet)}
              accent={b.laterNet < 0 ? 'red' : 'green'}
            />
          )}

          {/* Total Result */}
          <View style={styles.divider} />
          <BreakdownLine
            sign="="
            label="Remaining Pool"
            value={signed(b.total)}
            accent={b.total < 0 ? 'red' : b.total === 0 ? 'blue' : 'green'}
            bold
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  poolCard: {
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 5,
  },
  statusTag: {
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
  detailsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#122232',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  detailsPillText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  poolAmount: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
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
  breakdown: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E2D3D',
  },
  meterWrap: {
    marginBottom: 12,
  },
  meterTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(0, 210, 147, 0.18)',
    overflow: 'hidden',
  },
  meterFill: {
    height: '100%',
    borderRadius: 3,
  },
  meterLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  meterText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  groupHeader: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  lineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
    gap: 8,
  },
  lineLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  signPill: {
    width: 18,
    height: 18,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lineLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
  lineLabelBold: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  inlineWarnPill: {
    backgroundColor: 'rgba(255, 107, 107, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  inlineWarnText: {
    color: '#FF6B6B',
    fontSize: 9,
    fontWeight: '700',
  },
  lineValue: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  lineValueBold: {
    fontSize: 13,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: '#1E2D3D',
    marginVertical: 8,
  },
});