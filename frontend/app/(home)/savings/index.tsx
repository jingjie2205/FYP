import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, Alert, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';

// Hooks
import { useCategories, Category, GroupedCategory } from '@/hooks/useCategories';
import { useSavings, SavingsPlan } from '@/hooks/useSavings';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { useMonth } from '@/hooks/useMonth';
import { getTransactionMonthKey, formatMonthKey, shiftMonthKey } from '@/utils/month';
import MonthSelector from '@/components/MonthSelector';

// UI Components
import GroupItem from '@/components/plan/GroupItem';
import SavingsItem from '@/components/plan/SavingsItem';
import PoolCard from '@/components/plan/PoolCard';

// Modals
import CoverModal from '@/components/plan/modals/CoverModal';
import GroupModal from '@/components/plan/modals/GroupModal';
import CategoryModal from '@/components/plan/modals/CategoryModal';
import SavingsModal from '@/components/plan/modals/SavingsModal';
import SavingsFundsModal from '@/components/plan/modals/SavingsFundsModal';

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;
  const { selectedMonth, isCurrentMonth, rolloverReady, rolloverVersion } = useMonth();
  // Past months are view-only: editing them would invalidate the rollover already carried into later months
  const readOnly = !isCurrentMonth;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Data Hooks - Now pulling raw accounts instead of the static total
  const { accounts = [], fetchAccounts } = useAccounts(userId);
  const { transactions = [], loadData: fetchTransactions } = useTransactions(userId);
  const { categories, groupedCategories, isLoading: categoriesLoading, fetchCategories, createCategory, updateCategory, deleteCategory, createGroup, updateGroup, deleteGroup } = useCategories(userId, selectedMonth);
  const { savingsPlans, isLoading: savingsLoading, fetchSavings, createSavingsPlan, updateSavingsPlan, deleteSavingsPlan, contributeToPlan, withdrawFromPlan } = useSavings(userId);

  // ==========================================
  // DYNAMIC RUNNING BALANCE CALCULATION
  // ==========================================
  const liveTotalAccountsBalance = useMemo(() => {
    // 1. Group transactions by account
    const accTxsMap: Record<string, any[]> = {};
    (transactions || []).forEach((t: any) => {
      if (!accTxsMap[t.account_id]) accTxsMap[t.account_id] = [];
      accTxsMap[t.account_id].push(t);
    });

    let total = 0;

    // 2. Map individual cards securely to avoid double-counting
    (accounts || []).forEach((acc: any) => {
      const baseBalance = Number(acc.balance || 0);
      const accTxs = accTxsMap[acc.id] || [];
      
      let netTransactionFlow = 0;
      let hasInitialTxInLedger = false;

      accTxs.forEach((t) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') netTransactionFlow += amt;
        else if (t.type === 'expense') netTransactionFlow -= amt;

        const txName = String(t.name || t.title || t.description || '').toLowerCase();
        if (txName.includes('initial balance')) {
          hasInitialTxInLedger = true;
        }
      });

      // If the backend already created an "Initial Balance" transaction, 
      // adding the baseBalance again causes double-counting.
      total += hasInitialTxInLedger ? netTransactionFlow : baseBalance + netTransactionFlow;
    });

    return total;
  }, [accounts, transactions]);

  // Spending per envelope for the SELECTED month only
  const categorySpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions
      .filter((t: any) => t.type === 'expense' && getTransactionMonthKey(t) === selectedMonth)
      .forEach((t: any) => {
        if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount || 0);
      });
    return map;
  }, [transactions, selectedMonth]);

  // Available in an envelope = carried-over leftover + assigned this month - spent this month
  const getAvailable = useCallback(
    (cat: Category) => Number(cat.rollover || 0) + Number(cat.target_amount || 0) - (categorySpendingMap[cat.id] || 0),
    [categorySpendingMap]
  );

  // Summary of the selected month (shown instead of the pool card for past months)
  const monthSummary = useMemo(() => {
    const assigned = categories.reduce((sum, c) => sum + Number(c.target_amount || 0), 0);
    const rolledIn = categories.reduce((sum, c) => sum + Number(c.rollover || 0), 0);
    const spent = categories.reduce((sum, c) => sum + (categorySpendingMap[c.id] || 0), 0);
    const rolledOut = categories.reduce((sum, c) => sum + Math.max(0, getAvailable(c)), 0);
    return { assigned, rolledIn, spent, rolledOut };
  }, [categories, categorySpendingMap, getAvailable]);

  // Pool Calculations using the LIVE ledger balance
  const totalCategoryAvailable = categories.reduce((sum, cat) => sum + Math.max(0, getAvailable(cat)), 0);
  const totalAllocatedSavings = savingsPlans.reduce((sum, plan) => sum + Number(plan.saved_amount || 0), 0);
  const availablePool = liveTotalAccountsBalance - (totalCategoryAvailable + totalAllocatedSavings);

  // Modal Visibility States
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [savingsModalVisible, setSavingsModalVisible] = useState(false);
  const [coverModalVisible, setCoverModalVisible] = useState(false);
  const [fundsModal, setFundsModal] = useState<{ plan: SavingsPlan; mode: 'add' | 'withdraw' } | null>(null);

  // Active Edit States
  const [editingGroup, setEditingGroup] = useState<GroupedCategory | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSavings, setEditingSavings] = useState<SavingsPlan | null>(null);
  const [overspentCategory, setOverspentCategory] = useState<Category | null>(null);

  // Overspending Calculations
  const shortfallAmount = useMemo(() => {
    if (!overspentCategory) return 0;
    return Math.max(0, -getAvailable(overspentCategory));
  }, [overspentCategory, getAvailable]);

  const eligibleDonors = useMemo(() => categories.filter(cat => cat.id !== overspentCategory?.id && getAvailable(cat) >= shortfallAmount), [categories, getAvailable, shortfallAmount, overspentCategory]);

  const loadAllData = useCallback(async () => {
    await Promise.all([fetchAccounts(), fetchCategories(), fetchSavings(), fetchTransactions()]);
  }, [fetchAccounts, fetchCategories, fetchSavings, fetchTransactions]);

  // Wait for the monthly rollover so the current month's envelopes exist before fetching
  useEffect(() => { if (userId && rolloverReady) loadAllData(); }, [userId, rolloverReady, rolloverVersion, loadAllData]);

  // ===================== HANDLERS =====================
  const handleOpenCreateModal = () => {
    if (activeTab === 'spending') {
      setEditingGroup(null);
      setGroupModalVisible(true);
    } else {
      setEditingSavings(null);
      setSavingsModalVisible(true);
    }
  };

  const handleSaveGroup = async (name: string) => {
    if (!name.trim()) return Alert.alert('Error', 'Please enter a group name.');
    if (editingGroup) await updateGroup(editingGroup.id, name.trim());
    else await createGroup(name.trim());
    setGroupModalVisible(false);
    fetchCategories();
  };

  const handleSaveCategory = async (name: string, targetAmount: number) => {
    if (!name.trim()) return Alert.alert('Error', 'Please enter a category name.');
    if (editingCategory) {
      const spent = categorySpendingMap[editingCategory.id] || 0;
      const rollover = Number(editingCategory.rollover || 0);
      await updateCategory(editingCategory.id, { name: name.trim(), target_amount: targetAmount, current_amount: Math.max(0, rollover + targetAmount - spent) });
    } else if (activeGroupId) {
      await createCategory({ name: name.trim(), target_amount: targetAmount, group_id: activeGroupId });
    }
    setCategoryModalVisible(false);
    fetchCategories();
  };

  const handleSaveSavings = async (payload: { name: string; target_amount: number; deadline: string }) => {
    if (!payload.name.trim() || !payload.target_amount) return Alert.alert('Error', 'Provide a name and target.');
    if (editingSavings) await updateSavingsPlan(editingSavings.id, payload);
    else await createSavingsPlan(payload);
    setSavingsModalVisible(false);
    fetchSavings();
  };

  // Add funds / withdraw: the pool is recomputed from the refreshed ledger afterwards
  const handleConfirmFunds = async (amount: number) => {
    if (!fundsModal) return;
    const { plan, mode } = fundsModal;
    const ok = mode === 'add' ? await contributeToPlan(plan.id, amount) : await withdrawFromPlan(plan.id, amount);
    if (ok) {
      setFundsModal(null);
      fetchTransactions();
    }
  };

  const handleCoverOverspending = async (donorSourceId: string) => {
    if (!overspentCategory) return;
    // Covering is a one-off for this month, so it does not change the default budget for future months
    const monthOnly = { applyToDefault: false };
    if (donorSourceId === 'pool') {
      await updateCategory(overspentCategory.id, { target_amount: Number(overspentCategory.target_amount || 0) + shortfallAmount }, monthOnly);
    } else {
      const donorCat = categories.find(c => c.id === donorSourceId);
      if (donorCat) {
        await updateCategory(overspentCategory.id, { target_amount: Number(overspentCategory.target_amount || 0) + shortfallAmount }, monthOnly);
        await updateCategory(donorCat.id, { target_amount: Number(donorCat.target_amount || 0) - shortfallAmount }, monthOnly);
      }
    }
    setCoverModalVisible(false);
    fetchCategories();
  };

  const promptDelete = (title: string, message: string, action: () => Promise<any>, hideModal: () => void, refresh: () => void) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await action(); hideModal(); refresh(); } }
    ]);
  };

  // ===================== RENDER =====================
  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <MonthSelector style={styles.monthSelector} />

      {isCurrentMonth ? (
        /* Pass the live mathematical balance instead of the static database pull */
        <PoolCard availablePool={availablePool} totalAccountsBalance={liveTotalAccountsBalance} />
      ) : (
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{formatMonthKey(selectedMonth)} summary</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ROLLED IN</Text>
              <Text style={styles.summaryValue}>${monthSummary.rolledIn.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>ASSIGNED</Text>
              <Text style={styles.summaryValue}>${monthSummary.assigned.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>SPENT</Text>
              <Text style={[styles.summaryValue, { color: '#FF6B6B' }]}>${monthSummary.spent.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={styles.summaryFoot}>
            ${monthSummary.rolledOut.toFixed(2)} left over · carried into {formatMonthKey(shiftMonthKey(selectedMonth, 1), true)}
          </Text>
        </View>
      )}

      <View style={styles.tabActionRow}>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'spending' && styles.activeTab]} onPress={() => setActiveTab('spending')}>
            <Text style={[styles.tabText, activeTab === 'spending' && styles.activeTabText]}>Envelopes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'savings' && styles.activeTab]} onPress={() => setActiveTab('savings')}>
            <Text style={[styles.tabText, activeTab === 'savings' && styles.activeTabText]}>Savings Goals</Text>
          </TouchableOpacity>
        </View>
        {/* Envelopes of past months are view-only; savings goals are not monthly so they stay editable */}
        {!(readOnly && activeTab === 'spending') && (
          <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateModal}>
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={styles.addBtnText}>{activeTab === 'spending' ? 'New Group' : 'New Goal'}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          categoriesLoading && !refreshing ? <ActivityIndicator size="large" color="#00D293" style={{ marginTop: 40 }} /> : (
            <FlatList 
              data={readOnly ? groupedCategories.filter(g => g.categories.length > 0) : groupedCategories}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={readOnly ? <Text style={styles.emptyText}>No envelopes were tracked for {formatMonthKey(selectedMonth)}.</Text> : null}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData().finally(() => setRefreshing(false)); }} tintColor="#00D293" />}
              renderItem={({ item }) => (
                <GroupItem 
                  group={item}
                  isCollapsed={collapsedGroups[item.id]}
                  spendingMap={categorySpendingMap}
                  readOnly={readOnly}
                  onToggle={(id) => setCollapsedGroups(prev => ({ ...prev, [id]: !prev[id] }))}
                  onAddCategory={(groupId) => { setActiveGroupId(groupId); setEditingCategory(null); setCategoryModalVisible(true); }}
                  onEditGroup={(group) => { setEditingGroup(group); setGroupModalVisible(true); }}
                  onEditCategory={(cat) => { setEditingCategory(cat); setCategoryModalVisible(true); }}
                  onCoverCategory={(cat) => { setOverspentCategory(cat); setCoverModalVisible(true); }}
                />
              )}
            />
          )
        ) : (
          savingsLoading && !refreshing ? <ActivityIndicator size="large" color="#00D293" style={{ marginTop: 40 }} /> : (
            <FlatList 
              data={savingsPlans}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData().finally(() => setRefreshing(false)); }} tintColor="#00D293" />}
              ListHeaderComponent={readOnly ? <Text style={styles.noteText}>Savings goals show their current progress. Switch to the current month to add or withdraw funds.</Text> : null}
              renderItem={({ item }) => (
                <SavingsItem
                  item={item}
                  onEdit={(plan) => { setEditingSavings(plan); setSavingsModalVisible(true); }}
                  onContribute={readOnly ? undefined : (plan) => setFundsModal({ plan, mode: 'add' })}
                  onWithdraw={readOnly ? undefined : (plan) => setFundsModal({ plan, mode: 'withdraw' })}
                />
              )}
            />
          )
        )}
      </View>

      {/* MODALS */}
      <CoverModal
        visible={coverModalVisible}
        onClose={() => setCoverModalVisible(false)}
        onConfirm={handleCoverOverspending}
        overspentCategory={overspentCategory}
        eligibleDonors={eligibleDonors}
        availablePool={availablePool}
        shortfallAmount={shortfallAmount}
        categorySpendingMap={categorySpendingMap}
        getAvailable={getAvailable}
      />

      <GroupModal
        visible={groupModalVisible}
        initialName={editingGroup?.name}
        onClose={() => setGroupModalVisible(false)}
        onSave={handleSaveGroup}
        onDelete={editingGroup ? () => promptDelete('Delete Group', 'Delete header and all envelopes inside it?', () => deleteGroup(editingGroup.id), () => setGroupModalVisible(false), fetchCategories) : undefined}
      />

      <CategoryModal
        visible={categoryModalVisible}
        initialData={editingCategory ? { name: editingCategory.name, target: Number(editingCategory.target_amount) } : undefined}
        onClose={() => setCategoryModalVisible(false)}
        onSave={handleSaveCategory}
        onDelete={editingCategory ? () => promptDelete('Delete Envelope', 'Delete this envelope?', () => deleteCategory(editingCategory.id), () => setCategoryModalVisible(false), fetchCategories) : undefined}
      />

      <SavingsFundsModal
        visible={!!fundsModal}
        mode={fundsModal?.mode ?? 'add'}
        plan={fundsModal?.plan ?? null}
        availablePool={availablePool}
        onClose={() => setFundsModal(null)}
        onConfirm={handleConfirmFunds}
      />

      <SavingsModal
        visible={savingsModalVisible}
        initialData={editingSavings}
        onClose={() => setSavingsModalVisible(false)}
        onSave={handleSaveSavings}
        onDelete={editingSavings && deleteSavingsPlan ? () => promptDelete('Delete Savings Plan', `Delete this plan? Its $${Number(editingSavings.saved_amount || 0).toFixed(2)} saved will return to your Unallocated Cash.`, () => deleteSavingsPlan(editingSavings.id), () => setSavingsModalVisible(false), fetchSavings) : undefined}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03151E' },
  tabActionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: 16, marginBottom: 12 },
  tabContainer: { flexDirection: 'row', backgroundColor: '#0C1A25', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#1E2D3D' },
  tab: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  activeTab: { backgroundColor: '#1E2D3D' },
  tabText: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  activeTabText: { color: '#FFFFFF' },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00D293', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
  addBtnText: { color: '#03151E', fontSize: 13, fontWeight: '700', marginLeft: 4 },
  contentContainer: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  monthSelector: { marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  summaryCard: { marginHorizontal: 16, marginBottom: 16, backgroundColor: '#0C1A25', borderRadius: 16, borderWidth: 1, borderColor: '#1E2D3D', padding: 16 },
  summaryTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800', marginBottom: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { flex: 1 },
  summaryLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  summaryValue: { color: '#FFFFFF', fontSize: 15, fontWeight: '700', marginTop: 4 },
  summaryFoot: { color: '#00D293', fontSize: 12, fontWeight: '600', marginTop: 12 },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center', marginTop: 32 },
  noteText: { color: '#64748B', fontSize: 12, marginBottom: 12 },
});