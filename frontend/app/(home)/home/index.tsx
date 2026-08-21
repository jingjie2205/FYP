import { SignOutButton } from '@/components/sign-out-button'
import { useSession, useUser } from '@clerk/expo'
import { Alert, Text, TouchableOpacity, Image, View, FlatList, RefreshControl, StyleSheet, Dimensions, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts, Account } from '@/hooks/useAccounts'
import { useEffect, useState, useRef, useMemo } from 'react'
import PageLoader from '@/components/PageLoader'
import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { TransactionItem } from '@/components/TransactionItem'
import NoTransactionsFound from '@/components/NoTransactionsFound'

const { width } = Dimensions.get('window');

interface CarouselAccountCard {
  id: string;
  name: string;
  type: string;
  balance: number;
  income: number;
  expense: number;
  isAddButton?: boolean;
}

export default function Page() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const { session } = useSession()
  const [refreshing, setRefreshing] = useState(false)
  const [activeAccountIndex, setActiveAccountIndex] = useState(0)

  // Modal form states for creating a new account
  const [accountModalVisible, setAccountModalVisible] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [newAccountType, setNewAccountType] = useState('checking')

  const currentUserId = isLoaded && isSignedIn ? user?.id : undefined;

  const { 
    transactions, 
    summary, 
    isLoading: isTransactionsLoading, 
    loadData: loadTransactions, 
    deleteTransaction 
  } = useTransactions(currentUserId)

  const { 
    accounts, 
    isLoading: isAccountsLoading, 
    fetchAccounts,
    createAccount
  } = useAccounts(currentUserId)

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveAccountIndex(viewableItems[0].index);
    }
  }).current;

  const onRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadTransactions(), fetchAccounts()])
    setRefreshing(false)
  }

  useEffect(() => {
    if (currentUserId) {
      loadTransactions();
      fetchAccounts();
    }
  }, [currentUserId, loadTransactions, fetchAccounts])

  // Handle creating a new account using the hook function
  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;

    const success = await createAccount({
      name: newAccountName.trim(),
      type: newAccountType,
      balance: parseFloat(newAccountBalance) || 0.00
    });

    if (success) {
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountType('checking');
      setAccountModalVisible(false);
      fetchAccounts(); // Ensure local state syncs up
    }
  };

  // Build the list of carousel cards with dynamic income/expense/balance calculated from transactions
  const accountCards: CarouselAccountCard[] = useMemo(() => {
    const allTotalIncome = summary?.income ?? 0;
    const allTotalExpense = summary?.expenses ?? 0;
    const allTotalBalance = summary?.balance ?? 0;

    const overviewCard: CarouselAccountCard = {
      id: 'all',
      name: 'All Accounts',
      type: 'Overview',
      balance: allTotalBalance,
      income: allTotalIncome,
      expense: allTotalExpense,
    };

    const individualCards: CarouselAccountCard[] = accounts.map((acc: Account) => {
      const accTransactions = (transactions as any[]).filter(t => t.account_id === acc.id);
      
      const accIncome = accTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      const accExpense = accTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);

      // Base starting balance from the database, defaulting to 0
      const initialBalance = Number(acc.balance || 0);

      // Live balance = Initial Balance + Total Income - Total Expenses
      const liveBalance = initialBalance + accIncome - accExpense;

      return {
        id: acc.id,
        name: acc.name,
        type: acc.type ? acc.type.toUpperCase() : 'ACCOUNT',
        balance: liveBalance,
        income: Number(accIncome || 0),
        expense: Number(accExpense || 0),
      };
    });

    const addCard: CarouselAccountCard = {
      id: 'add-new-account',
      name: 'Add New Account',
      type: 'Action',
      balance: 0,
      income: 0,
      expense: 0,
      isAddButton: true
    };

    return [overviewCard, ...individualCards, addCard];
  }, [accounts, transactions, summary]);

  const isPageLoading = (isTransactionsLoading || isAccountsLoading) && !refreshing && isSignedIn;
  if (isPageLoading) return <PageLoader />

  const handleDelete = (id : string) => {
    Alert.alert("Delete Transaction", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  };

  const activeAccount = accountCards[activeAccountIndex] || accountCards[0];

  // Filter transactions based on the selected account card
  const filteredTransactions = activeAccount?.id === 'all' 
    ? transactions 
    : (transactions as any[]).filter(t => t.account_id === activeAccount?.id);

  return (
    <View style={localStyles.container}>
      {/* HEADER SECTION */}
      <View style={localStyles.header}>
        <View style={localStyles.headerLeft}>
          <Image source={require('@/assets/images/icon.png')} style={localStyles.headerLogo} resizeMode="contain"/>
          <View style={localStyles.welcomeContainer}>
            <Text style={localStyles.welcomeText}>Welcome</Text>
            <Text style={localStyles.usernameText}>{user?.emailAddresses[0]?.emailAddress.split('@')[0]}</Text>
          </View>
        </View>
        <View style={localStyles.headerRight}>
          <TouchableOpacity style={localStyles.addSectionBtn} onPress={() => router.push('/home/create')}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={localStyles.addSectionBtnText}>Add</Text>
          </TouchableOpacity>
          <SignOutButton />
        </View>
      </View>

      {/* BALANCE CARD CAROUSEL */}
      <View style={localStyles.carouselContainer}>
        <FlatList
          data={accountCards}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => {
            if (item.isAddButton) {
              return (
                <TouchableOpacity 
                  style={[localStyles.balanceCard, localStyles.addCardContainer, { width: width - 32 }]}
                  onPress={() => setAccountModalVisible(true)}
                >
                  <View style={localStyles.addIconCircle}>
                    <Ionicons name="add" size={28} color={COLORS.primary} />
                  </View>
                  <Text style={localStyles.addCardTitle}>Add New Account</Text>
                  <Text style={localStyles.addCardSubtitle}>Tap to configure a new bank, wallet or card</Text>
                </TouchableOpacity>
              );
            }

            return (
              <View style={[localStyles.balanceCard, { width: width - 32 }]}>
                <View style={localStyles.cardTopRow}>
                  <Text style={localStyles.cardAccountName}>{item.name}</Text>
                  <View style={localStyles.accountTypeBadge}>
                    <Text style={localStyles.accountTypeText}>{item.type}</Text>
                  </View>
                </View>

                <Text style={localStyles.netAmount}>
                  ${Math.abs(item.balance || 0).toFixed(2)}
                  <Text style={localStyles.netSubtitle}> {(item.balance || 0) >= 0 ? 'Balance' : 'Debt'}</Text>
                </Text>

                <View style={localStyles.summaryRow}>
                  <View>
                    <Text style={localStyles.subLabel}>Account Income</Text>
                    <Text style={localStyles.incomeText}>+${Number(item?.income || 0).toFixed(2)}</Text>
                  </View>
                  <View style={localStyles.divider} />
                  <View>
                    <Text style={localStyles.subLabel}>Account Expense</Text>
                    <Text style={localStyles.expenseText}>-${Number(item?.expense || 0).toFixed(2)}</Text>
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Carousel Pagination Dots */}
        {accountCards.length > 1 && (
          <View style={localStyles.paginationDots}>
            {accountCards.map((_, idx) => (
              <View 
                key={idx} 
                style={[localStyles.dot, activeAccountIndex === idx && localStyles.activeDot]} 
              />
            ))}
          </View>
        )}
      </View>

      {/* SECTION HEADER */}
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionTitleWrap}>
          <Text style={localStyles.sectionTitle}>
            {activeAccount?.id === 'all' ? 'Recent Transactions' : activeAccount?.isAddButton ? 'Transactions' : `${activeAccount?.name} Transactions`}
          </Text>
          <Text style={localStyles.sectionCount}>({activeAccount?.isAddButton ? 0 : filteredTransactions.length})</Text>
        </View>
      </View>

      <FlatList
        style={localStyles.transactionsList}
        contentContainerStyle={localStyles.transactionsListContent}
        data={activeAccount?.isAddButton ? [] : filteredTransactions}
        renderItem={({ item }) => <TransactionItem item={item as any} onDelete={handleDelete}/>}
        ListEmptyComponent={<NoTransactionsFound />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* CREATE ACCOUNT MODAL */}
      <Modal visible={accountModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalHeader}>Add New Account</Text>
            
            <Text style={localStyles.label}>Account Name</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="e.g. Savings, OCBC, Crypto Wallet" 
              placeholderTextColor="#9CA3AF"
              value={newAccountName}
              onChangeText={setNewAccountName}
            />
            
            <Text style={localStyles.label}>Initial Starting Balance ($)</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="0.00" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={newAccountBalance}
              onChangeText={setNewAccountBalance}
            />

            <View style={localStyles.modalButtons}>
              <TouchableOpacity style={localStyles.cancelBtn} onPress={() => setAccountModalVisible(false)}>
                <Text style={localStyles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={localStyles.saveBtn} onPress={handleCreateAccount}>
                <Text style={localStyles.saveText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const localStyles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    paddingHorizontal: 16, 
    paddingTop: 16 
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerLogo: {
    width: 38,
    height: 38,
    borderRadius: 10,
  },
  welcomeContainer: {
    justifyContent: 'center',
  },
  welcomeText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  usernameText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  addSectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 4,
  },
  addSectionBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  carouselContainer: {
    marginBottom: 12,
  },
  balanceCard: { 
    backgroundColor: COLORS.card, 
    borderRadius: 16, 
    padding: 18, 
    elevation: 2, 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 5 
  },
  addCardContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 135,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#D1D5DB'
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text
  },
  addCardSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardAccountName: { 
    fontSize: 12, 
    color: '#6B7280', 
    fontWeight: '600', 
    textTransform: 'uppercase' 
  },
  accountTypeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accountTypeText: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '600',
  },
  netAmount: { 
    fontSize: 26, 
    fontWeight: '700', 
    marginVertical: 4,
    color: COLORS.text
  },
  netSubtitle: { 
    fontSize: 13, 
    fontWeight: '400', 
    color: '#6B7280' 
  },
  summaryRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 12, 
    borderTopWidth: 1, 
    borderTopColor: '#F3F4F6', 
    paddingTop: 10 
  },
  subLabel: { 
    fontSize: 11, 
    color: '#6B7280' 
  },
  incomeText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#10B981', 
    marginTop: 2 
  },
  expenseText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#EF4444', 
    marginTop: 2 
  },
  divider: { 
    width: 1, 
    backgroundColor: '#E5E7EB' 
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  activeDot: {
    width: 16,
    backgroundColor: COLORS.primary,
  },
  sectionHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 12,
    marginTop: 4,
  },
  sectionTitleWrap: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  sectionTitle: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: COLORS.text 
  },
  sectionCount: { 
    fontSize: 13, 
    color: '#6B7280', 
    fontWeight: '500' 
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
});