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
        color: NEON_PALETTE[i % NEON_PALETTE.length],
        label: name,
      }));

      return items.length > 0 
        ? items 
        : [{ value: 1, text: '0', color: '#1E2D3D', label: 'No Expenses' }];
    }

    if (categories.length > 0) {
      return categories.map((cat, i) => ({
        value: Number(cat.target_amount) > 0 ? Number(cat.target_amount) : 1,
        text: `${cat.name}`,
        color: NEON_PALETTE[i % NEON_PALETTE.length],
        label: cat.name,
      }));
    }

    return [{ value: 1, text: '0', color: '#1E2D3D', label: 'No Data' }];
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
        labelTextStyle: { color: '#64748B', fontSize: 10 },
        frontColor: '#1E2D3D', // Muted dark for target
      });
      data.push({
        value: spent,
        frontColor: '#00D293', // Emerald for actual spent
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

  if (!isUserLoaded) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#00D293" />
      </View>
    );
  }

  const isInitialLoading = (isTxLoading || isCatLoading || isSavLoading) && !refreshing && !hasCategories && !hasTransactions;

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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D293" />}
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
                isAnimated
                animationDuration={800}
                radius={80}
                innerRadius={55}
                innerCircleColor="#0C1521" // Matches card background perfectly
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
            <View style={styles.emptyStateBox}>
              <Ionicons name="pie-chart-outline" size={32} color="#00D293" />
              <Text style={styles.emptyText}>No categories created yet to graph.</Text>
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
              <View style={[styles.legendIndicator, { backgroundColor: '#1E2D3D' }]} />
              <Text style={styles.legendLabel}>Target</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendIndicator, { backgroundColor: '#00D293' }]} />
              <Text style={styles.legendLabel}>Spent</Text>
            </View>
          </View>

          {hasCategories ? (
            <View style={{ alignItems: 'center', marginTop: 10 }}>
              <BarChart
                data={groupedBarData}
                isAnimated
                barWidth={18}
                spacing={24}
                roundedTop
                roundedBottom
                hideRules
                xAxisThickness={1}
                yAxisThickness={0}
                xAxisColor="#1E2D3D"
                yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
                noOfSections={4}
                width={CHART_WIDTH - 20}
                height={180}
              />
            </View>
          ) : (
            <View style={styles.emptyStateBox}>
              <Ionicons name="bar-chart-outline" size={32} color="#00D293" />
              <Text style={styles.emptyText}>Add spending envelopes to view bar comparisons.</Text>
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
              isAnimated
              animateOnDataChange
              animationDuration={1000}
              areaChart
              curved
              startFillColor="rgba(0, 210, 147, 0.3)"
              endFillColor="rgba(0, 210, 147, 0.01)"
              startOpacity={0.8}
              endOpacity={0.1}
              color="#00D293"
              thickness={3}
              hideDataPoints={!hasTransactions}
              dataPointsColor="#00D293"
              yAxisColor="#1E2D3D"
              xAxisColor="#1E2D3D"
              yAxisTextStyle={{ color: '#64748B', fontSize: 10 }}
              xAxisLabelTextStyle={{ color: '#64748B', fontSize: 10 }}
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
  timeFilterWrap: {
    flexDirection: 'row',
    backgroundColor: '#121E2C',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#192839',
  },
  timeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  timeBtnActive: {
    backgroundColor: '#0C1521',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  timeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  timeBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
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
});