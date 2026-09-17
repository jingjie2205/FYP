import { SignOutButton } from '@/components/sign-out-button'
import { useSession, useUser } from '@clerk/expo'
import { Alert, Text, TouchableOpacity, Image, View, FlatList, RefreshControl, StyleSheet, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native'
import { useTransactions } from '@/hooks/useTransactions'
import { useAccounts } from '@/hooks/useAccounts'
import { useEffect, useState, useMemo } from 'react'
import PageLoader from '@/components/PageLoader'
import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { TransactionItem } from '@/components/TransactionItem'
import NoTransactionsFound from '@/components/NoTransactionsFound'
import { AccountCarousel, CarouselAccountCard } from '@/components/AccountCarousel'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function Page() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const { session } = useSession()
  const [refreshing, setRefreshing] = useState(false)
  const [activeAccountIndex, setActiveAccountIndex] = useState(0)

  // CRUD Modal States
  const [accountModalVisible, setAccountModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<CarouselAccountCard | null>(null)
  const [newAccountName, setNewAccountName] = useState('')
  const [newAccountBalance, setNewAccountBalance] = useState('')
  const [newAccountType, setNewAccountType] = useState('checking')

  const currentUserId = isLoaded && isSignedIn ? user?.id : undefined;

  const { 
    transactions, 
    isLoading: isTransactionsLoading, 
    loadData: loadTransactions, 
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

  const accountCards: CarouselAccountCard[] = useMemo(() => {
    const totalBalance = accounts.reduce((sum, acc: any) => sum + Number(acc.balance || 0), 0);
    const overviewCard: CarouselAccountCard = {
      id: 'all',
      name: 'All Accounts',
      type: 'Overview',
      balance: totalBalance,
      isOverview: true
    };

    const individualCards: CarouselAccountCard[] = accounts.map((acc: any) => ({
      id: acc.id,
      name: acc.name,
      type: acc.type ? acc.type.toUpperCase() : 'ACCOUNT',
      balance: Number(acc.balance || 0),
    }));

    const addCard: CarouselAccountCard = {
      id: 'add-new-account',
      name: 'Add New Account',
      type: 'Action',
      balance: 0,
      isAddButton: true
    };

    return [overviewCard, ...individualCards, addCard];
  }, [accounts]);

  const isPageLoading = (isTransactionsLoading || isAccountsLoading) && !refreshing && isSignedIn;
  if (isPageLoading) return <PageLoader />

  const activeAccount = accountCards[activeAccountIndex] || accountCards[0];

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

      {/* SECTION HEADER */}
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionTitleWrap}>
          <Text style={localStyles.sectionTitle}>
            {activeAccount?.isOverview ? 'Recent Transactions' : activeAccount?.isAddButton ? 'Transactions' : `${activeAccount?.name} Transactions`}
          </Text>
          <Text style={localStyles.sectionCount}>({activeAccount?.isAddButton ? 0 : filteredTransactions.length})</Text>
          <TouchableOpacity style={localStyles.addSectionBtn} onPress={() => router.push('/home/create')}>
            <Ionicons name="add" size={18} color="#FFF" />
            <Text style={localStyles.addSectionBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        style={localStyles.transactionsList}
        contentContainerStyle={localStyles.transactionsListContent}
        data={activeAccount?.isAddButton ? [] : filteredTransactions}
        renderItem={({ item }) => <TransactionItem item={item as any} onDelete={handleDeleteTransaction}/>}
        ListEmptyComponent={<NoTransactionsFound />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />

      {/* CREATE / EDIT ACCOUNT MODAL */}
      <Modal visible={accountModalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={localStyles.modalOverlay}>
          <View style={localStyles.modalContent}>
            <Text style={localStyles.modalHeader}>{editingAccount ? 'Edit Account' : 'Add New Account'}</Text>
            
            <Text style={localStyles.label}>Account Name</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="e.g. Savings, OCBC, Crypto Wallet" 
              placeholderTextColor="#9CA3AF"
              value={newAccountName}
              onChangeText={setNewAccountName}
            />
            
            <Text style={localStyles.label}>Account Type</Text>
            <TextInput 
              style={localStyles.input} 
              placeholder="checking, savings, credit" 
              placeholderTextColor="#9CA3AF"
              value={newAccountType}
              onChangeText={setNewAccountType}
            />

            <Text style={localStyles.label}>Account Balance ($)</Text>
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
              <TouchableOpacity style={localStyles.saveBtn} onPress={handleSaveAccount}>
                <Text style={localStyles.saveText}>Save</Text>
              </TouchableOpacity>
            </View>

            {editingAccount && (
              <TouchableOpacity 
                style={localStyles.deleteBtnModal} 
                onPress={() => handleDeleteAccount(editingAccount.id)}
              >
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