import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  KeyboardAvoidingView, 
  Platform,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';

export interface RecurringTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id?: string | null;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  frequency: 'Weekly' | 'Monthly' | 'Yearly';
  is_active: boolean;
  next_run_date?: string;
}

const FREQUENCIES: ('Weekly' | 'Monthly' | 'Yearly')[] = ['Weekly', 'Monthly', 'Yearly'];
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecurringScreen() {
  const { user } = useUser();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal form states
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [frequency, setFrequency] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Monthly');
  
  // Real account ID fallback
  const [accountId] = useState('d712396d-0a44-4d42-875a-f69ac214570b');

  // Fetch recurring transactions from backend
  const fetchRecurringTransactions = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/recurring/${user.id}`);
      const data = await response.json();
      if (response.ok) {
        setItems(data);
      } else {
        console.error('Failed to fetch recurring transactions:', data.error);
      }
    } catch (error) {
      console.error('Network error fetching recurring transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRecurringTransactions();
  }, [user?.id]);

  // Handle adding new item via POST
  const handleAddItem = async () => {
    if (!title.trim() || !amount.trim() || !user?.id) return;

    try {
      const response = await fetch(`${API_URL}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          account_id: accountId,
          category_id: null,
          title: title.trim(),
          amount: parseFloat(amount) || 0,
          type,
          frequency,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setItems([result, ...items]);
        setTitle('');
        setAmount('');
        setFrequency('Monthly');
        setModalVisible(false);
      } else {
        Alert.alert('Error', result.error || 'Failed to create recurring transaction');
      }
    } catch (error) {
      console.error('Error creating recurring item:', error);
      Alert.alert('Error', 'Network connection failed');
    }
  };

  // Handle deleting item via DELETE
  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/recurring/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setItems(items.filter(item => item.id !== id));
      } else {
        Alert.alert('Error', 'Failed to delete transaction');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  // Handle toggle active status via PATCH
  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    // Optimistic UI update
    setItems(items.map(item => item.id === id ? { ...item, is_active: newStatus } : item));

    try {
      await fetch(`${API_URL}/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus }),
      });
    } catch (error) {
      console.error('Error updating status:', error);
      // Revert if failed
      setItems(items.map(item => item.id === id ? { ...item, is_active: currentStatus } : item));
    }
  };

  // Helper to normalize cash flow to monthly baseline
  const getMonthlyAmount = (item: RecurringTransaction) => {
    if (!item.is_active) return 0;
    const parsedAmount = Number(item.amount);
    if (item.frequency === 'Weekly') return parsedAmount * 4.33;
    if (item.frequency === 'Yearly') return parsedAmount / 12;
    return parsedAmount;
  };

  const totalIncomeMonthly = items
    .filter(item => item.type === 'income' && item.is_active)
    .reduce((acc, curr) => acc + getMonthlyAmount(curr), 0);

  const totalExpenseMonthly = items
    .filter(item => item.type === 'expense' && item.is_active)
    .reduce((acc, curr) => acc + getMonthlyAmount(curr), 0);

  const netMonthlyCashFlow = totalIncomeMonthly - totalExpenseMonthly;

  const renderTransactionCard = (item: RecurringTransaction) => {
    const isIncome = item.type === 'income';

    return (
      <View key={item.id} style={[styles.card, !item.is_active && styles.cardInactive]}>
        <View style={styles.cardLeft}>
          <View style={[styles.iconBox, isIncome ? styles.iconBoxIncome : styles.iconBoxExpense]}>
            <Ionicons 
              name={isIncome ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} 
              size={20} 
              color={isIncome ? '#00D293' : '#FF6B6B'} 
            />
          </View>
          <View style={styles.cardDetails}>
            <Text style={[styles.itemTitle, !item.is_active && styles.textInactive]} numberOfLines={1}>
              {item.title}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.frequency.toUpperCase()}</Text>
              </View>
              {!item.is_active && (
                <View style={styles.pausedBadge}>
                  <Text style={styles.pausedBadgeText}>PAUSED</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <View style={styles.cardRight}>
          <Text style={[
            styles.amountText,
            isIncome ? styles.incomeAmount : styles.expenseAmount,
            !item.is_active && styles.textInactive
          ]}>
            {isIncome ? '+' : '-'}${Number(item.amount).toFixed(2)}
          </Text>
          <View style={styles.actionsRow}>
            <Switch
              value={item.is_active}
              onValueChange={() => handleToggleActive(item.id, item.is_active)}
              trackColor={{ false: '#1A2A3A', true: '#0C2E2A' }}
              thumbColor={item.is_active ? '#00D293' : '#64748B'}
              style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.75 }, { scaleY: 0.75 }] } : {}}
            />
            <TouchableOpacity 
              onPress={() => handleDeleteItem(item.id)} 
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteActionBtn}
            >
              <Ionicons name="trash-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerLoader]}>
        <ActivityIndicator size="large" color="#00D293" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cash Flow Telemetry Hero Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryEyebrow}>EST. MONTHLY CASH FLOW</Text>
          <View style={[
            styles.netStatusTag, 
            netMonthlyCashFlow < 0 ? styles.netStatusNegative : styles.netStatusPositive
          ]}>
            <Text style={[
              styles.netStatusTagText, 
              netMonthlyCashFlow < 0 ? styles.netTextNegative : styles.netTextPositive
            ]}>
              {netMonthlyCashFlow >= 0 ? 'Surplus' : 'Deficit'}
            </Text>
          </View>
        </View>

        <Text style={[
          styles.netAmount, 
          netMonthlyCashFlow < 0 ? styles.netNegativeAmount : styles.netPositiveAmount
        ]}>
          {netMonthlyCashFlow >= 0 ? `+$${netMonthlyCashFlow.toFixed(2)}` : `-$${Math.abs(netMonthlyCashFlow).toFixed(2)}`}
          <Text style={styles.netSubtitle}> / mo</Text>
        </Text>

        <View style={styles.summaryBreakdown}>
          <View style={styles.breakdownCol}>
            <View style={styles.breakdownHeader}>
              <View style={[styles.dotIndicator, { backgroundColor: '#00D293' }]} />
              <Text style={styles.subLabel}>Active Inflows</Text>
            </View>
            <Text style={styles.incomeMetric}>+${totalIncomeMonthly.toFixed(2)}</Text>
          </View>
          <View style={styles.verticalDivider} />
          <View style={styles.breakdownCol}>
            <View style={styles.breakdownHeader}>
              <View style={[styles.dotIndicator, { backgroundColor: '#FF6B6B' }]} />
              <Text style={styles.subLabel}>Active Outflows</Text>
            </View>
            <Text style={styles.expenseMetric}>-${totalExpenseMonthly.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Main Recurring List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* EXPENSES SECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Recurring Outflows</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {items.filter(i => i.type === 'expense').length}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.addSectionBtn} 
            onPress={() => { setType('expense'); setModalVisible(true); }}
          >
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={styles.addSectionBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {items.filter(i => i.type === 'expense').length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyText}>No recurring subscription or bill outflows set.</Text>
          </View>
        ) : (
          items.filter(i => i.type === 'expense').map(renderTransactionCard)
        )}

        {/* INCOME SECTION */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Recurring Inflows</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>
                {items.filter(i => i.type === 'income').length}
              </Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.addSectionBtn} 
            onPress={() => { setType('income'); setModalVisible(true); }}
          >
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={styles.addSectionBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {items.filter(i => i.type === 'income').length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyText}>No recurring salary or deposit inflows set.</Text>
          </View>
        ) : (
          items.filter(i => i.type === 'income').map(renderTransactionCard)
        )}
      </ScrollView>

      {/* CREATE RECURRING MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeader}>
                  Add Recurring {type === 'expense' ? 'Outflow' : 'Inflow'}
                </Text>
                <Text style={styles.modalSubHeader}>Set frequency and baseline automated tracking</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>SUBSCRIPTION / TITLE</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Netflix, Spotify, Salary, Gym" 
              placeholderTextColor="#475569"
              value={title}
              onChangeText={setTitle}
            />
            
            <Text style={styles.label}>AMOUNT ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>BILLING CYCLE / FREQUENCY</Text>
            <View style={styles.pillRow}>
              {FREQUENCIES.map((freq) => {
                const isActive = frequency === freq;
                return (
                  <TouchableOpacity
                    key={freq}
                    style={[styles.pill, isActive && styles.pillActive]}
                    onPress={() => setFrequency(freq)}
                  >
                    <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                      {freq}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddItem}>
                <Text style={styles.saveText}>Save Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#070D14', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 24 : 16,
  },
  centerLoader: { 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  summaryCard: { 
    backgroundColor: '#0C1521', 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 18, 
    borderWidth: 1, 
    borderColor: '#192839' 
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  summaryEyebrow: { 
    fontSize: 10, 
    color: '#00D293', 
    fontWeight: '800', 
    letterSpacing: 1.1 
  },
  netStatusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  netStatusPositive: {
    backgroundColor: '#0C2028',
    borderColor: '#174747',
  },
  netStatusNegative: {
    backgroundColor: '#1D1620',
    borderColor: '#3D2028',
  },
  netStatusTagText: {
    fontSize: 10,
    fontWeight: '700',
  },
  netTextPositive: {
    color: '#00D293',
  },
  netTextNegative: {
    color: '#FF6B6B',
  },
  netAmount: { 
    fontSize: 32, 
    fontWeight: '800', 
    letterSpacing: -0.5,
    marginVertical: 4 
  },
  netPositiveAmount: {
    color: '#FFFFFF',
  },
  netNegativeAmount: {
    color: '#FF6B6B',
  },
  netSubtitle: { 
    fontSize: 13, 
    fontWeight: '500', 
    color: '#64748B' 
  },
  summaryBreakdown: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    marginTop: 14, 
    borderTopWidth: 1, 
    borderTopColor: '#142232', 
    paddingTop: 12 
  },
  breakdownCol: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subLabel: { 
    fontSize: 11, 
    color: '#64748B',
    fontWeight: '600',
  },
  incomeMetric: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#00D293', 
  },
  expenseMetric: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#FF6B6B', 
  },
  verticalDivider: { 
    width: 1, 
    height: 28,
    backgroundColor: '#162536',
    marginHorizontal: 12,
  },
  scrollContent: { 
    paddingBottom: 40 
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12 
  },
  sectionTitleWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '800', 
    color: '#FFFFFF' 
  },
  counterBadge: {
    backgroundColor: '#0C2028',
    borderColor: '#123D3E',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  counterBadgeText: { 
    fontSize: 11, 
    color: '#9EE5CF', 
    fontWeight: '700' 
  },
  addSectionBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: '#00D293', 
    paddingVertical: 6, 
    paddingHorizontal: 12, 
    borderRadius: 14, 
    gap: 4 
  },
  addSectionBtnText: { 
    color: '#03151E', 
    fontSize: 12, 
    fontWeight: '700' 
  },
  emptyStateBox: {
    backgroundColor: '#0C1521',
    borderColor: '#162232',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  emptyText: { 
    fontSize: 12, 
    color: '#475569', 
    fontWeight: '500' 
  },
  card: { 
    backgroundColor: '#0C1521', 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 12,
    paddingHorizontal: 14, 
    borderRadius: 16, 
    marginBottom: 10, 
    borderWidth: 1, 
    borderColor: '#192839' 
  },
  cardInactive: { 
    opacity: 0.45,
    backgroundColor: '#091018',
    borderColor: '#121C27',
  },
  cardLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    flex: 1 
  },
  iconBox: { 
    width: 40, 
    height: 40, 
    borderRadius: 12, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
  },
  iconBoxIncome: {
    backgroundColor: '#0C2028',
    borderColor: '#174747',
  },
  iconBoxExpense: {
    backgroundColor: '#1D1620',
    borderColor: '#3D2028',
  },
  cardDetails: { 
    flex: 1 
  },
  itemTitle: { 
    fontSize: 15, 
    fontWeight: '700', 
    color: '#FFFFFF',
    marginBottom: 4,
  },
  textInactive: { 
    textDecorationLine: 'line-through', 
    color: '#64748B' 
  },
  badgeRow: { 
    flexDirection: 'row', 
    gap: 6, 
    alignItems: 'center' 
  },
  badge: { 
    backgroundColor: '#121E2C', 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#192839',
  },
  badgeText: { 
    fontSize: 9, 
    color: '#8295AB', 
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pausedBadge: {
    backgroundColor: '#261C1E',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4A2328',
  },
  pausedBadgeText: {
    fontSize: 9,
    color: '#FF6B6B',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  cardRight: { 
    alignItems: 'flex-end', 
    gap: 4 
  },
  amountText: {
    fontSize: 15,
    fontWeight: '800',
  },
  expenseAmount: { 
    color: '#FF6B6B' 
  },
  incomeAmount: { 
    color: '#00D293' 
  },
  actionsRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  deleteActionBtn: {
    padding: 4,
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
  pillRow: { 
    flexDirection: 'row', 
    gap: 8, 
    marginBottom: 20 
  },
  pill: { 
    flex: 1,
    paddingVertical: 10, 
    borderRadius: 12, 
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    alignItems: 'center',
  },
  pillActive: { 
    backgroundColor: '#0C2028',
    borderColor: '#174747',
  },
  pillText: { 
    fontSize: 12, 
    color: '#64748B', 
    fontWeight: '600' 
  },
  pillTextActive: { 
    color: '#00D293', 
    fontWeight: '700' 
  },
  modalButtons: { 
    flexDirection: 'row', 
    gap: 12, 
    marginTop: 4 
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
});