import { SignOutButton } from '@/components/sign-out-button'
import { useSession, useUser } from '@clerk/expo'
import { 
  Alert, 
  Text, 
  TouchableOpacity, 
  Image, 
  View, 
  FlatList, 
  RefreshControl, 
  StyleSheet, 
  Modal, 
  TextInput, 
  KeyboardAvoidingView, 
  Platform 
} from 'react-native'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useCategories } from '@/hooks/useCategories'
import { useEffect, useState, useMemo } from 'react'
import PageLoader from '@/components/PageLoader'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { TransactionItem } from '@/components/TransactionItem'
import NoTransactionsFound from '@/components/NoTransactionsFound'
import { AccountCarousel, CarouselAccountCard } from '@/components/AccountCarousel'
import EditTransactionModal from '@/components/EditTransactionModal'
import AddTransactionModal, { TransactionDraft } from '@/components/AddTransactionModal'
import ReceiptScannerButton from '@/components/ReceiptScannerButton'
import MonthSelector from '@/components/MonthSelector'
import { useMonth } from '@/hooks/useMonth'
import { formatMonthKey, getTransactionMonthKey } from '@/utils/month'

export default function Page() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const { session } = useSession()
  const [refreshing, setRefreshing] = useState(false)
  const [activeAccountIndex, setActiveAccountIndex] = useState(0)

  // CRUD Modal States
  const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [receiptDraft, setReceiptDraft] = useState<TransactionDraft | null>(null)
  const [scanError, setScanError] = useState('')
  const [accountModalVisible, setAccountModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CarouselAccountCard | null>(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [newAccountType, setNewAccountType] = useState('checking')

  const currentUserId = isLoaded && isSignedIn ? user?.id : undefined;
  const { selectedMonth, isCurrentMonth, rolloverVersion } = useMonth();

  const { 
    transactions, 
    isLoading: isTransactionsLoading, 
    loadData: loadTransactions, 
    updateTransaction,
    deleteTransaction 
  } = useTransactions(currentUserId)

  const { 
    accounts, 
    isLoading: isAccountsLoading, 
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount
  } = useAccounts(currentUserId);

  const {
    categories,
    groupedCategories,
    fetchCategories,
  } = useCategories(currentUserId);

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadTransactions(), fetchAccounts(), fetchCategories()])
    setRefreshing(false)
  }

  useEffect(() => {
    if (currentUserId) {
      loadTransactions();
      fetchAccounts();
      fetchCategories();
    }
  }, [currentUserId, loadTransactions, fetchAccounts, fetchCategories, rolloverVersion])

  // Map category_id -> category name for fast lookup
  const categoryNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    (categories || []).forEach((cat: any) => {
      if (cat?.id && cat?.name) {
        map[cat.id] = cat.name;
      }
    });
    return map;
  }, [categories]);

  const handleOpenCreateAccount = () => {
    setEditingAccount(null);
    setNewAccountName('');
    setNewAccountType('checking');
    setNewAccountBalance('');
    setAccountModalVisible(true);
  };

  const handleOpenEditAccount = (account: CarouselAccountCard) => {
    setEditingAccount(account);
    setNewAccountName(account.name);
    setNewAccountType(account.type || 'checking');
    setNewAccountBalance(String(account.balance || 0));
    setAccountModalVisible(true);
  };

  const handleSaveAccount = async () => {
    if (!newAccountName.trim()) {
      Alert.alert('Error', 'Please enter an account name.');
      return;
    }

    const payload = {
      name: newAccountName.trim(),
      type: newAccountType,
      balance: parseFloat(newAccountBalance) || 0,
    };

    const success = editingAccount
      ? await updateAccount(editingAccount.id, payload)
      : await createAccount(payload);

    if (success) {
      setAccountModalVisible(false);
    }
  };

  const handleDeleteAccount = (accountId: string) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this account? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive', 
          onPress: async () => {
            const success = await deleteAccount(accountId);
            if (success) {
              setAccountModalVisible(false);
            }
          } 
        }
      ]
    );
  };

  const handleDeleteTransaction = (id: string) => {
    Alert.alert("Delete Transaction", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  };

  // ==========================================
  //  BALANCE CALCULATION
  // ==========================================
  const accountCards: CarouselAccountCard[] = useMemo(() => {
    const accTxsMap: Record<string, any[]> = {};
    (transactions || []).forEach((t: any) => {
      if (!accTxsMap[t.account_id]) accTxsMap[t.account_id] = [];
      accTxsMap[t.account_id].push(t);
    });

    const individualCards: CarouselAccountCard[] = accounts.map((acc: any) => {
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

      const trueBalance = hasInitialTxInLedger ? netTransactionFlow : baseBalance + netTransactionFlow;

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type ? acc.type.toUpperCase() : 'ACCOUNT',
        balance: trueBalance,
      };
    });

    const totalBalance = individualCards.reduce((sum, acc) => sum + acc.balance, 0);
    
    const overviewCard: CarouselAccountCard = {
      id: 'all',
      name: 'All Accounts',
      type: 'Overview',
      balance: totalBalance,
      isOverview: true
    };

    const addCard: CarouselAccountCard = {
      id: 'add-new-account',
      name: 'Add New Account',
      type: 'Action',
      balance: 0,
      isAddButton: true
    };

    return [overviewCard, ...individualCards, addCard];
  }, [accounts, transactions]); 

  const activeAccount = accountCards[activeAccountIndex] || accountCards[0];

  // Account balances above use ALL transactions; the list below only shows the selected month.
  const filteredTransactions = useMemo(() => {
    const baseList = (transactions as any[]).filter((t) =>
      getTransactionMonthKey(t) === selectedMonth &&
      (activeAccount?.id === 'all' || t.account_id === activeAccount?.id)
    );

    return baseList.map((tx) => ({
      ...tx,
      category:
        (tx.type === 'savings' || tx.type === 'savings_withdrawal')
          ? (tx.type === 'savings' ? 'To Savings Goal' : 'From Savings Goal')
          : (tx.category_id && categoryNameMap[tx.category_id]) ||
        tx.category_name ||
        tx.category ||
        'General',
    }));
  }, [transactions, activeAccount, categoryNameMap, selectedMonth]);

  // Income / expense totals for the selected month
  const monthTotals = useMemo(() => {
    return filteredTransactions.reduce(
      (acc, t: any) => {
        const amt = Number(t.amount || 0);
        if (t.type === 'income') acc.income += amt;
        else if (t.type === 'expense') acc.expenses += amt;
        return acc;
      },
      { income: 0, expenses: 0 }
    );
  }, [filteredTransactions]);

  const isPageLoading = (isTransactionsLoading || isAccountsLoading) && !refreshing && isSignedIn;
  if (isPageLoading) return <PageLoader />

  return (
    <View style={localStyles.container}>
      {/* HEADER SECTION */}
      <View style={localStyles.header}>
        <View style={localStyles.headerLeft}>
          <Image 
            source={require('@/assets/images/icon.png')} 
            style={localStyles.headerLogo} 
            resizeMode="contain"
          />
          <View style={localStyles.welcomeContainer}>
            <Text style={localStyles.welcomeText}>WELCOME BACK</Text>
            <Text style={localStyles.usernameText}>
              {user?.emailAddresses[0]?.emailAddress.split('@')[0] || 'Explorer'}
            </Text>
          </View>
        </View>
        <View style={localStyles.headerRight}>
          <SignOutButton />
        </View>
      </View>

      {/* EXTRACTED CAROUSEL COMPONENT */}
      <AccountCarousel
        cards={accountCards}
        activeIndex={activeAccountIndex}
        onSelectIndex={setActiveAccountIndex}
        onOpenCreate={handleOpenCreateAccount}
        onOpenEdit={handleOpenEditAccount}
      />

      {/* MONTH SELECTOR */}
      <MonthSelector style={localStyles.monthSelector} />

      {!activeAccount?.isAddButton && (
        <View style={localStyles.monthTotalsRow}>
          <View style={localStyles.monthTotalItem}>
            <Text style={localStyles.monthTotalLabel}>INCOME</Text>
            <Text style={[localStyles.monthTotalValue, { color: '#00D293' }]}>
              +${monthTotals.income.toFixed(2)}
            </Text>
          </View>
          <View style={localStyles.monthTotalItem}>
            <Text style={localStyles.monthTotalLabel}>EXPENSES</Text>
            <Text style={[localStyles.monthTotalValue, { color: '#FF6B6B' }]}>
              -${monthTotals.expenses.toFixed(2)}
            </Text>
          </View>
          <View style={localStyles.monthTotalItem}>
            <Text style={localStyles.monthTotalLabel}>NET</Text>
            <Text style={localStyles.monthTotalValue}>
              ${(monthTotals.income - monthTotals.expenses).toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      {/* SECTION HEADER */}
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionTitleWrap}>
          <Text style={localStyles.sectionTitle}>
            {activeAccount?.isOverview 
              ? (isCurrentMonth ? 'Recent Activity' : formatMonthKey(selectedMonth, true))
              : activeAccount?.isAddButton 
                ? 'Activity' 
                : `${activeAccount?.name}`}
          </Text>
          <View style={localStyles.counterBadge}>
            <Text style={localStyles.counterBadgeText}>
              {activeAccount?.isAddButton ? 0 : filteredTransactions.length}
            </Text>
          </View>
        </View>

        <View style={localStyles.headerActions}>
          <ReceiptScannerButton
            userId={currentUserId}
            onScanStart={() => setScanError('')}
            onError={setScanError}
            onDraft={(draft) => {
              setReceiptDraft(draft)
              setAddModalVisible(true)
            }}
          />
          <TouchableOpacity 
            style={localStyles.addSectionBtn} 
            onPress={() => { setReceiptDraft(null); setAddModalVisible(true) }}
          >
            <Ionicons name="add" size={16} color="#03151E" />
            <Text style={localStyles.addSectionBtnText}>New</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!!scanError && (
        <View style={localStyles.scanErrorBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#FF6B6B" />
          <Text style={localStyles.scanErrorText}>{scanError}</Text>
          <TouchableOpacity onPress={() => setScanError('')} hitSlop={8}>
            <Ionicons name="close" size={18} color="#FF6B6B" />
          </TouchableOpacity>
        </View>
      )}

      {/* TRANSACTIONS */}
      <FlatList
        style={localStyles.transactionsList}
        contentContainerStyle={localStyles.transactionsListContent}
        data={activeAccount?.isAddButton ? [] : filteredTransactions}
        renderItem={({ item }) => (
          <TransactionItem item={item as any} onDelete={handleDeleteTransaction} onEdit={(tx) => setEditingTransaction(tx)}/>
        )}
        ListEmptyComponent={<NoTransactionsFound onAdd={() => { setReceiptDraft(null); setAddModalVisible(true) }} />}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor="#00D293" 
            colors={['#00D293']}
          />
        }
      />

      {/* ADD TRANSACTION MODAL */}
      <AddTransactionModal
        visible={addModalVisible}
        userId={currentUserId}
        accounts={accounts as any[]}
        groups={groupedCategories}
        defaultAccountId={
          activeAccount && !activeAccount.isOverview && !activeAccount.isAddButton ? activeAccount.id : null
        }
        initialDraft={receiptDraft}
        onClose={() => { setAddModalVisible(false); setReceiptDraft(null) }}
        onCreated={async () => {
          await Promise.all([loadTransactions(), fetchAccounts(), fetchCategories()])
        }}
      />

      {/* EDIT TRANSACTION MODAL */}
      <EditTransactionModal
        transaction={editingTransaction}
        accounts={accounts as any[]}
        categories={categories as any[]}
        onClose={() => setEditingTransaction(null)}
        onSave={async (id, payload) => {
          const ok = await updateTransaction(id, payload)
          if (ok) setEditingTransaction(null)
        }}
      />

      {/* CREATE / EDIT ACCOUNT MODAL */}
      <Modal visible={accountModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
          style={localStyles.modalOverlay}
        >
          <View style={localStyles.modalContent}>
            <View style={localStyles.modalHeaderRow}>
              <View>
                <Text style={localStyles.modalHeader}>
                  {editingAccount ? 'Edit Account' : 'Add New Account'}
                </Text>
                <Text style={localStyles.modalSubHeader}>
                  Configure your payment or savings account
                </Text>
              </View>
              <TouchableOpacity 
                style={localStyles.closeModalIcon}
                onPress={() => setAccountModalVisible(false)}
              >
                <Ionicons name="close" size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            
            <Text style={localStyles.label}>ACCOUNT NAME</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="e.g. DBS Savings, OCBC Frank, Cash" 
              placeholderTextColor="#475569"
              value={newAccountName}
              onChangeText={setNewAccountName}
            />
            
            <Text style={localStyles.label}>ACCOUNT TYPE</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="checking, savings, credit, cash" 
              placeholderTextColor="#475569"
              value={newAccountType}
              onChangeText={setNewAccountType}
            />

            <Text style={localStyles.label}>INITIAL BALANCE ($)</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="0.00" 
              placeholderTextColor="#475569"
              keyboardType="decimal-pad"
              value={newAccountBalance}
              onChangeText={setNewAccountBalance}
            />

            <View style={localStyles.modalButtons}>
              <TouchableOpacity 
                style={localStyles.cancelBtn} 
                onPress={() => setAccountModalVisible(false)}
              >
                <Text style={localStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.saveBtn} onPress={handleSaveAccount}>
                <Text style={localStyles.saveText}>Save Account</Text>
              </TouchableOpacity>
            </View>

            {editingAccount && (
              <TouchableOpacity 
                style={localStyles.deleteBtnModal} 
                onPress={() => handleDeleteAccount(editingAccount.id)}
              >
                <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
                <Text style={localStyles.deleteBtnText}>Delete Account</Text>
              </TouchableOpacity>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const localStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#070D14', 
    paddingHorizontal: 20, 
    paddingTop: Platform.OS === 'android' ? 24 : 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#192839',
  },
  welcomeContainer: {
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 10,
    color: '#00D293',
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  usernameText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthSelector: {
    marginTop: 12,
  },
  monthTotalsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  monthTotalItem: {
    flex: 1,
    backgroundColor: '#0C1521',
    borderWidth: 1,
    borderColor: '#192839',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  monthTotalLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  monthTotalValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16,
    marginTop: 12,
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,107,107,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,107,107,0.3)',
  },
  scanErrorText: {
    flex: 1,
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
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
  transactionsList: {
    flex: 1,
  },
  transactionsListContent: {
    paddingBottom: 40,
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
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
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
  closeModalIcon: {
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