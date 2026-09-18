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
import { useCategories, Category, GroupedCategory } from '../../../hooks/useCategories';
import { useSavings, SavingsPlan } from '@/hooks/useSavings';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [totalAccountsBalance, setTotalAccountsBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  // Accordion State
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Group Modal States
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<GroupedCategory | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');

  // Category Modal States
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
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
    groupedCategories,
    isLoading: categoriesLoading, 
    fetchCategories, 
    createCategory, 
    updateCategory, 
    deleteCategory,
    createGroup,
    updateGroup,
    deleteGroup
  } = useCategories(userId);

  const {
    savingsPlans,
    isLoading: savingsLoading,
    fetchSavings,
    createSavingsPlan,
    updateSavingsPlan
  } = useSavings(userId);

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

  const totalAllocatedCategories = categories.reduce((sum, cat) => sum + Number(cat.target_amount || 0), 0);
  const totalAllocatedSavings = savingsPlans.reduce((sum, plan) => sum + Number(plan.saved_amount || 0), 0);
  const availablePool = totalAccountsBalance - (totalAllocatedCategories + totalAllocatedSavings);

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  // Main Top-Right "New" Button Handler (Creates Groups or Savings)
  const handleOpenCreateModal = () => {
    if (activeTab === 'spending') {
      setEditingGroup(null);
      setGroupNameInput('');
      setGroupModalVisible(true);
    } else {
      setEditingSavings(null);
      setSavingsNameInput('');
      setSavingsTargetInput('');
      setSavingsSavedInput('');
      setSavingsDeadlineInput('');
      setSavingsModalVisible(true);
    }
  };

  // ===================== GROUP HANDLERS =====================
  const handleOpenEditGroup = (group: GroupedCategory) => {
    setEditingGroup(group);
    setGroupNameInput(group.name);
    setGroupModalVisible(true);
  };

  const handleSaveGroup = async () => {
    if (!groupNameInput.trim()) {
      Alert.alert('Error', 'Please enter a group name.');
      return;
    }

    let success = false;
    if (editingGroup) {
      success = await updateGroup(editingGroup.id, groupNameInput.trim());
    } else {
      success = await createGroup(groupNameInput.trim());
    }

    if (success) {
      setGroupModalVisible(false);
      fetchCategories();
    }
  };

  const handleDeleteGroupPrompt = (groupId: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure? This will delete the header and all categories inside it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            await deleteGroup(groupId);
            setGroupModalVisible(false);
            fetchCategories();
          } 
        }
      ]
    );
  };

  // ===================== CATEGORY HANDLERS =====================
  const handleOpenCreateCategory = (groupId: string) => {
    setActiveGroupId(groupId);
    setEditingCategory(null);
    setCategoryNameInput('');
    setCategoryTargetInput('');
    setCategoryModalVisible(true);
  };

  const handleOpenEditCategory = (category: Category) => {
    setActiveGroupId(category.group_id);
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
      if (!activeGroupId) return;
      const success = await createCategory({
        name: categoryNameInput.trim(),
        target_amount: newTargetAmount,
        group_id: activeGroupId,
      });
      
      if (success) {
        setCategoryModalVisible(false);
        fetchCategories();
      }
    }
  };

  const handleDeleteCategoryPrompt = (categoryId: string) => {
    Alert.alert(
      'Delete Envelope',
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

  // ===================== SAVINGS HANDLERS =====================
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
      Alert.alert('Validation Error', 'Please provide a plan name and target amount.');
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
      'Delete Plan',
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
              Alert.alert('Error', 'Network connection error.');
            }
          }
        }
      ]
    );
  };

  // ===================== RENDERING =====================
  const renderCategoryItem = (item: Category) => {
    const target = Number(item.target_amount) || 0;
    const current = Number(item.current_amount) || 0;
    const spent = Math.max(0, target - current);
    
    const targetSafe = target > 0 ? target : 1;
    const remainingPercentage = Math.min(100, Math.max(0, (current / targetSafe) * 100));

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.envelopeIconBadge}>
              <Ionicons name="wallet-outline" size={16} color="#00D293" />
            </View>
            <View>
              <Text style={styles.planName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.envelopeSub}>
                Spent: <Text style={styles.spentHighlight}>${spent.toFixed(2)}</Text>
              </Text>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <Text style={styles.targetValue}>${target.toFixed(2)}</Text>
            <TouchableOpacity onPress={() => handleOpenEditCategory(item)} style={styles.editBtn}>
              <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.barBackground}>
          <View style={[styles.greenRemainingBar, { width: `${remainingPercentage}%` }]} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.footerLabel}>Available</Text>
          <Text style={[styles.availableAmount, current < 0 && styles.negativeText]}>
            ${current.toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  const renderGroupItem = ({ item: group }: { item: GroupedCategory }) => {
    const isCollapsed = collapsedGroups[group.id];
    const groupTargetTotal = group.categories.reduce((sum, cat) => sum + Number(cat.target_amount || 0), 0);
    const groupAvailableTotal = group.categories.reduce((sum, cat) => sum + Number(cat.current_amount || 0), 0);

    return (
      <View style={styles.groupContainer}>
        {/* Accordion Header */}
        <TouchableOpacity style={styles.groupHeader} onPress={() => toggleGroupCollapse(group.id)} activeOpacity={0.8}>
          <View style={styles.groupHeaderLeft}>
            <Ionicons name={isCollapsed ? "chevron-forward" : "chevron-down"} size={18} color="#64748B" />
            <Text style={styles.groupTitle}>{group.name}</Text>
          </View>
          <View style={styles.groupHeaderRight}>
            <Text style={styles.groupTotals}>
              <Text style={{ color: '#00D293' }}>${groupAvailableTotal.toFixed(0)}</Text> /${groupTargetTotal.toFixed(0)}
            </Text>
            <TouchableOpacity 
              style={styles.groupActionBtn}
              onPress={() => handleOpenCreateCategory(group.id)}
            >
              <Ionicons name="add" size={16} color="#00D293" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.groupActionBtn}
              onPress={() => handleOpenEditGroup(group)}
            >
              <Ionicons name="create-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Accordion Content */}
        {!isCollapsed && (
          <View style={styles.groupContent}>
            {group.categories.length === 0 ? (
              <Text style={styles.emptyGroupText}>No envelopes in this group.</Text>
            ) : (
              group.categories.map(renderCategoryItem)
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSavingsItem = ({ item }: { item: SavingsPlan }) => {
    const target = Number(item.target_amount) || 1;
    const saved = Number(item.saved_amount) || 0;
    const percentage = Math.min(100, Math.max(0, (saved / target) * 100));

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.goalIconBadge}>
              <Ionicons name="shield-checkmark-outline" size={16} color="#00D293" />
            </View>
            <View>
              <Text style={styles.planName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.envelopeSub}>Target: {item.deadline || 'Ongoing'}</Text>
            </View>
          </View>

          <View style={styles.cardHeaderRight}>
            <View style={styles.percentBadge}>
              <Text style={styles.percentBadgeText}>{percentage.toFixed(0)}%</Text>
            </View>
            <TouchableOpacity onPress={() => handleOpenEditSavings(item)} style={styles.editBtn}>
              <Ionicons name="ellipsis-horizontal" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.savingsValuesRow}>
          <Text style={styles.savedHighlight}>${saved.toLocaleString()}</Text>
          <Text style={styles.goalTargetText}>of ${target.toLocaleString()}</Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.poolCard}>
        <View style={styles.poolHeader}>
          <Text style={styles.poolEyebrow}>UNALLOCATED CASH POOL</Text>
          <View style={[
            styles.statusTag, 
            availablePool < 0 ? styles.statusTagNegative : styles.statusTagPositive
          ]}>
            <Text style={[
              styles.statusTagText, 
              availablePool < 0 ? styles.statusTextNegative : styles.statusTextPositive
            ]}>
              {availablePool < 0 ? 'Overallocated' : 'Available'}
            </Text>
          </View>
        </View>

        <Text style={[
          styles.poolAmount, 
          availablePool < 0 ? styles.poolAmountNegative : styles.poolAmountPositive
        ]}>
          ${availablePool.toFixed(2)}
        </Text>

        <View style={styles.poolFooter}>
          <Text style={styles.poolSubtitle}>
            Total Net Balance: <Text style={styles.poolWhite}>${totalAccountsBalance.toFixed(2)}</Text>
          </Text>
        </View>
      </View>

      <View style={styles.tabActionRow}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'spending' && styles.activeTab]} 
            onPress={() => setActiveTab('spending')}
          >
            <Text style={[styles.tabText, activeTab === 'spending' && styles.activeTabText]}>
              Envelopes
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'savings' && styles.activeTab]} 
            onPress={() => setActiveTab('savings')}
          >
            <Text style={[styles.tabText, activeTab === 'savings' && styles.activeTabText]}>
              Savings Goals
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateModal}>
          <Ionicons name="add" size={16} color="#03151E" />
          <Text style={styles.addBtnText}>{activeTab === 'spending' ? 'New Group' : 'New Goal'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          categoriesLoading && !refreshing ? (
            <ActivityIndicator size="large" color="#00D293" style={{ marginTop: 40 }} />
          ) : groupedCategories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="folder-open-outline" size={32} color="#00D293" />
              </View>
              <Text style={styles.emptyTitle}>No Category Groups</Text>
              <Text style={styles.emptyText}>Create a group (e.g. "Bills") to start organizing your envelopes.</Text>
            </View>
          ) : (
            <FlatList 
              data={groupedCategories}
              keyExtractor={(item) => item.id}
              renderItem={renderGroupItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D293" colors={['#00D293']}/>}
            />
          )
        ) : (
          savingsLoading && !refreshing ? (
            <ActivityIndicator size="large" color="#00D293" style={{ marginTop: 40 }} />
          ) : savingsPlans.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="shield-checkmark-outline" size={32} color="#00D293" />
              </View>
              <Text style={styles.emptyTitle}>No Savings Goals Yet</Text>
              <Text style={styles.emptyText}>Lock capital away for long term milestones and emergency funds.</Text>
            </View>
          ) : (
            <FlatList 
              data={savingsPlans}
              keyExtractor={(item) => item.id}
              renderItem={renderSavingsItem}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D293" colors={['#00D293']}/>}
            />
          )
        )}
      </View>

      {/* GROUP MODAL */}
      <Modal visible={groupModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeader}>{editingGroup ? 'Edit Group' : 'New Category Group'}</Text>
                <Text style={styles.modalSubHeader}>Create a header to organize your envelopes</Text>
              </View>
              <TouchableOpacity onPress={() => setGroupModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>GROUP NAME</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Bills, Everyday, Subscriptions" 
              placeholderTextColor="#475569"
              value={groupNameInput}
              onChangeText={setGroupNameInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setGroupModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveGroup}>
                <Text style={styles.saveText}>Save Group</Text>
              </TouchableOpacity>
            </View>

            {editingGroup && (
              <TouchableOpacity style={styles.deleteBtnModal} onPress={() => handleDeleteGroupPrompt(editingGroup.id)}>
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                <Text style={styles.deleteBtnText}>Delete Group & Contents</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* CATEGORY / ENVELOPE MODAL */}
      <Modal visible={categoryModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeader}>
                  {editingCategory ? 'Edit Envelope' : 'New Envelope'}
                </Text>
                <Text style={styles.modalSubHeader}>Set allocated limits for this envelope</Text>
              </View>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>ENVELOPE NAME</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Groceries, Dining Out" 
              placeholderTextColor="#475569"
              value={categoryNameInput}
              onChangeText={setCategoryNameInput}
            />
            
            <Text style={styles.label}>ALLOCATED BUDGET ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              value={categoryTargetInput}
              onChangeText={setCategoryTargetInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCategoryModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCategory}>
                <Text style={styles.saveText}>Save Envelope</Text>
              </TouchableOpacity>
            </View>

            {editingCategory && (
              <TouchableOpacity style={styles.deleteBtnModal} onPress={() => handleDeleteCategoryPrompt(editingCategory.id)}>
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                <Text style={styles.deleteBtnText}>Delete Envelope</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* SAVINGS GOAL MODAL */}
      <Modal visible={savingsModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeader}>
                  {editingSavings ? 'Edit Savings Goal' : 'New Savings Goal'}
                </Text>
                <Text style={styles.modalSubHeader}>Plan your target and tracking parameters</Text>
              </View>
              <TouchableOpacity onPress={() => setSavingsModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>GOAL TITLE</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Vacation, Emergency Fund" 
              placeholderTextColor="#475569"
              value={savingsNameInput}
              onChangeText={setSavingsNameInput}
            />
            
            <View style={styles.modalInputRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>TARGET ($)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="5000" 
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  value={savingsTargetInput}
                  onChangeText={setSavingsTargetInput}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>SAVED ($)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="0.00" 
                  placeholderTextColor="#475569"
                  keyboardType="decimal-pad"
                  value={savingsSavedInput}
                  onChangeText={setSavingsSavedInput}
                />
              </View>
            </View>

            <Text style={styles.label}>TARGET DATE</Text>
            <TextInput 
              style={styles.input} 
              placeholder="YYYY-MM-DD" 
              placeholderTextColor="#475569"
              value={savingsDeadlineInput}
              onChangeText={setSavingsDeadlineInput}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSavingsModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveSavings}>
                <Text style={styles.saveText}>{editingSavings ? 'Save Changes' : 'Create Goal'}</Text>
              </TouchableOpacity>
            </View>

            {editingSavings && (
              <TouchableOpacity style={styles.deleteBtnModal} onPress={() => handleDeleteSavingsPrompt(editingSavings.id)}>
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
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
    backgroundColor: '#070D14', 
    paddingHorizontal: 20, 
    paddingTop: 12 
  },
  poolCard: { 
    backgroundColor: '#0C1521', 
    borderRadius: 20, 
    padding: 20, 
    borderWidth: 1,
    borderColor: '#192839',
    marginBottom: 18,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  poolEyebrow: { 
    fontSize: 10, 
    fontWeight: '800', 
    color: '#00D293', 
    letterSpacing: 1.1,
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  statusTagPositive: {
    backgroundColor: '#0C2028',
    borderColor: '#174747',
  },
  statusTagNegative: {
    backgroundColor: '#1D1620',
    borderColor: '#3D2028',
  },
  statusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statusTextPositive: {
    color: '#00D293',
  },
  statusTextNegative: {
    color: '#FF6B6B',
  },
  poolAmount: { 
    fontSize: 34, 
    fontWeight: '800', 
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  poolAmountPositive: {
    color: '#FFFFFF',
  },
  poolAmountNegative: {
    color: '#FF6B6B',
  },
  poolFooter: {
    marginTop: 4,
  },
  poolSubtitle: { 
    fontSize: 12, 
    color: '#64748B',
    fontWeight: '500',
  },
  poolWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabActionRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 16, 
    gap: 12 
  },
  tabContainer: { 
    flex: 1, 
    flexDirection: 'row', 
    backgroundColor: '#121E2C', 
    borderRadius: 14, 
    padding: 4,
    borderWidth: 1,
    borderColor: '#192839',
  },
  tab: { 
    flex: 1, 
    paddingVertical: 8, 
    alignItems: 'center', 
    borderRadius: 10 
  },
  activeTab: { 
    backgroundColor: '#0C1521', 
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  tabText: { 
    fontSize: 13, 
    fontWeight: '600', 
    color: '#64748B' 
  },
  activeTabText: { 
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#00D293', 
    paddingVertical: 10, 
    paddingHorizontal: 14, 
    borderRadius: 14, 
    gap: 4 
  },
  addBtnText: { 
    color: '#03151E', 
    fontSize: 13, 
    fontWeight: '700' 
  },
  contentContainer: { 
    flex: 1 
  },
  listContent: { 
    paddingBottom: 40 
  },
  groupContainer: {
    marginBottom: 16,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#121E2C',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    marginBottom: 8,
  },
  groupHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  groupTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  groupHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  groupTotals: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginRight: 6,
  },
  groupActionBtn: {
    padding: 4,
    backgroundColor: '#0C1521',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#192839',
  },
  groupContent: {
    paddingLeft: 8,
  },
  emptyGroupText: {
    fontSize: 12,
    color: '#64748B',
    fontStyle: 'italic',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  card: { 
    backgroundColor: '#0C1521', 
    borderRadius: 12, 
    padding: 14, 
    marginBottom: 8, 
    borderWidth: 1,
    borderColor: '#192839',
  },
  cardHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 10 
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  envelopeIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#0C2028',
    borderColor: '#174747',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#0C2028',
    borderColor: '#174747',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planName: { 
    fontSize: 14, 
    fontWeight: '700', 
    color: '#FFFFFF',
  },
  envelopeSub: { 
    fontSize: 11, 
    color: '#64748B', 
    marginTop: 2 
  },
  spentHighlight: { 
    color: '#FF6B6B', 
    fontWeight: '600' 
  },
  targetValue: { 
    fontSize: 14, 
    fontWeight: '800', 
    color: '#FFFFFF' 
  },
  editBtn: { 
    padding: 4 
  },
  barBackground: { 
    height: 6, 
    backgroundColor: '#121E2C', 
    borderRadius: 3, 
    overflow: 'hidden', 
    marginBottom: 8 
  },
  greenRemainingBar: { 
    height: '100%', 
    backgroundColor: '#00D293',
    borderRadius: 3,
  },
  cardFooter: { 
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerLabel: { 
    fontSize: 11, 
    fontWeight: '600', 
    color: '#64748B' 
  },
  availableAmount: {
    fontSize: 12,
    fontWeight: '700',
    color: '#00D293',
  },
  negativeText: {
    color: '#FF6B6B',
  },
  percentBadge: {
    backgroundColor: '#0C2028',
    borderColor: '#174747',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  percentBadgeText: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#00D293' 
  },
  savingsValuesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: 8,
  },
  savedHighlight: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  goalTargetText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  progressBarBackground: { 
    height: 6, 
    backgroundColor: '#121E2C', 
    borderRadius: 3, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: '#00D293', 
    borderRadius: 3 
  },
  emptyContainer: { 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginTop: 60, 
    paddingHorizontal: 32 
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#0C2028',
    borderColor: '#174747',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  emptyText: { 
    textAlign: 'center', 
    color: '#64748B', 
    fontSize: 13,
    lineHeight: 18,
  },
  modalOverlay: { 
    flex: 1, 
    justifyContent: 'flex-end', 
    backgroundColor: 'rgba(0,0,0,0.75)' 
  },
  modalContent: { 
    backgroundColor: '#0C1521', 
    padding: 24, 
    borderTopLeftRadius: 24, 
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalHeader: { 
    fontSize: 18, 
    fontWeight: '800', 
    color: '#FFFFFF' 
  },
  modalSubHeader: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  label: { 
    fontSize: 11, 
    fontWeight: '700', 
    color: '#64748B', 
    marginBottom: 6,
    letterSpacing: 0.8,
  },
  input: { 
    borderWidth: 1, 
    borderColor: '#1E2D3D', 
    backgroundColor: '#121E2C',
    borderRadius: 12, 
    paddingHorizontal: 14, 
    paddingVertical: 12, 
    fontSize: 14, 
    marginBottom: 16, 
    color: '#FFFFFF' 
  },
  modalInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButtons: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 10 
  },
  cancelBtn: { 
    flex: 1, 
    paddingVertical: 14, 
    borderRadius: 12, 
    backgroundColor: '#121E2C', 
    borderWidth: 1,
    borderColor: '#1E2D3D',
    alignItems: 'center' 
  },
  cancelText: { 
    fontWeight: '600', 
    color: '#94A3B8' 
  },
  saveBtn: { 
    flex: 1.5, 
    paddingVertical: 14, 
    borderRadius: 12, 
    backgroundColor: '#00D293', 
    alignItems: 'center' 
  },
  saveText: { 
    fontWeight: '700', 
    color: '#03151E' 
  },
  deleteBtnModal: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1C151B',
    borderWidth: 1,
    borderColor: '#3D1C24',
  },
  deleteBtnText: {
    color: '#FF6B6B',
    fontWeight: '600',
    fontSize: 13,
  }
});