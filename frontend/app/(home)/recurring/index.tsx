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
import { COLORS } from '@/constants/colors';
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
const API_URL = process.env.EXPO_PUBLIC_API_URL; // e.g. http://localhost:3000

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
  
  // Use your real account ID or dynamic account selection here
  const [accountId, setAccountId] = useState('d712396d-0a44-4d42-875a-f69ac214570b');

  // Fetch recurring transactions from backend on load
  const fetchRecurringTransactions = async () => {
    if (!user?.id) return;
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/recurring/${user.id}`);
      const data = await response.json();
      if (response.ok) {
        setItems(data);
      } else {
        console.error('Failed to fetch:', data.error);
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

  const renderTransactionCard = (item: RecurringTransaction) => (
    <View key={item.id} style={[styles.card, !item.is_active && styles.cardInactive]}>
      <View style={styles.cardLeft}>
        <View style={[styles.iconBox, { backgroundColor: item.type === 'expense' ? '#FEE2E2' : '#D1FAE5' }]}>
          <Ionicons 
            name={item.type === 'expense' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline'} 
            size={20} 
            color={item.type === 'expense' ? '#EF4444' : '#10B981'} 
          />
        </View>
        <View style={styles.cardDetails}>
          <Text style={[styles.itemTitle, !item.is_active && styles.textInactive]}>{item.title}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.frequency}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.cardRight}>
        <Text style={[item.type === 'expense' ? styles.expenseAmount : styles.incomeAmount, !item.is_active && styles.textInactive]}>
          {item.type === 'expense' ? '-' : '+'}${Number(item.amount).toFixed(2)}
        </Text>
        <View style={styles.actionsRow}>
          <Switch
            value={item.is_active}
            onValueChange={() => handleToggleActive(item.id, item.is_active)}
            trackColor={{ false: '#D1D5DB', true: COLORS.primary }}
            thumbColor="#FFF"
            style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] } : {}}
          />
          <TouchableOpacity onPress={() => handleDeleteItem(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="trash-outline" size={17} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerLoader]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Dynamic Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Est. Monthly Cash Flow</Text>
        <Text style={[styles.netAmount, { color: netMonthlyCashFlow >= 0 ? '#10B981' : '#EF4444' }]}>
          {netMonthlyCashFlow >= 0 ? `+$${netMonthlyCashFlow.toFixed(2)}` : `-$${Math.abs(netMonthlyCashFlow).toFixed(2)}`}
          <Text style={styles.netSubtitle}> / mo</Text>
        </Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.subLabel}>Active Income</Text>
            <Text style={styles.incomeText}>+${totalIncomeMonthly.toFixed(2)}/mo</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.subLabel}>Active Expenses</Text>
            <Text style={styles.expenseText}>-${totalExpenseMonthly.toFixed(2)}/mo</Text>
          </View>
        </View>
      </View>

      {/* Main List */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* EXPENSES SECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Recurring Expenses</Text>
            <Text style={styles.sectionCount}>({items.filter(i => i.type === 'expense').length})</Text>
          </View>
          <TouchableOpacity style={styles.addSectionBtn} onPress={() => { setType('expense'); setModalVisible(true); }}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addSectionBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {items.filter(i => i.type === 'expense').length === 0 ? (
          <Text style={styles.emptyText}>No recurring expenses found.</Text>
        ) : (
          items.filter(i => i.type === 'expense').map(renderTransactionCard)
        )}

        {/* INCOME SECTION */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Recurring Income</Text>
            <Text style={styles.sectionCount}>({items.filter(i => i.type === 'income').length})</Text>
          </View>
          <TouchableOpacity style={styles.addSectionBtn} onPress={() => { setType('income'); setModalVisible(true); }}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={styles.addSectionBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {items.filter(i => i.type === 'income').length === 0 ? (
          <Text style={styles.emptyText}>No recurring income found.</Text>
        ) : (
          items.filter(i => i.type === 'income').map(renderTransactionCard)
        )}
      </ScrollView>

      {/* Modal Form */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add Recurring {type === 'expense' ? 'Expense' : 'Income'}</Text>
            
            <Text style={styles.label}>Title</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. Netflix, Salary" 
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />
            
            <Text style={styles.label}>Amount ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="0.00" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

            <Text style={styles.label}>Frequency</Text>
            <View style={styles.pillRow}>
              {FREQUENCIES.map((freq) => (
                <TouchableOpacity
                  key={freq}
                  style={[styles.pill, frequency === freq && styles.pillActive]}
                  onPress={() => setFrequency(freq)}
                >
                  <Text style={[styles.pillText, frequency === freq && styles.pillTextActive]}>{freq}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleAddItem}>
                <Text style={styles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 16 },
  centerLoader: { justifyContent: 'center', alignItems: 'center' },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5 },
  summaryTitle: { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  netAmount: { fontSize: 26, fontWeight: '700', marginVertical: 4 },
  netSubtitle: { fontSize: 13, fontWeight: '400', color: '#6B7280' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  subLabel: { fontSize: 11, color: '#6B7280' },
  incomeText: { fontSize: 14, fontWeight: '600', color: '#10B981', marginTop: 2 },
  expenseText: { fontSize: 14, fontWeight: '600', color: '#EF4444', marginTop: 2 },
  divider: { width: 1, backgroundColor: '#E5E7EB' },
  scrollContent: { paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  sectionCount: { fontSize: 13, color: '#6B7280', fontWeight: '500' },
  addSectionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 20, gap: 4 },
  addSectionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },
  card: { backgroundColor: COLORS.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 10, elevation: 1, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 3 },
  cardInactive: { opacity: 0.5 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  iconBox: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  cardDetails: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  textInactive: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  badgeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  badge: { backgroundColor: '#F3F4F6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  badgeText: { fontSize: 10, color: '#4B5563', fontWeight: '500' },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  incomeAmount: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContent: { backgroundColor: COLORS.card, padding: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { fontSize: 17, fontWeight: '700', marginBottom: 14, color: COLORS.text },
  label: { fontSize: 12, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, color: COLORS.text },
  pillRow: { flexDirection: 'row', gap: 8, marginBottom: 14, flexWrap: 'wrap' },
  pill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: '#F3F4F6' },
  pillActive: { backgroundColor: COLORS.primary },
  pillText: { fontSize: 12, color: '#4B5563', fontWeight: '500' },
  pillTextActive: { color: '#FFF', fontWeight: '600' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#4B5563' },
  saveBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { fontWeight: '600', color: '#FFF' },
});