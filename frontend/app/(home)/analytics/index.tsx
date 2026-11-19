import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PieChart, LineChart } from 'react-native-gifted-charts';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useSavings } from '@/hooks/useSavings';
import { useMonth } from '@/hooks/useMonth';
import MonthSelector from '@/components/MonthSelector';
import { formatMonthKey, getTransactionMonthKey, shiftMonthKey } from '@/utils/month';

const API_URL = process.env.EXPO_PUBLIC_API_URL;
const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 72; // Adjust for card padding

// Cyber-dark optimized neon palette for the pie chart
const NEON_PALETTE = [
  '#00D293', // Emerald
  '#06B6D4', // Cyan
  '#8B5CF6', // Purple
  '#F59E0B', // Gold
  '#EC4899', // Pink
  '#3B82F6', // Blue
  '#FF6B6B', // Coral
  '#14B8A6'  // Teal
];

function sumByType(txs: any[], type: 'income' | 'expense') {
  return txs.filter((t) => t.type === type).reduce((sum, t) => sum + Number(t.amount || 0), 0);
}

// Planned amount of an envelope for the selected month; uninitialised months fall back to the default monthly budget
function plannedOf(cat: any): number {
  const v = cat.has_budget === false ? cat.default_amount ?? cat.target_amount ?? 0 : cat.target_amount ?? 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// Pacing colour by share of the planned amount used
function pacingColor(util: number): string {
  if (util > 1) return '#EF4444'; // over budget
  if (util >= 0.8) return '#F59E0B'; // warning
  return '#00D293'; // healthy
}

function fmtMoney(n: number, decimals = 0): string {
  const v = Number.isFinite(n) ? n : 0;
  const text = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v < 0 ? '-' : ''}$${text}`;
}

function monthShort(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' });
}

const MODEL_LABELS: Record<string, string> = {
  holt_winters: 'Holt-Winters',
  moving_average: 'Moving Avg',
  fallback_assigned: 'Baseline',
};

// % change vs previous month; null when there is nothing to compare against
function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export default function AnalyticsScreen() {
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const userId = isUserLoaded && isSignedIn ? user?.id : undefined;

  const { selectedMonth, rolloverReady, rolloverVersion } = useMonth();
  const previousMonth = shiftMonthKey(selectedMonth, -1);
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState<'spending' | 'budget'>('spending');

  // Custom Hooks
  const { 
    transactions: allTransactions = [], 
    isLoading: isTxLoading, 
    loadData: fetchTx 
  } = useTransactions(userId);

  const { 
    categories = [], 
    isLoading: isCatLoading, 
    fetchCategories 
  } = useCategories(userId, selectedMonth);

  const { 
    savingsPlans = [], 
    isLoading: isSavLoading, 
    fetchSavings 
  } = useSavings(userId);

  // Month the loaded envelopes belong to. Prevents showing the previous month's envelopes right after a month switch.
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ML forecast for the selected month. `month` stamps which month the data belongs to.
  const [forecastState, setForecastState] = useState<{ month: string; available: boolean; data: any | null } | null>(null);

  const loadForecast = useCallback(
    async (month: string) => {
      if (!userId) return null;
      try {
        const response = await fetch(`${API_URL}/forecast/${userId}?month=${month}`);
        const json = await response.json();
        return { month, available: !!json?.available, data: json?.forecast ?? null };
      } catch {
        return { month, available: false, data: null };
      }
    },
    [userId]
  );

  // Refresh forecasts when the tab gains focus (new transactions or budget changes elsewhere) and when the month changes
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let cancelled = false;
      loadForecast(selectedMonth).then((result) => {
        if (!cancelled && result) setForecastState(result);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, selectedMonth, rolloverVersion, loadForecast])
  );

  // Collapse any open envelope when the month changes
  useEffect(() => {
    setExpandedId(null);
  }, [selectedMonth]);

  // Transactions and savings are not month-scoped: reload when the tab gains focus (e.g. after changes in Chat or Home)
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchTx();
      fetchSavings();
    }, [userId, rolloverVersion, fetchTx, fetchSavings])
  );

  // Envelopes are month-scoped: reload on focus and whenever the selected month changes
  useFocusEffect(
    useCallback(() => {
      if (!userId || !rolloverReady) return;
      let cancelled = false;
      const month = selectedMonth;
      fetchCategories().then(() => {
        if (!cancelled) setLoadedMonth(month);
      });
      return () => {
        cancelled = true;
      };
    }, [userId, rolloverReady, rolloverVersion, selectedMonth, fetchCategories])
  );

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const [, , , forecastResult] = await Promise.all([fetchTx(), fetchCategories(), fetchSavings(), loadForecast(selectedMonth)]);
      setLoadedMonth(selectedMonth);
      if (forecastResult) setForecastState(forecastResult);
    } finally {
      setRefreshing(false);
    }
  }, [userId, selectedMonth, fetchTx, fetchCategories, fetchSavings, loadForecast]);

  // Transactions of the selected month and the month before it
  const transactions = useMemo(
    // Only real income/expense: savings moves are not spending or earning
    () => (allTransactions as any[]).filter((t) => (t.type === 'income' || t.type === 'expense') && getTransactionMonthKey(t) === selectedMonth),
    [allTransactions, selectedMonth]
  );
  const previousTransactions = useMemo(
    () => (allTransactions as any[]).filter((t) => (t.type === 'income' || t.type === 'expense') && getTransactionMonthKey(t) === previousMonth),
    [allTransactions, previousMonth]
  );

  const hasTransactions = transactions.length > 0;
  const envelopesReady = loadedMonth === selectedMonth;
  // Never show the previous month's envelopes while the new month is still loading
  const scopedCategories = useMemo(() => (envelopesReady ? categories : []), [envelopesReady, categories]);
  const hasCategories = scopedCategories.length > 0;

  // Month-over-month comparison
  const comparison = useMemo(() => {
    const income = sumByType(transactions, 'income');
    const expenses = sumByType(transactions, 'expense');
    const prevIncome = sumByType(previousTransactions, 'income');
    const prevExpenses = sumByType(previousTransactions, 'expense');
    const net = income - expenses;
    return {
      income,
      expenses,
      net,
      savingsRate: income > 0 ? (net / income) * 100 : null,
      prevIncome,
      prevExpenses,
      prevNet: prevIncome - prevExpenses,
      incomeChange: percentChange(income, prevIncome),
      expenseChange: percentChange(expenses, prevExpenses),
      netChange: percentChange(net, prevIncome - prevExpenses),
    };
  }, [transactions, previousTransactions]);

  // Spending per envelope for the selected month. A transaction belongs to an envelope by id,
  // falling back to a case-insensitive name match.
  const { spendingMap, categoryTxMap, resolveCategoryId } = useMemo(() => {
    const ids = new Set(scopedCategories.map((c) => String(c.id)));
    const byName = new Map(scopedCategories.map((c) => [c.name.trim().toLowerCase(), String(c.id)]));
    const resolve = (t: any): string | null => {
      if (t.category_id && ids.has(String(t.category_id))) return String(t.category_id);
      const name = String(t.category_name || t.category || '').trim().toLowerCase();
      return name ? byName.get(name) ?? null : null;
    };

    const map: Record<string, number> = {};
    const txMap: Record<string, any[]> = {};
    transactions.filter((t: any) => t.type === 'expense').forEach((t: any) => {
      const id = resolve(t);
      if (!id) return;
      map[id] = (map[id] || 0) + Number(t.amount || 0);
      (txMap[id] = txMap[id] || []).push(t);
    });
    return { spendingMap: map, categoryTxMap: txMap, resolveCategoryId: resolve };
  }, [transactions, scopedCategories]);

  // Planned vs spent per envelope, most-utilised first so overspent envelopes stand out
  const envelopeRows = useMemo(() => {
    return scopedCategories
      .map((cat) => {
        const planned = plannedOf(cat);
        const spent = spendingMap[cat.id] || 0;
        const util = planned > 0 ? spent / planned : spent > 0 ? Infinity : 0;
        return { id: cat.id, name: cat.name, planned, spent, util, left: planned - spent };
      })
      .sort((a, b) => (a.util === b.util ? b.spent - a.spent : b.util - a.util));
  }, [scopedCategories, spendingMap]);

  // 1. Donut / Pie Chart Data
  const pieChartData = useMemo(() => {
    if (hasTransactions && chartMode === 'spending') {
      const expenses = transactions.filter((t: any) => t.type === 'expense');
      const spendingByCat: Record<string, number> = {};

      expenses.forEach((t: any) => {
        const catName = scopedCategories.find((c) => String(c.id) === resolveCategoryId(t))?.name || 'General';
        spendingByCat[catName] = (spendingByCat[catName] || 0) + Number(t.amount || 0);
      });

      const items = Object.keys(spendingByCat).map((name, i) => ({
        value: spendingByCat[name],
        text: `${spendingByCat[name].toFixed(0)}`,
        color: NEON_PALETTE[i % NEON_PALETTE.length],
        label: name,
      }));

      return items.length > 0 
        ? items 
        : [{ value: 1, text: '0', color: '#1E2D3D', label: 'No Expenses' }];
    }

    if (scopedCategories.length > 0) {
      return scopedCategories.map((cat, i) => ({
        value: plannedOf(cat) > 0 ? plannedOf(cat) : 1,
        text: `${cat.name}`,
        color: NEON_PALETTE[i % NEON_PALETTE.length],
        label: cat.name,
      }));
    }

    return [{ value: 1, text: '0', color: '#1E2D3D', label: 'No Data' }];
  }, [hasTransactions, chartMode, transactions, scopedCategories, resolveCategoryId]);

  const totalDonutValue = pieChartData.reduce(
  (sum, item) =>
    sum + (item.label !== 'No Data' && item.label !== 'No Expenses' ? item.value : 0),
    0
  );

  // Forecast view-model: only trust data stamped with the selected month
  const forecastReady = forecastState?.month === selectedMonth;
  const forecastOver = !!forecastState?.data && forecastState.data.totalPredictedSpend > forecastState.data.totalPlannedBudget + 0.005;
  const forecastEnvelopes = useMemo(
    () =>
      ((forecastReady && forecastState?.data?.envelopes) || [])
        .filter((e: any) => Number(e.predictedSpend) > 0 || Number(e.plannedBudget) > 0)
        .slice(0, 8),
    [forecastReady, forecastState]
  );

  // Rolling 3-month window ending on the selected month
  const trajectory = useMemo(() => {
    const months = [shiftMonthKey(selectedMonth, -2), shiftMonthKey(selectedMonth, -1), selectedMonth];
    return months.map((key) => {
      const txs = (allTransactions as any[]).filter(
        (t) => (t.type === 'income' || t.type === 'expense') && getTransactionMonthKey(t) === key
      );
      const income = sumByType(txs, 'income');
      const expenses = sumByType(txs, 'expense');
      return { key, label: monthShort(key), income, expenses, net: income - expenses };
    });
  }, [allTransactions, selectedMonth]);

  const trajectoryEmpty = trajectory.every((m) => m.income === 0 && m.expenses === 0);
  const trajectoryMax = useMemo(
    () => Math.max(1, Math.ceil(Math.max(...trajectory.flatMap((m) => [m.income, m.expenses, m.net, 0])) * 1.2)),
    [trajectory]
  );
  const trajectorySpacing = Math.max(20, (CHART_WIDTH - 90) / 2);

  if (!isUserLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00D293" />
      </View>
    );
  }

  // Full-screen spinner only for the very first load; later month switches keep the page mounted
  const isInitialLoading = !!userId && loadedMonth === null && (isTxLoading || isCatLoading || isSavLoading);

  if (isInitialLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00D293" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Financial Analytics</Text>
          <Text style={styles.headerSub}>
            {!hasTransactions ? 'Projected Envelope Allocations' : `Insights for ${formatMonthKey(selectedMonth)}`}
          </Text>
        </View>
      </View>

      <MonthSelector style={styles.monthSelector} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D293" colors={['#00D293']} />}
      >
        {/* Onboarding Banner for zero transactions */}
        {!hasTransactions && (
          <View style={styles.welcomeBanner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="sparkles" size={20} color="#00D293" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Budget Projections Active</Text>
              <Text style={styles.bannerSubtitle}>
                No transactions recorded in {formatMonthKey(selectedMonth)}. Graphs are displaying projections based on your planned targets.
              </Text>
            </View>
          </View>
        )}

        {/* 0. KPI summary: selected month vs previous month */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Monthly Overview</Text>
              <Text style={styles.cardSubtitle}>{formatMonthKey(selectedMonth)}</Text>
            </View>
            {comparison.expenseChange !== null && (
              <View
                style={[
                  styles.momBadge,
                  comparison.expenseChange > 0 ? styles.momBadgeBad : comparison.expenseChange < 0 ? styles.momBadgeGood : null,
                ]}
              >
                <Text
                  style={[
                    styles.momBadgeText,
                    { color: comparison.expenseChange > 0 ? '#FF6B6B' : comparison.expenseChange < 0 ? '#00D293' : '#64748B' },
                  ]}
                >
                  {comparison.expenseChange > 0 ? '↑' : comparison.expenseChange < 0 ? '↓' : '→'}{' '}
                  {Math.abs(comparison.expenseChange).toFixed(0)}% vs {monthShort(previousMonth)}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.kpiGrid}>
            {[
              { label: 'Total Income', value: fmtMoney(comparison.income), color: '#FFFFFF' },
              { label: 'Total Spent', value: fmtMoney(comparison.expenses), color: '#FFFFFF' },
              { label: 'Net Saved', value: fmtMoney(comparison.net), color: comparison.net < 0 ? '#FF6B6B' : '#00D293' },
              {
                label: 'Savings Rate',
                value: comparison.savingsRate === null ? '—' : `${comparison.savingsRate.toFixed(0)}%`,
                color: comparison.savingsRate !== null && comparison.savingsRate < 0 ? '#FF6B6B' : '#FFFFFF',
              },
            ].map((item) => (
              <View key={item.label} style={styles.kpiTile}>
                <Text style={styles.compareLabel}>{item.label.toUpperCase()}</Text>
                <Text style={[styles.kpiValue, { color: item.color }]} numberOfLines={1} adjustsFontSizeToFit>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* 1. Donut Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>
                {chartMode === 'spending' && hasTransactions ? 'Category Spending' : 'Envelope Distribution'}
              </Text>
              <Text style={styles.cardSubtitle}>
                {chartMode === 'spending' && hasTransactions ? 'Actual expenses' : 'Planned budget proportions'}
              </Text>
            </View>

            {hasTransactions && (
              <TouchableOpacity
                style={styles.togglePill}
                onPress={() => setChartMode(chartMode === 'spending' ? 'budget' : 'spending')}
              >
                <Text style={styles.togglePillText}>
                  {chartMode === 'spending' ? 'Show Target' : 'Show Spend'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {hasCategories ? (
            <View style={styles.donutWrapper}>
              <PieChart
                data={pieChartData}
                donut
                isAnimated
                animationDuration={800}
                radius={80}
                innerRadius={55}
                innerCircleColor="#0C1521"
                centerLabelComponent={() => (
                  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={styles.donutCenterSub}>Total</Text>
                    <Text style={styles.donutCenterVal}>${totalDonutValue.toFixed(0)}</Text>
                  </View>
                )}
              />

              <View style={styles.legendContainer}>
                {pieChartData.map((item, idx) => (
                  <View key={idx} style={styles.legendRow}>
                    <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                    <Text style={styles.legendLabel} numberOfLines={1}>{item.label}</Text>
                    <Text style={styles.legendValue}>
                      ${item.label === 'No Expenses' || item.label === 'No Data' ? '0' : Number(item.value).toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateBox}>
              <Ionicons name="pie-chart-outline" size={32} color="#00D293" />
              <Text style={styles.emptyText}>No categories created yet to graph.</Text>
            </View>
          )}
        </View>

        {/* 2. Envelope pacing: planned vs spent */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Envelope Pacing</Text>
              <Text style={styles.cardSubtitle}>Planned vs spent · tap an envelope for details</Text>
            </View>
          </View>

          {!envelopesReady ? (
            <ActivityIndicator size="small" color="#00D293" style={{ marginVertical: 24 }} />
          ) : !hasCategories ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="bar-chart-outline" size={32} color="#00D293" />
              <Text style={styles.emptyText}>Add spending envelopes to see how you are pacing.</Text>
            </View>
          ) : (
            envelopeRows.map((row) => {
              const color = pacingColor(row.util);
              const fill = row.planned > 0 ? Math.min(100, row.util * 100) : row.spent > 0 ? 100 : 0;
              const expanded = expandedId === row.id;
              const txs = (categoryTxMap[row.id] || [])
                .slice()
                .sort((a: any, b: any) => String(b.transaction_date || b.created_at).localeCompare(String(a.transaction_date || a.created_at)));
              const merchants: Record<string, { name: string; total: number; count: number }> = {};
              txs.forEach((t: any) => {
                const key = String(t.title || 'Untitled').trim().toLowerCase();
                merchants[key] = merchants[key] || { name: String(t.title || 'Untitled').trim(), total: 0, count: 0 };
                merchants[key].total += Number(t.amount || 0);
                merchants[key].count += 1;
              });
              const topMerchants = Object.values(merchants).sort((a, b) => b.total - a.total).slice(0, 3);

              return (
                <View key={row.id} style={styles.pacingRow}>
                  <TouchableOpacity activeOpacity={0.8} onPress={() => setExpandedId(expanded ? null : row.id)}>
                    <View style={styles.pacingTop}>
                      <Text style={styles.pacingName} numberOfLines={1}>{row.name}</Text>
                      <Text style={styles.pacingVals}>
                        {fmtMoney(row.spent, 2)} / {fmtMoney(row.planned, 2)}
                      </Text>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="#64748B" />
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.trackFill, { width: `${fill}%`, backgroundColor: color }]} />
                    </View>
                    <Text style={[styles.pacingStatus, { color }]}>
                      {row.left >= 0 ? `${fmtMoney(row.left, 2)} left` : `${fmtMoney(Math.abs(row.left), 2)} over`}
                    </Text>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.detailBox}>
                      {txs.length === 0 ? (
                        <Text style={styles.detailEmpty}>No spending recorded in {formatMonthKey(selectedMonth)}.</Text>
                      ) : (
                        <>
                          <Text style={styles.detailHeading}>TOP MERCHANTS</Text>
                          {topMerchants.map((m) => (
                            <View key={m.name} style={styles.detailRow}>
                              <Text style={styles.detailName} numberOfLines={1}>
                                {m.name}{m.count > 1 ? ` ×${m.count}` : ''}
                              </Text>
                              <Text style={styles.detailAmt}>{fmtMoney(m.total, 2)}</Text>
                            </View>
                          ))}
                          <Text style={[styles.detailHeading, { marginTop: 10 }]}>RECENT TRANSACTIONS</Text>
                          {txs.slice(0, 5).map((t: any, i: number) => (
                            <View key={String(t.id ?? i)} style={styles.detailRow}>
                              <Text style={styles.detailDate}>{String(t.transaction_date || t.created_at).slice(5, 10)}</Text>
                              <Text style={styles.detailName} numberOfLines={1}>{t.title || 'Untitled'}</Text>
                              <Text style={styles.detailAmt}>{fmtMoney(Number(t.amount || 0), 2)}</Text>
                            </View>
                          ))}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Projected month-end spend (ML forecast: recurring bills + Holt-Winters on variable spend) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Projected Month-End Spend</Text>
              <Text style={styles.cardSubtitle}>Forecast for {formatMonthKey(selectedMonth)} · estimates, not guarantees</Text>
            </View>
          </View>

          {!forecastReady ? (
            <ActivityIndicator size="small" color="#00D293" style={{ marginVertical: 24 }} />
          ) : !forecastState?.available || !forecastState.data ? (
            <View style={styles.lineEmptyBox}>
              <Text style={styles.emptyText}>Forecast is unavailable right now. Pull down to try again.</Text>
            </View>
          ) : (
            <>
              <View style={styles.kpiGrid}>
                <View style={styles.kpiTile}>
                  <Text style={styles.compareLabel}>PLANNED BUDGET</Text>
                  <Text style={[styles.kpiValue, { color: '#FFFFFF' }]} numberOfLines={1} adjustsFontSizeToFit>
                    {fmtMoney(forecastState.data.totalPlannedBudget)}
                  </Text>
                </View>
                <View style={styles.kpiTile}>
                  <Text style={styles.compareLabel}>PROJECTED SPEND</Text>
                  <Text
                    style={[styles.kpiValue, { color: forecastOver ? '#EF4444' : '#00D293' }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {fmtMoney(forecastState.data.totalPredictedSpend)}
                  </Text>
                </View>
              </View>
              <Text style={[styles.pacingStatus, { color: forecastOver ? '#EF4444' : '#00D293', marginTop: 8 }]}>
                {forecastOver
                  ? `${fmtMoney(forecastState.data.totalPredictedSpend - forecastState.data.totalPlannedBudget)} projected over budget`
                  : `${fmtMoney(forecastState.data.totalPlannedBudget - forecastState.data.totalPredictedSpend)} projected under budget`}
              </Text>

              {forecastEnvelopes.map((e: any) => {
                const over = e.projectedDelta > 0.005;
                return (
                  <View key={e.categoryId} style={styles.fcRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pacingName} numberOfLines={1}>{e.categoryName}</Text>
                      <Text style={styles.fcSub}>
                        {fmtMoney(e.predictedSpend, 2)} projected of {fmtMoney(e.plannedBudget, 2)}
                      </Text>
                    </View>
                    <View style={styles.fcTag}>
                      <Text style={styles.fcTagText}>{MODEL_LABELS[e.modelUsed] || 'Baseline'}</Text>
                    </View>
                    <Text style={[styles.fcDelta, { color: over ? '#EF4444' : '#00D293' }]}>
                      {over ? '↑' : '↓'} {fmtMoney(Math.abs(e.projectedDelta), 0)}
                    </Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* 3. Net cash trajectory: rolling 3 months */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Net Cash Trajectory</Text>
              <Text style={styles.cardSubtitle}>
                Income, expenses and net · {formatMonthKey(trajectory[0].key, true)} – {formatMonthKey(trajectory[2].key, true)}
              </Text>
            </View>
          </View>

          <View style={styles.barLegendRow}>
            {[
              { label: 'Income', color: '#00D293' },
              { label: 'Expenses', color: '#FF6B6B' },
              { label: 'Net', color: '#38BDF8' },
            ].map((l) => (
              <View key={l.label} style={styles.legendRow}>
                <View style={[styles.legendIndicator, { backgroundColor: l.color }]} />
                <Text style={styles.legendLabel}>{l.label}</Text>
              </View>
            ))}
          </View>

          {trajectoryEmpty ? (
            <View style={[styles.lineEmptyBox, { width: '100%' }]}>
              <Text style={styles.emptyText}>No income or expenses recorded in these 3 months yet.</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <LineChart
                key={selectedMonth}
                data={trajectory.map((m) => ({ value: m.income, label: m.label }))}
                data2={trajectory.map((m) => ({ value: m.expenses }))}
                data3={trajectory.map((m) => ({ value: m.net }))}
                maxValue={trajectoryMax}
                isAnimated={false}
                curved={false}
                color="#00D293"
                color2="#FF6B6B"
                color3="#38BDF8"
                thickness={3}
                thickness2={3}
                thickness3={3}
                dataPointsColor="#00D293"
                dataPointsColor2="#FF6B6B"
                dataPointsColor3="#38BDF8"
                yAxisColor="#1E2D3D"
                xAxisColor="#1E2D3D"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
                width={CHART_WIDTH - 20}
                height={160}
                noOfSections={3}
                spacing={trajectorySpacing}
                initialSpacing={20}
              />
            </View>
          )}

          <View style={styles.trajTable}>
            {trajectory.map((m) => (
              <View key={m.key} style={styles.trajCol}>
                <Text style={styles.trajMonth}>{m.label}</Text>
                <Text style={[styles.trajVal, { color: '#00D293' }]}>{fmtMoney(m.income)}</Text>
                <Text style={[styles.trajVal, { color: '#FF6B6B' }]}>{fmtMoney(m.expenses)}</Text>
                <Text style={[styles.trajVal, { color: m.net < 0 ? '#FF6B6B' : '#38BDF8' }]}>{fmtMoney(m.net)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 4. Savings Goals Milestones */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Savings Goal Milestones</Text>
              <Text style={styles.cardSubtitle}>Progress towards completion targets</Text>
            </View>
          </View>

          {savingsPlans.length === 0 ? (
            <View style={styles.emptyStateBox}>
              <Ionicons name="flag-outline" size={32} color="#00D293" />
              <Text style={styles.emptyText}>No savings goals configured yet.</Text>
            </View>
          ) : (
            savingsPlans.map((plan: any) => {
              const target = Number(plan.target_amount) || 1;
              const saved = Number(plan.saved_amount) || 0;
              const progress = Math.min(100, Math.round((saved / target) * 100));

              return (
                <View key={plan.id} style={styles.progressRow}>
                  <View style={styles.progressLabelWrap}>
                    <Text style={styles.progressPlanName}>{plan.name}</Text>
                    <Text style={styles.progressPlanVals}>
                      ${saved.toLocaleString()} /${target.toLocaleString()} ({progress}%)
                    </Text>
                  </View>
                  <View style={styles.track}>
                    <View style={[styles.trackFill, { width: `${progress}%` }]} />
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#070D14',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  headerSub: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  monthSelector: {
    marginHorizontal: 20,
    marginBottom: 14,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compareItem: {
    flex: 1,
    backgroundColor: '#121E2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    padding: 10,
  },
  compareLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  compareValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  comparePrev: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  compareChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  compareChangeNeutral: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C2028',
    borderColor: '#174747',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0A171D',
    borderWidth: 1,
    borderColor: '#123D3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#9EE5CF',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#00D293',
    lineHeight: 16,
    marginTop: 2,
    opacity: 0.9,
  },
  card: {
    backgroundColor: '#0C1521',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#192839',
    overflow: 'hidden', // mathematically clips the SVG chart bleed
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  togglePill: {
    backgroundColor: '#121E2C',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00D293',
  },
  donutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
  },
  donutCenterSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  donutCenterVal: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  legendContainer: {
    flex: 1,
    marginLeft: 18,
    gap: 8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 12,
    color: '#8295AB',
  },
  legendValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  barLegendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
    marginBottom: 8,
  },
  emptyStateBox: {
    backgroundColor: '#0C1521',
    borderColor: '#162232',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
  },
  lineEmptyBox: {
    backgroundColor: '#0C1521',
    borderColor: '#192839',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 32,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  progressRow: {
    marginTop: 16,
  },
  progressLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  progressPlanName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  progressPlanVals: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  track: {
    height: 8,
    backgroundColor: '#121E2C',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: '#00D293',
    borderRadius: 4,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  kpiTile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: '#121E2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    padding: 12,
  },
  kpiValue: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 4,
  },
  momBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    alignSelf: 'flex-start',
  },
  momBadgeGood: { backgroundColor: 'rgba(0, 210, 147, 0.1)', borderColor: 'rgba(0, 210, 147, 0.3)' },
  momBadgeBad: { backgroundColor: 'rgba(255, 107, 107, 0.1)', borderColor: 'rgba(255, 107, 107, 0.3)' },
  momBadgeText: { fontSize: 11, fontWeight: '700' },
  pacingRow: {
    marginTop: 14,
  },
  pacingTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  pacingName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  pacingVals: { color: '#94A3B8', fontSize: 12 },
  pacingStatus: { fontSize: 11, fontWeight: '700', marginTop: 4 },
  detailBox: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  detailHeading: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginBottom: 6 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 3 },
  detailDate: { color: '#64748B', fontSize: 11, width: 38 },
  detailName: { flex: 1, color: '#FFFFFF', fontSize: 12 },
  detailAmt: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  detailEmpty: { color: '#64748B', fontSize: 12 },
  trajTable: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  trajCol: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#121E2C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    paddingVertical: 10,
    gap: 2,
  },
  trajMonth: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  trajVal: { fontSize: 12, fontWeight: '700' },
  fcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  fcSub: { color: '#64748B', fontSize: 11, marginTop: 2 },
  fcTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  fcTagText: { color: '#38BDF8', fontSize: 10, fontWeight: '700' },
  fcDelta: { fontSize: 12, fontWeight: '800', minWidth: 54, textAlign: 'right' },
});