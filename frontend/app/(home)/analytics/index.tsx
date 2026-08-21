import React, { useState, useEffect, useCallback } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert,
  FlatList
} from 'react-native';
import { useUser } from '@clerk/expo'
import { Ionicons } from '@expo/vector-icons';
import { useCategories, Category } from '../../../hooks/useCategories';
import { COLORS } from '@/constants/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [totalAccountsBalance, setTotalAccountsBalance] = useState(0);
  const [savingsPlans, setSavingsPlans] = useState<any[]>([]);
  const [loadingSavings, setLoadingSavings] = useState(false);

  const { categories, isLoading: categoriesLoading, fetchCategories } = useCategories(userId);

  // 1. Fetch all accounts balance to calculate the master cash pool
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

  // 2. Fetch savings goals for the savings tab
  const fetchSavingsPlans = useCallback(async () => {
    if (!userId) return;
    try {
      setLoadingSavings(true);
      const response = await fetch(`${API_URL}/savings/${userId}`); // Adjust to your actual savings endpoint route
      if (!response.ok) throw new Error('Failed to fetch savings');
      const data = await response.json();
      setSavingsPlans(data);
    } catch (error) {
      console.error('Error fetching savings:', error);
    } finally {
      setLoadingSavings(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchAccountsBalance();
      fetchCategories();
      fetchSavingsPlans();
    }
  }, [userId, fetchAccountsBalance, fetchCategories, fetchSavingsPlans]);

  // Dynamic Ready to Assign Calculation:
  // Total Cash across Accounts - (Sum of all category targets + Sum of all savings allocations)
  const totalAllocatedCategories = categories.reduce((sum, cat) => sum + Number(cat.target_amount || 0), 0);
  const totalAllocatedSavings = savingsPlans.reduce((sum, plan) => sum + Number(plan.saved_amount || plan.target_amount || 0), 0);
  const availablePool = totalAccountsBalance - (totalAllocatedCategories + totalAllocatedSavings);

  const handleCreateNew = () => {
    if (activeTab === 'spending') {
      Alert.alert('Create Category', 'Trigger spending category creation flow here.');
    } else {
      Alert.alert('Create Savings Goal', 'Trigger savings plan creation flow here.');
    }
  };

  const renderCategoryItem = ({ item }: { item: Category }) => {
    const target = Number(item.target_amount) || 0;
    const current = Number(item.current_amount) || 0;
    const spent = Math.max(0, target - current);
    
    const targetSafe = target > 0 ? target : 1;
    const spentPercentage = Math.min(100, Math.max(0, (spent / targetSafe) * 100));
    const remainingPercentage = Math.min(100, Math.max(0, (current / targetSafe) * 100));

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.planName}>{item.name}</Text>
            <Text style={styles.deadlineText}>
              Spent: <Text style={{ color: '#EF4444', fontWeight: '600' }}>${spent.toFixed(2)}</Text>
            </Text>
          </View>
          <Text style={styles.savedText}>${target.toFixed(2)}</Text>
        </View>

        {/* Split Bar Chart: Red for spent, Green for remaining */}
        <View style={styles.barBackground}>
          <View style={[styles.redSpentBar, { width: `${spentPercentage}%` }]} />
          <View style={[styles.greenRemainingBar, { width: `${remainingPercentage}%` }]} />
        </View>

        <View style={styles.cardFooter}>
          <Text style={styles.targetSubText}>
            Available: <Text style={{ color: current < 0 ? '#EF4444' : COLORS.primary, fontWeight: '700' }}>${current.toFixed(2)}</Text>
          </Text>
        </View>
      </View>
    );
  };

  const renderSavingsItem = ({ item }: { item: any }) => {
    const target = Number(item.target_amount) || 1;
    const saved = Number(item.saved_amount) || 0;
    const percentage = Math.min(100, Math.max(0, (saved / target) * 100));

    return (
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View>
            <Text style={styles.planName}>{item.name || item.title}</Text>
            <Text style={styles.deadlineText}>Target: ${target.toFixed(2)}</Text>
          </View>
          <Text style={styles.percentageText}>{percentage.toFixed(0)}%</Text>
        </View>

        <View style={styles.amountRow}>
          <Text style={styles.savedText}>${saved.toFixed(2)}</Text>
        </View>

        <View style={styles.progressBarBackground}>
          <View style={[styles.progressBarFill, { width: `${percentage}%` }]} />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. READY TO ASSIGN POOL HEADER */}
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

      {/* 2. TAB SWITCHER & ACTION BUTTON */}
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

        <TouchableOpacity style={styles.addBtn} onPress={handleCreateNew}>
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={styles.addBtnText}>Add</Text>
        </TouchableOpacity>
      </View>

      {/* 3. CONDITIONAL TAB CONTENT CONTAINER */}
      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          categoriesLoading ? (
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
            />
          )
        ) : (
          loadingSavings ? (
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
            />
          )
        )}
      </View>
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
    backgroundColor: COLORS.primary 
  },
  progressBarBackground: { 
    height: 8, 
    backgroundColor: '#E5E7EB', 
    borderRadius: 4, 
    overflow: 'hidden' 
  },
  progressBarFill: { 
    height: '100%', 
    backgroundColor: COLORS.primary, 
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
});