import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  FlatList,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUser } from '@clerk/expo';
import { Ionicons } from '@expo/vector-icons';
import { useCategories, Category } from '../../../hooks/useCategories';
import { useSavings, SavingsPlan } from '@/hooks/useSavings';
import { COLORS } from '@/constants/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [totalAccountsBalance, setTotalAccountsBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Category Modal States
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryNameInput, setCategoryNameInput] = useState('');
  const [categoryTargetInput, setCategoryTargetInput] = useState('');

  // Savings Modal States
  const [savingsModalVisible, setSavingsModalVisible] = useState(false);
  const [editingSavings, setEditingSavings] = useState<SavingsPlan | null>(null);
  const [savingsNameInput, setSavingsNameInput] = useState('');
  const [savingsTargetInput, setSavingsTargetInput] = useState('');
  const [savingsSavedInput, setSavingsSavedInput] = useState('');
  const [savingsDeadlineInput, setSavingsDeadlineInput] = useState('');

  // Custom Hooks
  const { 
    categories, 
    isLoading: categoriesLoading, 
    fetchCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory 
  } = useCategories(userId);

  const {
    savingsPlans,
    isLoading: savingsLoading,
    fetchSavings,
    createSavingsPlan,
    updateSavingsPlan
  } = useSavings(userId);

  // Fetch all accounts balance to calculate the cash pool
  const fetchAccountsBalance = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch(`${API_URL}/accounts/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch accounts');
      const accounts = await response.json();
      
      const sum = accounts.reduce((acc: number, curr: any) => acc + Number(curr.balance || 0), 0);
      setTotalAccountsBalance(sum);
    } catch (error) {
      console.error('Error fetching accounts for pool calculation:', error);
    }
  }, [userId]);

  const loadAllData = useCallback(async () => {
    await Promise.all([
      fetchAccountsBalance(),
      fetchCategories(),
      fetchSavings(),
    ]);
  }, [fetchAccountsBalance, fetchCategories, fetchSavings]);

  useEffect(() => {
    if (userId) {
      loadAllData();
    }
  }, [userId, loadAllData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  // Ready to Assign calculation
  const totalAllocatedCategories = categories.reduce((sum, cat) => sum + Number(cat.target_amount || 0), 0);
  const totalAllocatedSavings = savingsPlans.reduce((sum, plan) => sum + Number(plan.saved_amount || 0), 0);
  const availablePool = totalAccountsBalance - (totalAllocatedCategories + totalAllocatedSavings);

  // Unified Top Add Button Handler
  const handleOpenCreateModal = () => {
    if (activeTab === 'spending') {
      setEditingCategory(null);
      setCategoryNameInput('');
      setCategoryTargetInput('');
      setCategoryModalVisible(true);
    } else {
      setEditingSavings(null);
      setSavingsNameInput('');
      setSavingsTargetInput('');
      setSavingsSavedInput('');
      setSavingsDeadlineInput('');
      setSavingsModalVisible(true);
    }
  };

  // Category CRUD Handlers
  const handleOpenEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryNameInput(category.name);
    setCategoryTargetInput(String(category.target_amount || 0));
    setCategoryModalVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryNameInput.trim()) {
      Alert.alert('Error', 'Please enter a category name.');
      return;
    }

    const newTargetAmount = parseFloat(categoryTargetInput) || 0;

    if (editingCategory) {
      const oldTarget = Number(editingCategory.target_amount) || 0;
      const oldCurrent = Number(editingCategory.current_amount) || 0;
      const targetDifference = newTargetAmount - oldTarget;
      const newCurrentAmount = Math.max(0, oldCurrent + targetDifference);

      const success = await updateCategory(editingCategory.id, {
        name: categoryNameInput.trim(),
        target_amount: newTargetAmount,
        current_amount: newCurrentAmount,
      });

      if (success) {
        setCategoryModalVisible(false);
        fetchCategories();
      }
    } else {
      await createCategory({
        name: categoryNameInput.trim(),
        target_amount: newTargetAmount,
        current_amount: newTargetAmount,
        user_id: userId || '',
      } as any);
      
      setCategoryModalVisible(false);
      fetchCategories();
    }
  };

  const handleDeleteCategoryPrompt = (categoryId: string) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this spending envelope?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            await deleteCategory(categoryId);
            setCategoryModalVisible(false);
            fetchCategories();
          } 
        }
      ]
    );
  };

  // Savings CRUD Handlers
  const handleOpenEditSavings = (plan: SavingsPlan) => {
    setEditingSavings(plan);
    setSavingsNameInput(plan.name);
    setSavingsTargetInput(String(plan.target_amount || 0));
    setSavingsSavedInput(String(plan.saved_amount || 0));
    setSavingsDeadlineInput(plan.deadline || '');
    setSavingsModalVisible(true);
  };

  const handleSaveSavings = async () => {
    if (!savingsNameInput.trim() || !savingsTargetInput) {
      Alert.alert('Validation Error', 'Please provide a name and target amount.');
      return;
    }

    const payload = {
      name: savingsNameInput.trim(),
      target_amount: parseFloat(savingsTargetInput) || 0,
      saved_amount: parseFloat(savingsSavedInput) || 0,
      deadline: savingsDeadlineInput.trim() || '2027-12-31',
    };

    let success = false;
    if (editingSavings) {
      success = await updateSavingsPlan(editingSavings.id, payload);
    } else {
      success = await createSavingsPlan(payload);
    }

    if (success) {
      setSavingsModalVisible(false);
      fetchSavings();
    }
  };

  const handleDeleteSavingsPrompt = (planId: string) => {
    Alert.alert(
      'Delete Savings Plan',
      'Are you sure you want to delete this savings plan?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_URL}/savings/${planId}`, { method: 'DELETE' });
              if (res.ok) {
                setSavingsModalVisible(false);
                fetchSavings();
              } else {
                Alert.alert('Error', 'Failed to delete savings plan.');
              }
            } catch (err) {
              console.error('Error deleting savings plan:', err);
              Alert.alert('Error', 'Network error.');
            }
          }
        }
      ]
    );
  };

  const renderCategoryItem = ({ item }: { item: Category }) => {
    const target = Number(item.target_amount) || 0;
    const current = Number(item.current_amount) || 0;
    const spent = Math.max(0, target - current);
    
    const targetSafe = target > 0 ? target : 1;
    const remainingPercentage = Math.min(100, Math.max(0, (current / targetSafe) * 100));
    const spentPercentage = Math.min(100, Math.max(0, (spent / targetSafe) * 100));

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{item.name}</Text>
            <Text style={styles.deadlineText}>
              Spent: <Text style={{ color: '#EF4444', fontWeight: '600' }}>${spent.toFixed(2)}</Text>
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.savedText}>${target.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => handleOpenEditCategory(item)} style={styles.editIconBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.barBackground}>
          <View style={[styles.greenRemainingBar, { width: `${remainingPercentage}%` }]} />
          <View style={[styles.redSpentBar, { width: `${spentPercentage}%` }]} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.targetSubText}>
            Available: <Text style={{ color: current < 0 ? '#EF4444' : COLORS.primary, fontWeight: '700' }}>${current.toFixed(2)}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderSavingsItem = ({ item }: { item: SavingsPlan }) => {
    const target = Number(item.target_amount) || 1;
    const saved = Number(item.saved_amount) || 0;
    const percentage = Math.min(100, Math.max(0, (saved / target) * 100));

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.planName}>{item.name}</Text>
            <Text style={styles.deadlineText}>Target by: {item.deadline || 'Ongoing'}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
            <TouchableOpacity onPress={() => handleOpenEditSavings(item)} style={styles.editIconBtn}>
              <Ionicons name="ellipsis-horizontal" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.savedText}>
            ${saved.toLocaleString()} <Text style={styles.targetSubText}>/ ${target.toLocaleString()}</Text>
          </Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Ready to Assign Header */}
      <View style={styles.poolCard}>
        <Text style={styles.poolTitle}>Ready to Assign</Text>
        <Text style={[
          styles.poolAmount, 
          { color: availablePool < 0 ? '#EF4444' : COLORS.primary }
        ]}>
          ${availablePool.toFixed(2)}
        </Text>
        <Text style={styles.poolSubtitle}>
          From total cash: ${totalAccountsBalance.toFixed(2)}
        </Text>
      </View>

      {/* Tab Switcher & Dynamic Add Button */}
      <View style={styles.tabActionRow}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'spending' && styles.activeTab]} 
            onPress={() => setActiveTab('spending')}
          >
            <Text style={[styles.tabText, activeTab === 'spending' && styles.activeTabText]}>
              Spending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'savings' && styles.activeTab]} 
            onPress={() => setActiveTab('savings')}
          >
            <Text style={[styles.tabText, activeTab === 'savings' && styles.activeTabText]}>
              Savings
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateModal}>
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          categoriesLoading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="wallet-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No spending categories found. Create one to start budgeting!</Text>
            </View>
          ) : (
            <FlatList 
              data={categories}
              keyExtractor={(item) => item.id}
              renderItem={renderCategoryItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          )
        ) : (
          savingsLoading && !refreshing ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : savingsPlans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="shield-checkmark-outline" size={48} color="#9CA3AF" />
              <Text style={styles.emptyText}>No savings goals found. Create one to track your savings!</Text>
            </View>
          ) : (
            <FlatList 
              data={savingsPlans}
              keyExtractor={(item) => item.id}
              renderItem={renderSavingsItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            />
          )
        )}
      </View>

      {/* CATEGORY MODAL */}
      <Modal visible={categoryModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{editingCategory ? 'Edit Spending Envelope' : 'New Spending Envelope'}</Text>
            
            <Text style={styles.label}>Category Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Food, Transport, Utilities" 
              placeholderTextColor="#9CA3AF"
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
            />
            
            <Text style={styles.label}>Target Amount ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={categoryTargetInput}
              onChangeText={setCategoryTargetInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCategoryModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            {editingCategory && (
              <TouchableOpacity 
                style={styles.deleteBtnModal} 
                onPress={() => handleDeleteCategoryPrompt(editingCategory.id)}
              >
                <Text style={styles.deleteBtnText}>Delete Category</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SAVINGS GOAL MODAL */}
      <Modal visible={savingsModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{editingSavings ? 'Edit Savings Plan' : 'New Savings Plan'}</Text>
            
            <Text style={styles.label}>Plan Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Vacation, Emergency Fund" 
              placeholderTextColor="#9CA3AF"
              value={savingsNameInput}
              onChangeText={setSavingsNameInput}
            />
            
            <Text style={styles.label}>Target Amount ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="5000" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={savingsTargetInput}
              onChangeText={setSavingsTargetInput}
            />

            <Text style={styles.label}>Already Saved ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={savingsSavedInput}
              onChangeText={setSavingsSavedInput}
            />

            <Text style={styles.label}>Completion Deadline</Text>
            <TextInput 
              style={styles.input} 
              placeholder="YYYY-MM-DD" 
              placeholderTextColor="#9CA3AF"
              value={savingsDeadlineInput}
              onChangeText={setSavingsDeadlineInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSavingsModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSavings}>
                <Text style={styles.saveText}>{editingSavings ? 'Save Changes' : 'Create Plan'}</Text>
              </TouchableOpacity>
            </View>

            {editingSavings && (
              <TouchableOpacity 
                style={styles.deleteBtnModal} 
                onPress={() => handleDeleteSavingsPrompt(editingSavings.id)}
              >
                <Text style={styles.deleteBtnText}>Delete Savings Plan</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  poolCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 20, 
    alignItems: 'center', 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    elevation: 2, 
    marginBottom: 16 
  },
  poolTitle: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6B7280', 
    textTransform: 'uppercase', 
    letterSpacing: 0.5 
  },
  poolAmount: { 
    fontSize: 32, 
    fontWeight: '700', 
    marginVertical: 4 
  },
  poolSubtitle: { 
    fontSize: 12, 
    color: '#9CA3AF' 
  },
  tabActionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    gap: 10 
  },
  tabContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#F3F4F6', 
    borderRadius: 12, 
    padding: 4 
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  activeTab: { 
    backgroundColor: COLORS.card, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 2, 
    elevation: 1 
  },
  tabText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#6B7280' 
  },
  activeTabText: { 
    color: COLORS.text, 
  },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: COLORS.primary, 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 12, 
    gap: 4 
  },
  addBtnText: { 
    color: '#FFF', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  contentContainer: { 
    flex: 1 
  },
  listContent: { 
    paddingBottom: 40 
  },
  card: { 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 18, 
    marginBottom: 12, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5, 
    elevation: 2 
  },
  cardTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: 10 
  },
  planName: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  deadlineText: { 
    fontSize: 11, 
    color: '#6B7280', 
    marginTop: 2 
  },
  savedText: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  editIconBtn: { 
    padding: 4 
  },
  percentageText: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: COLORS.primary 
  },
  amountRow: { 
    marginBottom: 8 
  },
  barBackground: { 
    height: 8, 
    backgroundColor: '#E5E7EB', 
    borderRadius: 4, 
    flexDirection: 'row', 
    overflow: 'hidden', 
    marginBottom: 8 
  },
  redSpentBar: { 
    height: '100%', 
    backgroundColor: '#EF4444' 
  },
  greenRemainingBar: { 
    height: '100%', 
    backgroundColor: '#09ff00de' 
  },
  progressBarBackground: { 
    height: 8, 
    backgroundColor: '#E5E7EB', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#09ff00de', 
    borderRadius: 4 
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end' 
  },
  targetSubText: { 
    fontSize: 12, 
    fontWeight: '500', 
    color: '#6B7280' 
  },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 60, 
    paddingHorizontal: 32 
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#9CA3AF', 
    fontSize: 13, 
    marginTop: 10 
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.45)' 
  },
  modalContent: { 
    backgroundColor: COLORS.card, 
    padding: 22, 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20 
  },
  modalHeader: { 
    fontSize: 17, 
    fontWeight: '700', 
    marginBottom: 14, 
    color: COLORS.text 
  },
  label: { 
    fontSize: 12, 
    fontWeight: '600', 
    color: '#4B5563', 
    marginBottom: 6 
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#E5E7EB', 
    borderRadius: 8, 
    padding: 10, 
    fontSize: 14, 
    marginBottom: 12, 
    color: COLORS.text 
  },
  modalButtons: { 
    flexDirection: 'row', 
    gap: 10, 
    marginTop: 10 
  },
  cancelBtn: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    backgroundColor: '#F3F4F6', 
    alignItems: 'center' 
  },
  cancelText: { 
    fontWeight: '600', 
    color: '#4B5563' 
  },
  saveBtn: { 
    flex: 1, 
    padding: 12, 
    borderRadius: 8, 
    backgroundColor: COLORS.primary, 
    alignItems: 'center' 
  },
  saveText: { 
    fontWeight: '600', 
    color: '#FFF' 
  },
  deleteBtnModal: {
    marginTop: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  deleteBtnText: {
    color: '#EF4444',
    fontWeight: '600',
  }
});