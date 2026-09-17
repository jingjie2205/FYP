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
import { BarChart, PieChart, LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useSavings } from '@/hooks/useSavings';
import { COLORS } from '@/constants/colors';

const { width } = Dimensions.get('window');
const CHART_WIDTH = width - 64;

const PALETTE = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', 
  '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
];

type TimeRange = '1M' | '3M' | '6M' | 'ALL';

export default function AnalyticsScreen() {
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const userId = isUserLoaded && isSignedIn ? user?.id : undefined;

  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [refreshing, setRefreshing] = useState(false);
  const [chartMode, setChartMode] = useState<'spending' | 'budget'>('spending');

  // Custom Hooks
  const { 
    transactions = [], 
    isLoading: isTxLoading, 
    loadData: fetchTx 
  } = useTransactions(userId);

  const { 
    categories = [], 
    isLoading: isCatLoading, 
    fetchCategories 
  } = useCategories(userId);

  const { 
    savingsPlans = [], 
    isLoading: isSavLoading, 
    fetchSavings 
  } = useSavings(userId);

  // Trigger initial data load when user session resolves
  useEffect(() => {
    if (userId) {
      fetchTx();
      fetchCategories();
      fetchSavings();
    }
  }, [userId, fetchTx, fetchCategories, fetchSavings]);

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    await Promise.all([fetchTx(), fetchCategories(), fetchSavings()]);
    setRefreshing(false);
  }, [userId, fetchTx, fetchCategories, fetchSavings]);

  const hasTransactions = transactions.length > 0;
  const hasCategories = categories.length > 0;

  // 1. Donut / Pie Chart Data
  const pieChartData = useMemo(() => {
    if (hasTransactions && chartMode === 'spending') {
      const expenses = transactions.filter((t: any) => t.type === 'expense');
      const spendingByCat: Record<string, number> = {};

      expenses.forEach((t: any) => {
        const catName = categories.find((c) => c.id === t.category_id)?.name || 'General';
        spendingByCat[catName] = (spendingByCat[catName] || 0) + Number(t.amount || 0);
      });

      const items = Object.keys(spendingByCat).map((name, i) => ({
        value: spendingByCat[name],
        text: `${spendingByCat[name].toFixed(0)}`,
        color: PALETTE[i % PALETTE.length],
        label: name,
      }));

      return items.length > 0 
        ? items 
        : [{ value: 1, text: '0', color: '#E5E7EB', label: 'No Expenses' }];
    }

    // Default or Fallback for new accounts: Planned Envelope Allocation
    if (categories.length > 0) {
      return categories.map((cat, i) => ({
        value: Number(cat.target_amount) > 0 ? Number(cat.target_amount) : 1,
        text: `${cat.name}`,
        color: PALETTE[i % PALETTE.length],
        label: cat.name,
      }));
    }

    return [{ value: 1, text: '0', color: '#E5E7EB', label: 'No Data' }];
  }, [hasTransactions, chartMode, transactions, categories]);

  const totalDonutValue = pieChartData.reduce((sum, item) => sum + (item.label !== 'No Data' ? item.value : 0), 0);

  // 2. Grouped Bar Chart Data: Target vs Actual Spent
  const groupedBarData = useMemo(() => {
    const data: any[] = [];
    categories.slice(0, 5).forEach((cat) => {
      const target = Number(cat.target_amount || 0);
      const spent = Math.max(0, target - Number(cat.current_amount || 0));

      data.push({
        value: target,
        label: cat.name.length > 6 ? `${cat.name.slice(0, 5)}…` : cat.name,
        spacing: 4,
        labelWidth: 50,
        labelTextStyle: { color: '#6B7280', fontSize: 10 },
        frontColor: '#93C5FD',
      });
      data.push({
        value: spent,
        frontColor: COLORS.primary,
      });
    });
    return data;
  }, [categories]);

  // 3. Cash Flow Trajectory Line Data
  const lineChartData = useMemo(() => {
    if (!hasTransactions) {
      return [
        { value: 0, label: 'W1' },
        { value: 0, label: 'W2' },
        { value: 0, label: 'W3' },
        { value: 0, label: 'W4' },
      ];
    }

    const sorted = [...transactions].sort(
      (a: any, b: any) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime()
    );

    let cumulative = 0;
    return sorted.slice(-8).map((t: any, idx) => {
      const amt = Number(t.amount || 0);
      cumulative += t.type === 'income' ? amt : -amt;
      return {
        value: cumulative,
        label: `D${idx + 1}`,
      };
    });
  }, [transactions, hasTransactions]);

  // Only lock with full-screen spinner if Clerk user hasn't loaded yet
  if (!isUserLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const isInitialLoading = (isTxLoading || isCatLoading || isSavLoading) && !refreshing && !hasCategories && !hasTransactions;

  if (isInitialLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
            {!hasTransactions ? 'Projected Envelope Allocations' : 'Real-Time Portfolio Insights'}
          </Text>
        </View>

        <View style={styles.timeFilterWrap}>
          {(['1M', '3M', '6M', 'ALL'] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.timeBtn, timeRange === range && styles.timeBtnActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.timeBtnText, timeRange === range && styles.timeBtnTextActive]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Onboarding Banner for zero transactions */}
        {!hasTransactions && (
          <View style={styles.welcomeBanner}>
            <View style={styles.bannerIconWrap}>
              <Ionicons name="sparkles" size={20} color={COLORS.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Budget Projections Active</Text>
              <Text style={styles.bannerSubtitle}>
                No transactions recorded yet. Graphs are displaying projections based on your planned targets.
              </Text>
            </View>
          </View>
        )}

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
                radius={80}
                innerRadius={55}
                innerCircleColor={COLORS.card}
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
                    <Text style={styles.legendValue}>${Number(item.value).toFixed(0)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="pie-chart-outline" size={36} color="#9CA3AF" />
              <Text style={styles.emptyCardText}>No categories created yet to graph.</Text>
            </View>
          )}
        </View>

        {/* 2. Grouped Bar Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Planned vs Spent Envelopes</Text>
              <Text style={styles.cardSubtitle}>Target allocation compared to actual spend</Text>
            </View>
          </View>

          <View style={styles.barLegendRow}>
            <View style={styles.legendRow}>
              <View style={[styles.legendIndicator, { backgroundColor: '#93C5FD' }]} />
              <Text style={styles.legendLabel}>Target</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIndicator, { backgroundColor: COLORS.primary }]} />
              <Text style={styles.legendLabel}>Spent</Text>
            </View>
          </View>

          {hasCategories ? (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <BarChart
                data={groupedBarData}
                barWidth={18}
                spacing={24}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={1}
                yAxisThickness={0}
                xAxisColor="#E5E7EB"
                yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
                noOfSections={4}
                width={CHART_WIDTH - 20}
                height={180}
              />
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="bar-chart-outline" size={36} color="#9CA3AF" />
              <Text style={styles.emptyCardText}>Add spending envelopes to view bar comparisons.</Text>
            </View>
          )}
        </View>

        {/* 3. Line / Trajectory Chart Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={styles.cardTitle}>Net Cash Trajectory</Text>
              <Text style={styles.cardSubtitle}>Cumulative net cash over time</Text>
            </View>
          </View>

          <View style={{ alignItems: 'center', marginTop: 10 }}>
            <LineChart
              data={lineChartData}
              areaChart
              curved
              startFillColor="rgba(37, 99, 235, 0.2)"
              endFillColor="rgba(37, 99, 235, 0.01)"
              startOpacity={0.8}
              endOpacity={0.1}
              color={COLORS.primary}
              thickness={3}
              hideDataPoints={!hasTransactions}
              dataPointsColor={COLORS.primary}
              yAxisColor="#E5E7EB"
              xAxisColor="#E5E7EB"
              yAxisTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#9CA3AF', fontSize: 10 }}
              width={CHART_WIDTH - 20}
              height={160}
              noOfSections={3}
            />
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
            <View style={styles.emptyCard}>
              <Ionicons name="flag-outline" size={36} color="#9CA3AF" />
              <Text style={styles.emptyCardText}>No savings goals configured yet.</Text>
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
                      ${saved.toLocaleString()} / ${target.toLocaleString()} ({progress}%)
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
    backgroundColor: COLORS.background,
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerSub: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  timeFilterWrap: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    padding: 2,
  },
  timeBtn: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  timeBtnActive: {
    backgroundColor: COLORS.card,
    elevation: 1,
  },
  timeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  timeBtnTextActive: {
    color: COLORS.primary,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 16,
  },
  welcomeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 12,
  },
  bannerIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DBEAFE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E40AF',
  },
  bannerSubtitle: {
    fontSize: 11,
    color: '#3B82F6',
    lineHeight: 16,
    marginTop: 2,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  cardSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 1,
  },
  togglePill: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  togglePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  donutWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  donutCenterSub: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  donutCenterVal: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },
  legendContainer: {
    flex: 1,
    marginLeft: 18,
    gap: 6,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
    fontSize: 11,
    color: '#4B5563',
  },
  legendValue: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.text,
  },
  barLegendRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 14,
    marginBottom: 4,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyCardText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  progressRow: {
    marginTop: 12,
  },
  progressLabelWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPlanName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  progressPlanVals: {
    fontSize: 11,
    color: '#6B7280',
  },
  track: {
    height: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 4,
  },
});