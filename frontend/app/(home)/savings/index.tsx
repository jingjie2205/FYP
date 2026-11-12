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

// UI Components
import GroupItem from '@/components/plan/GroupItem';
import SavingsItem from '@/components/plan/SavingsItem';
import PoolCard from '@/components/plan/PoolCard';

// Modals
import CoverModal from '@/components/plan/modals/CoverModal';
import GroupModal from '@/components/plan/modals/GroupModal';
import CategoryModal from '@/components/plan/modals/CategoryModal';
import SavingsModal from '@/components/plan/modals/SavingsModal';

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [refreshing, setRefreshing] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Data Hooks - Now pulling raw accounts instead of the static total
  const { accounts = [], fetchAccounts } = useAccounts(userId);
  const { transactions = [], loadData: fetchTransactions } = useTransactions(userId);
  const { categories, groupedCategories, isLoading: categoriesLoading, fetchCategories, createCategory, updateCategory, deleteCategory, createGroup, updateGroup, deleteGroup } = useCategories(userId);
  const { savingsPlans, isLoading: savingsLoading, fetchSavings, createSavingsPlan, updateSavingsPlan, deleteSavingsPlan } = useSavings(userId);

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

  // Dynamic Math Maps
  const categorySpendingMap = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter((t: any) => t.type === 'expense').forEach((t: any) => {
        if (t.category_id) map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount || 0);
    });
    return map;
  }, [transactions]);

  // Pool Calculations using the LIVE ledger balance
  const totalCategoryAvailable = categories.reduce((sum, cat) => sum + Math.max(0, Number(cat.target_amount || 0) - (categorySpendingMap[cat.id] || 0)), 0);
  const totalAllocatedSavings = savingsPlans.reduce((sum, plan) => sum + Number(plan.saved_amount || 0), 0);
  const availablePool = liveTotalAccountsBalance - (totalCategoryAvailable + totalAllocatedSavings);

  // Modal Visibility States
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [savingsModalVisible, setSavingsModalVisible] = useState(false);
  const [coverModalVisible, setCoverModalVisible] = useState(false);

  // Active Edit States
  const [editingGroup, setEditingGroup] = useState<GroupedCategory | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [editingSavings, setEditingSavings] = useState<SavingsPlan | null>(null);
  const [overspentCategory, setOverspentCategory] = useState<Category | null>(null);

  // Overspending Calculations
  const shortfallAmount = useMemo(() => {
    if (!overspentCategory) return 0;
    return Math.max(0, (categorySpendingMap[overspentCategory.id] || 0) - Number(overspentCategory.target_amount || 0));
  }, [overspentCategory, categorySpendingMap]);

  const eligibleDonors = useMemo(() => categories.filter(cat => cat.id !== overspentCategory?.id && (Number(cat.target_amount || 0) - (categorySpendingMap[cat.id] || 0)) >= shortfallAmount), [categories, categorySpendingMap, shortfallAmount, overspentCategory]);

  const loadAllData = useCallback(async () => {
    await Promise.all([fetchAccounts(), fetchCategories(), fetchSavings(), fetchTransactions()]);
  }, [fetchAccounts, fetchCategories, fetchSavings, fetchTransactions]);

  useEffect(() => { if (userId) loadAllData(); }, [userId, loadAllData]);

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
      await updateCategory(editingCategory.id, { name: name.trim(), target_amount: targetAmount, current_amount: Math.max(0, targetAmount - spent) });
    } else if (activeGroupId) {
      await createCategory({ name: name.trim(), target_amount: targetAmount, group_id: activeGroupId });
    }
    setCategoryModalVisible(false);
    fetchCategories();
  };

  const handleSaveSavings = async (payload: { name: string; target_amount: number; saved_amount: number; deadline: string }) => {
    if (!payload.name.trim() || !payload.target_amount) return Alert.alert('Error', 'Provide a name and target.');
    if (editingSavings) await updateSavingsPlan(editingSavings.id, payload);
    else await createSavingsPlan(payload);
    setSavingsModalVisible(false);
    fetchSavings();
  };

  const handleCoverOverspending = async (donorSourceId: string) => {
    if (!overspentCategory) return;
    if (donorSourceId === 'pool') {
      await updateCategory(overspentCategory.id, { target_amount: Number(overspentCategory.target_amount || 0) + shortfallAmount });
    } else {
      const donorCat = categories.find(c => c.id === donorSourceId);
      if (donorCat) {
        await updateCategory(overspentCategory.id, { target_amount: Number(overspentCategory.target_amount || 0) + shortfallAmount });
        await updateCategory(donorCat.id, { target_amount: Number(donorCat.target_amount || 0) - shortfallAmount });
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
      {/* Pass the live mathematical balance instead of the static database pull */}
      <PoolCard availablePool={availablePool} totalAccountsBalance={liveTotalAccountsBalance} />

      <View style={styles.tabActionRow}>
        <View style={styles.tabContainer}>
          <TouchableOpacity style={[styles.tab, activeTab === 'spending' && styles.activeTab]} onPress={() => setActiveTab('spending')}>
            <Text style={[styles.tabText, activeTab === 'spending' && styles.activeTabText]}>Envelopes</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, activeTab === 'savings' && styles.activeTab]} onPress={() => setActiveTab('savings')}>
            <Text style={[styles.tabText, activeTab === 'savings' && styles.activeTabText]}>Savings Goals</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateModal}>
          <Ionicons name="add" size={16} color="#03151E" />
          <Text style={styles.addBtnText}>{activeTab === 'spending' ? 'New Group' : 'New Goal'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          categoriesLoading && !refreshing ? <ActivityIndicator size="large" color="#00D293" style={{ marginTop: 40 }} /> : (
            <FlatList 
              data={groupedCategories}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData().finally(() => setRefreshing(false)); }} tintColor="#00D293" />}
              renderItem={({ item }) => (
                <GroupItem 
                  group={item}
                  isCollapsed={collapsedGroups[item.id]}
                  spendingMap={categorySpendingMap}
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
              renderItem={({ item }) => (
                <SavingsItem item={item} onEdit={(plan) => { setEditingSavings(plan); setSavingsModalVisible(true); }} />
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

      <SavingsModal
        visible={savingsModalVisible}
        initialData={editingSavings}
        onClose={() => setSavingsModalVisible(false)}
        onSave={handleSaveSavings}
        onDelete={editingSavings && deleteSavingsPlan ? () => promptDelete('Delete Savings Plan', 'Delete this plan?', () => deleteSavingsPlan(editingSavings.id), () => setSavingsModalVisible(false), fetchSavings) : undefined}
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
});