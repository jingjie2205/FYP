import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useUser } from '@clerk/expo';
import { useAccounts } from '@/hooks/useAccounts';
import { useCategories } from '@/hooks/useCategories';
import { useMonth } from '@/hooks/useMonth';
import DatePickerField, { formatDisplayDate } from '@/components/DatePickerField';
import EnvelopeSelect from '@/components/EnvelopeSelect';
import { getPhoneDateString, formatMonthKey } from '@/utils/month';
import { getOccurrencesInMonth } from '@/utils/recurrence';

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
  /** "YYYY-MM-DD" of the next time this rule posts a transaction */
  next_date?: string;
  /** "YYYY-MM-DD" the rule started on (anchor for its schedule) */
  start?: string;
}

const FREQUENCIES: ('Weekly' | 'Monthly' | 'Yearly')[] = ['Weekly', 'Monthly', 'Yearly'];
const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function RecurringScreen() {
  const { user } = useUser();
  const [items, setItems] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // The full-screen spinner is only for the very first load, so later refreshes never unmount the list
  const hasLoadedRef = useRef(false);

  // Modal form states
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [frequency, setFrequency] = useState<'Weekly' | 'Monthly' | 'Yearly'>('Monthly');

  // Where the posted transaction goes, and when the first one is due
  const { accounts, fetchAccounts } = useAccounts(user?.id);
  const { categories, groupedCategories, fetchCategories } = useCategories(user?.id);
  const { rolloverVersion, syncNow, currentMonth } = useMonth();
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getPhoneDateString());
  // The rule being edited; null when the modal is creating a new one
  const [editingItem, setEditingItem] = useState<RecurringTransaction | null>(null);

  useEffect(() => {
    fetchAccounts();
    fetchCategories();
  }, [fetchAccounts, fetchCategories]);

  // Default to the user's first account
  useEffect(() => {
    if (!accountId && accounts.length > 0) setAccountId(accounts[0].id);
  }, [accounts, accountId]);

  // Fetch recurring transactions from backend
  const userId = user?.id;
  const fetchRecurringTransactions = useCallback(async () => {
    if (!userId) return;
    try {
      if (!hasLoadedRef.current) setIsLoading(true);
      const response = await fetch(`${API_URL}/recurring/${userId}`);
      const data = await response.json();
      if (response.ok) {
        setItems(data);
      } else {
        console.error('Failed to fetch recurring transactions:', data.error);
      }
    } catch (error) {
      console.error('Network error fetching recurring transactions:', error);
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [userId]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchRecurringTransactions();
    } finally {
      setRefreshing(false);
    }
  }, [fetchRecurringTransactions]);

  // Reload whenever this tab regains focus, so rules created or edited from Chat show up immediately
  useFocusEffect(
    useCallback(() => {
      fetchRecurringTransactions();
    }, [fetchRecurringTransactions])
  );

  // Refetch when the app has posted new recurring transactions
  useEffect(() => {
    fetchRecurringTransactions();
  }, [fetchRecurringTransactions, rolloverVersion]);

  // Open the modal empty, for a new rule
  const openCreate = (newType: 'expense' | 'income') => {
    setEditingItem(null);
    setType(newType);
    setTitle('');
    setAmount('');
    setFrequency('Monthly');
    setCategoryId(null);
    setStartDate(getPhoneDateString());
    setModalVisible(true);
  };

  // Open the modal pre-filled with an existing rule
  const openEdit = (item: RecurringTransaction) => {
    setEditingItem(item);
    setType(item.type);
    setTitle(item.title);
    setAmount(String(Number(item.amount)));
    setFrequency(item.frequency);
    setAccountId(item.account_id);
    setCategoryId(item.category_id ?? null);
    setStartDate(item.next_date || getPhoneDateString());
    setModalVisible(true);
  };

  // Save edits via PATCH
  const handleUpdateItem = async () => {
    if (!editingItem || !user?.id) return;
    if (!title.trim() || !amount.trim()) return;
    if (!accountId) {
      Alert.alert('No account', 'Please choose an account.');
      return;
    }
    if (!(parseFloat(amount) > 0)) {
      Alert.alert('Invalid amount', 'Amount must be greater than 0.');
      return;
    }
    if (type === 'expense' && !categoryId) {
      Alert.alert('Envelope required', 'Please choose an envelope for this recurring expense.');
      return;
    }

    try {
      const dateChanged = !!startDate && startDate !== editingItem.next_date;
      const response = await fetch(`${API_URL}/recurring/${editingItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          title: title.trim(),
          amount: parseFloat(amount),
          frequency,
          account_id: accountId,
          ...(type === 'expense' ? { category_id: categoryId } : {}),
          // Only sent when the user moved the date; it restarts the schedule from that day
          ...(dateChanged ? { next_run_date: startDate } : {}),
          date: getPhoneDateString(),
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        Alert.alert('Error', result.error || 'Failed to update recurring transaction');
        return;
      }

      setModalVisible(false);
      setEditingItem(null);
      // If the new date is today or earlier, post it right away; then refresh the list
      await syncNow();
      fetchRecurringTransactions();
    } catch (error) {
      console.error('Error updating recurring item:', error);
      Alert.alert('Error', 'Network connection failed');
    }
  };

  // Handle adding new item via POST
  const handleAddItem = async () => {
    if (!title.trim() || !amount.trim() || !user?.id) return;
    if (!accountId) {
      Alert.alert('No account', 'Create an account on the Home tab before adding a recurring item.');
      return;
    }
    if (!(parseFloat(amount) > 0)) {
      Alert.alert('Invalid amount', 'Amount must be greater than 0.');
      return;
    }
    if (type === 'expense' && !categoryId) {
      Alert.alert(
        'Envelope required',
        categories.length === 0
          ? 'Create an envelope on the Savings tab first, then add this recurring expense.'
          : 'Please choose an envelope for this recurring expense.'
      );
      return;
    }

    try {
      const response = await fetch(`${API_URL}/recurring`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          account_id: accountId,
          category_id: type === 'expense' ? categoryId : null,
          next_run_date: startDate,
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
        setCategoryId(null);
        setStartDate(getPhoneDateString());
        setModalVisible(false);
        await syncNow();
        fetchRecurringTransactions();
      } else {
        Alert.alert('Error', result.error || 'Failed to create recurring transaction');
      }
    } catch (error) {
      console.error('Error creating recurring item:', error);
      Alert.alert('Error', 'Network connection failed');
    }
  };

  // Ask for confirmation before deleting
  const confirmDeleteItem = (item: RecurringTransaction) => {
    Alert.alert(
      'Delete recurring item',
      `Delete "${item.title}"? It will stop posting automatically. Transactions it already created are kept.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteItem(item.id) },
      ]
    );
  };

  // Handle deleting item via DELETE
  const handleDeleteItem = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/recurring/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setItems(items.filter((item) => item.id !== id));
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
    setItems(items.map((item) => (item.id === id ? { ...item, is_active: newStatus } : item)));

    try {
      await fetch(`${API_URL}/recurring/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: newStatus, date: getPhoneDateString() }),
      });
      if (newStatus) fetchRecurringTransactions();
    } catch (error) {
      console.error('Error updating status:', error);
      setItems(items.map((item) => (item.id === id ? { ...item, is_active: currentStatus } : item)));
    }
  };

  const categoryNameById = React.useMemo(() => {
    const map: Record<string, string> = {};
    categories.forEach((c) => {
      map[c.id] = c.name;
    });
    return map;
  }, [categories]);

  const getOccurrenceCount = (item: RecurringTransaction) => {
    if (!item.is_active) return 0;
    const anchor = item.start || item.next_date || '';
    return getOccurrencesInMonth(anchor, item.frequency, currentMonth).length;
  };

  const getMonthlyAmount = (item: RecurringTransaction) =>
    Number(item.amount) * getOccurrenceCount(item);

  const totalIncomeMonthly = items
    .filter((item) => item.type === 'income' && item.is_active)
    .reduce((acc, curr) => acc + getMonthlyAmount(curr), 0);

  const totalExpenseMonthly = items
    .filter((item) => item.type === 'expense' && item.is_active)
    .reduce((acc, curr) => acc + getMonthlyAmount(curr), 0);

  const netMonthlyCashFlow = totalIncomeMonthly - totalExpenseMonthly;
  const totalFlowVolume = totalIncomeMonthly + totalExpenseMonthly;
  const inflowRatio = totalFlowVolume > 0 ? (totalIncomeMonthly / totalFlowVolume) * 100 : 50;

  const renderTransactionCard = (item: RecurringTransaction) => {
    const isIncome = item.type === 'income';
    const occurrences = getOccurrenceCount(item);
    const monthlyTotal = getMonthlyAmount(item);

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.85}
        onPress={() => openEdit(item)}
        style={[styles.card, !item.is_active && styles.cardInactive]}
      >
        {/* Top Row: Icon, Title + Clean Metadata, and Single Amount */}
        <View style={styles.cardTopRow}>
          <View style={[styles.iconBox, isIncome ? styles.iconBoxIncome : styles.iconBoxExpense]}>
            <Ionicons
              name={isIncome ? 'arrow-down-outline' : 'arrow-up-outline'}
              size={18}
              color={isIncome ? '#00D293' : '#FF6B6B'}
            />
          </View>

          <View style={styles.cardDetails}>
            <Text style={[styles.itemTitle, !item.is_active && styles.textInactive]} numberOfLines={1}>
              {item.title}
            </Text>

            <View style={styles.metaRow}>
              {isIncome ? (
                <Text style={styles.metaPrimary}>Income</Text>
              ) : item.category_id ? (
                <Text style={styles.metaPrimary} numberOfLines={1}>
                  {categoryNameById[item.category_id] || 'Envelope'}
                </Text>
              ) : (
                <View style={styles.noEnvelopeBadge}>
                  <Text style={styles.noEnvelopeText}>No Envelope</Text>
                </View>
              )}

              <Text style={styles.metaDot}>•</Text>
              <Text style={styles.metaSecondary}>{item.frequency}</Text>

              {/* Only show extra count/total if not a standard 1x charge */}
              {item.is_active && occurrences > 1 && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaHighlight}>
                    {occurrences}× (${monthlyTotal.toFixed(2)})
                  </Text>
                </>
              )}
              {item.is_active && occurrences === 0 && (
                <>
                  <Text style={styles.metaDot}>•</Text>
                  <Text style={styles.metaMuted}>Not due</Text>
                </>
              )}
            </View>
          </View>

          <Text
            style={[
              styles.amountText,
              isIncome ? styles.incomeAmount : styles.expenseAmount,
              !item.is_active && styles.textInactive,
            ]}
          >
            {isIncome ? '+' : '-'}${Number(item.amount).toFixed(2)}
          </Text>
        </View>

        {/* Bottom Footer: Next Run Date on Left, Quiet Toggle & Delete on Right */}
        <View style={styles.cardFooter}>
          {item.is_active ? (
            <View style={styles.nextDateWrap}>
              <Ionicons name="calendar-outline" size={12} color="#64748B" />
              <Text style={styles.nextDateText}>
                Next: {item.next_date ? formatDisplayDate(item.next_date) : 'Scheduled'}
              </Text>
            </View>
          ) : (
            <View style={styles.pausedBadge}>
              <Text style={styles.pausedBadgeText}>Paused</Text>
            </View>
          )}

          <View style={styles.actionsRow}>
            <Switch
              value={item.is_active}
              onValueChange={() => handleToggleActive(item.id, item.is_active)}
              trackColor={{ false: '#1A2A3A', true: '#0C352E' }}
              thumbColor={item.is_active ? '#00D293' : '#64748B'}
              style={Platform.OS === 'ios' ? { transform: [{ scaleX: 0.72 }, { scaleY: 0.72 }] } : {}}
            />
            <TouchableOpacity
              onPress={() => confirmDeleteItem(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteActionBtn}
            >
              <Ionicons name="trash-outline" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerLoader]}>
        <ActivityIndicator size="large" color="#00D293" />
      </View>
    );
  }

  const expenses = items.filter((i) => i.type === 'expense');
  const incomes = items.filter((i) => i.type === 'income');

  return (
    <View style={styles.container}>
      {/* Streamlined Cash Flow Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryHeader}>
          <Text style={styles.summaryEyebrow}>{formatMonthKey(currentMonth).toUpperCase()}</Text>
          <View
            style={[
              styles.netStatusTag,
              netMonthlyCashFlow < 0 ? styles.netStatusNegative : styles.netStatusPositive,
            ]}
          >
            <Text
              style={[
                styles.netStatusTagText,
                netMonthlyCashFlow < 0 ? styles.netTextNegative : styles.netTextPositive,
              ]}
            >
              {netMonthlyCashFlow >= 0 ? 'Net Surplus' : 'Net Deficit'}
            </Text>
          </View>
        </View>

        <Text
          style={[
            styles.netAmount,
            netMonthlyCashFlow < 0 ? styles.netNegativeAmount : styles.netPositiveAmount,
          ]}
        >
          {netMonthlyCashFlow >= 0
            ? `+$${netMonthlyCashFlow.toFixed(2)}`
            : `-$${Math.abs(netMonthlyCashFlow).toFixed(2)}`}
        </Text>

        {/* Visual Proportion Bar */}
        {totalFlowVolume > 0 && (
          <View style={styles.ratioBarTrack}>
            <View style={[styles.ratioBarFill, { width: `${inflowRatio}%` }]} />
          </View>
        )}

        <View style={styles.summaryBreakdown}>
          <View style={styles.breakdownItem}>
            <View style={[styles.dotIndicator, { backgroundColor: '#00D293' }]} />
            <Text style={styles.subLabel}>Inflows</Text>
            <Text style={styles.incomeMetric}>+${totalIncomeMonthly.toFixed(2)}</Text>
          </View>

          <View style={styles.breakdownItemRight}>
            <View style={[styles.dotIndicator, { backgroundColor: '#FF6B6B' }]} />
            <Text style={styles.subLabel}>Outflows</Text>
            <Text style={styles.expenseMetric}>-${totalExpenseMonthly.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      {/* Main Recurring List */}
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { flexGrow: 1 }]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D293" colors={['#00D293']} />
        }
      >
        {/* EXPENSES SECTION */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Scheduled Outflows</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{expenses.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addSectionBtn}
            onPress={() => openCreate('expense')}
          >
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={styles.addSectionBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {expenses.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyText}>No recurring bills or subscriptions scheduled.</Text>
          </View>
        ) : (
          expenses.map(renderTransactionCard)
        )}

        {/* INCOME SECTION */}
        <View style={[styles.sectionHeader, { marginTop: 22 }]}>
          <View style={styles.sectionTitleWrap}>
            <Text style={styles.sectionTitle}>Scheduled Inflows</Text>
            <View style={styles.counterBadge}>
              <Text style={styles.counterBadgeText}>{incomes.length}</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.addSectionBtn}
            onPress={() => openCreate('income')}
          >
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={styles.addSectionBtnText}>New</Text>
          </TouchableOpacity>
        </View>

        {incomes.length === 0 ? (
          <View style={styles.emptyStateBox}>
            <Text style={styles.emptyText}>No recurring salary or allowances scheduled.</Text>
          </View>
        ) : (
          incomes.map(renderTransactionCard)
        )}
      </ScrollView>

      {/* CREATE / EDIT RECURRING MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text style={styles.modalHeader}>
                  {editingItem ? 'Edit' : 'Add'} Recurring {type === 'expense' ? 'Outflow' : 'Inflow'}
                </Text>
                <Text style={styles.modalSubHeader}>
                  {editingItem
                    ? 'Changes apply to future occurrences only'
                    : `Automate scheduled ${type === 'expense' ? 'bills & subscriptions' : 'income'}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={{ maxHeight: 440 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.label}>TITLE</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Spotify, Rent, Monthly Salary"
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

              <Text style={styles.label}>FREQUENCY</Text>
              <View style={styles.pillRow}>
                {FREQUENCIES.map((freq) => {
                  const isActive = frequency === freq;
                  return (
                    <TouchableOpacity
                      key={freq}
                      style={[styles.pill, isActive && styles.pillActive]}
                      onPress={() => setFrequency(freq)}
                    >
                      <Text style={[styles.pillText, isActive && styles.pillTextActive]}>{freq}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.label}>ACCOUNT</Text>
              <View style={styles.chipWrap}>
                {accounts.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.accountChip, accountId === a.id && styles.pillActive]}
                    onPress={() => setAccountId(a.id)}
                  >
                    <Text style={[styles.pillText, accountId === a.id && styles.pillTextActive]}>
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
                {accounts.length === 0 && (
                  <Text style={styles.hintText}>No accounts yet. Create one on the Home tab first.</Text>
                )}
              </View>

              {type === 'expense' && (
                <>
                  <Text style={[styles.label, { marginTop: 16 }]}>ENVELOPE (REQUIRED)</Text>
                  {categories.length === 0 ? (
                    <Text style={styles.hintText}>
                      No envelopes yet. Create one on the Savings tab first.
                    </Text>
                  ) : (
                    <EnvelopeSelect
                      groups={groupedCategories}
                      value={categoryId}
                      onChange={setCategoryId}
                    />
                  )}
                </>
              )}

              <Text style={[styles.label, { marginTop: 16 }]}>{editingItem ? 'NEXT DATE' : 'FIRST DATE'}</Text>
              <DatePickerField
                value={startDate}
                onChange={setStartDate}
                placeholder="Select the first date"
              />
              <Text style={styles.hintText}>
                {editingItem
                  ? 'Moving this date restarts the schedule from that day. Transactions already posted are not changed.'
                  : 'Posts automatically on this date and repeats every '}
                {!editingItem && (frequency === 'Weekly' ? 'week' : frequency === 'Monthly' ? 'month' : 'year')}{!editingItem && '.'}
              </Text>
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={editingItem ? handleUpdateItem : handleAddItem}>
                <Text style={styles.saveText}>{editingItem ? 'Save Changes' : 'Save Schedule'}</Text>
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
    alignItems: 'center',
  },

  /* Hero Cash Flow Card */
  summaryCard: {
    backgroundColor: '#0C1521',
    borderRadius: 20,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#192839',
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryEyebrow: {
    fontSize: 11,
    color: '#8295AB',
    fontWeight: '700',
    letterSpacing: 1,
  },
  netStatusTag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
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
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 4,
    marginBottom: 12,
  },
  netPositiveAmount: {
    color: '#FFFFFF',
  },
  netNegativeAmount: {
    color: '#FF6B6B',
  },
  ratioBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FF6B6B',
    overflow: 'hidden',
    marginBottom: 12,
  },
  ratioBarFill: {
    height: '100%',
    backgroundColor: '#00D293',
  },
  summaryBreakdown: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#142232',
  },
  breakdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  subLabel: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  incomeMetric: {
    fontSize: 13,
    fontWeight: '700',
    color: '#00D293',
  },
  expenseMetric: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FF6B6B',
  },

  /* Sections */
  scrollContent: {
    paddingBottom: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
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
    fontWeight: '700',
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D293',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 4,
  },
  addSectionBtnText: {
    color: '#03151E',
    fontSize: 12,
    fontWeight: '700',
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
    fontWeight: '500',
  },

  /* Clean Two-Row Recurring Card */
  card: {
    backgroundColor: '#0C1521',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#192839',
  },
  cardInactive: {
    opacity: 0.5,
    backgroundColor: '#091018',
    borderColor: '#121C27',
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    flex: 1,
    marginRight: 8,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  textInactive: {
    textDecorationLine: 'line-through',
    color: '#64748B',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 5,
  },
  metaPrimary: {
    fontSize: 12,
    color: '#8295AB',
    fontWeight: '600',
    maxWidth: 130,
  },
  metaSecondary: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  metaHighlight: {
    fontSize: 12,
    color: '#9EE5CF',
    fontWeight: '600',
  },
  metaMuted: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '500',
  },
  metaDot: {
    fontSize: 11,
    color: '#334155',
  },
  noEnvelopeBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 5,
  },
  noEnvelopeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '700',
  },
  amountText: {
    fontSize: 16,
    fontWeight: '800',
  },
  expenseAmount: {
    color: '#FF6B6B',
  },
  incomeAmount: {
    color: '#00D293',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#142232',
  },
  nextDateWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nextDateText: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  pausedBadge: {
    backgroundColor: '#261C1E',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#4A2328',
  },
  pausedBadgeText: {
    fontSize: 10,
    color: '#FF6B6B',
    fontWeight: '700',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deleteActionBtn: {
    padding: 4,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.75)',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  accountChip: {
    paddingHorizontal: 14,
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
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#00D293',
    fontWeight: '700',
  },
  hintText: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 8,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    alignItems: 'center',
  },
  cancelText: {
    fontWeight: '600',
    color: '#94A3B8',
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#00D293',
    alignItems: 'center',
  },
  saveText: {
    fontWeight: '700',
    color: '#03151E',
  },
});