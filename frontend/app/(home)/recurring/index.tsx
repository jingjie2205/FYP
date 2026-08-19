import React, { useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  TextInput, 
  Modal, 
  FlatList, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

interface RecurringItem {
  id: string;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  frequency: 'Monthly' | 'Weekly' | 'Yearly';
}

export default function RecurringScreen() {
  const [items, setItems] = useState<RecurringItem[]>([
    { id: '1', title: 'Netflix Subscription', amount: 15.00, type: 'expense', frequency: 'Monthly' },
    { id: '2', title: 'Salary Deposit', amount: 3500.00, type: 'income', frequency: 'Monthly' },
    { id: '3', title: 'Gym Membership', amount: 45.00, type: 'expense', frequency: 'Monthly' },
  ]);

  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [frequency, setFrequency] = useState<'Monthly' | 'Weekly' | 'Yearly'>('Monthly');

  // Calculate automated cash flow totals
  const totalIncome = items
    .filter(item => item.type === 'income')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const totalExpense = items
    .filter(item => item.type === 'expense')
    .reduce((acc, curr) => acc + curr.amount, 0);

  const netCashFlow = totalIncome - totalExpense;

  const handleAddItem = () => {
    if (!title.trim() || !amount.trim()) return;

    const newItem: RecurringItem = {
      id: Date.now().toString(),
      title,
      amount: parseFloat(amount) || 0,
      type,
      frequency,
    };

    setItems([newItem, ...items]);
    setTitle('');
    setAmount('');
    setModalVisible(false);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  return (
    <View style={styles.container}>
      {/* Header Summary Card */}
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Automated Cash Flow Impact</Text>
        <Text style={[styles.netAmount, { color: netCashFlow >= 0 ? '#10B981' : '#EF4444' }]}>
          {netCashFlow >= 0 ? `+$${netCashFlow.toFixed(2)}` : `-$${Math.abs(netCashFlow).toFixed(2)}`}
          <Text style={styles.netSubtitle}> / mo</Text>
        </Text>
        <View style={styles.summaryRow}>
          <View>
            <Text style={styles.subLabel}>Recurring Income</Text>
            <Text style={styles.incomeText}>+${totalIncome.toFixed(2)}</Text>
          </View>
          <View style={styles.divider} />
          <View>
            <Text style={styles.subLabel}>Recurring Expenses</Text>
            <Text style={styles.expenseText}>-${totalExpense.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Main Sections (Expense & Income) */}
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* SECTION 1: EXPENSES */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recurring Expenses</Text>
          <TouchableOpacity onPress={() => { setType('expense'); setModalVisible(true); }}>
            <Ionicons name="add-circle" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        {items.filter(i => i.type === 'expense').length === 0 ? (
          <Text style={styles.emptyText}>No recurring expenses added.</Text>
        ) : (
          items.filter(i => i.type === 'expense').map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#FEE2E2' }]}>
                  <Ionicons name="repeat" size={18} color="#EF4444" />
                </View>
                <View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSub}>{item.frequency}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.expenseAmount}>-${item.amount.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleDeleteItem(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}

        {/* SECTION 2: INCOME */}
        <View style={[styles.sectionHeader, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>Recurring Income</Text>
          <TouchableOpacity onPress={() => { setType('income'); setModalVisible(true); }}>
            <Ionicons name="add-circle" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
        {items.filter(i => i.type === 'income').length === 0 ? (
          <Text style={styles.emptyText}>No recurring income added.</Text>
        ) : (
          items.filter(i => i.type === 'income').map(item => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardLeft}>
                <View style={[styles.iconBox, { backgroundColor: '#D1FAE5' }]}>
                  <Ionicons name="repeat" size={18} color="#10B981" />
                </View>
                <View>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemSub}>{item.frequency}</Text>
                </View>
              </View>
              <View style={styles.cardRight}>
                <Text style={styles.incomeAmount}>+${item.amount.toFixed(2)}</Text>
                <TouchableOpacity onPress={() => handleDeleteItem(item.id)}>
                  <Ionicons name="trash-outline" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Subscription / Income Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>Add New Recurring {type === 'expense' ? 'Expense' : 'Income'}</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Title (e.g. Spotify, Salary)" 
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
            />
            
            <TextInput 
              style={styles.input} 
              placeholder="Amount ($)" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
            />

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
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 20 },
  summaryCard: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  summaryTitle: { fontSize: 13, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase' },
  netAmount: { fontSize: 28, fontWeight: '700', marginVertical: 4 },
  netSubtitle: { fontSize: 14, fontWeight: '400', color: '#6B7280' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  subLabel: { fontSize: 12, color: '#6B7280' },
  incomeText: { fontSize: 15, fontWeight: '600', color: '#10B981', marginTop: 2 },
  expenseText: { fontSize: 15, fontWeight: '600', color: '#EF4444', marginTop: 2 },
  divider: { width: 1, backgroundColor: '#E5E7EB' },
  scrollContent: { paddingBottom: 40 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptyText: { fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginBottom: 10 },
  card: { backgroundColor: COLORS.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 12, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 3, elevation: 1 },
  cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  itemSub: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  expenseAmount: { fontSize: 14, fontWeight: '700', color: '#EF4444' },
  incomeAmount: { fontSize: 14, fontWeight: '700', color: '#10B981' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalContent: { backgroundColor: COLORS.card, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { fontSize: 18, fontWeight: '700', marginBottom: 16, color: COLORS.text },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, padding: 12, fontSize: 14, marginBottom: 12, color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#4B5563' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { fontWeight: '600', color: '#FFF' },
});