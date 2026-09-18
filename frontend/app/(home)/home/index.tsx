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
import { useEffect, useState, useMemo } from 'react'
import PageLoader from '@/components/PageLoader'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { TransactionItem } from '@/components/TransactionItem'
import NoTransactionsFound from '@/components/NoTransactionsFound'
import { AccountCarousel, CarouselAccountCard } from '@/components/AccountCarousel'

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

      {/* SECTION HEADER */}
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionTitleWrap}>
          <Text style={localStyles.sectionTitle}>
            {activeAccount?.isOverview 
              ? 'Recent Activity' 
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

        <TouchableOpacity 
          style={localStyles.addSectionBtn} 
          onPress={() => router.push('/home/create')}
        >
          <Ionicons name="add" size={16} color="#03151E" />
          <Text style={localStyles.addSectionBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* TRANSACTIONS FEED */}
      <FlatList
        style={localStyles.transactionsList}
        contentContainerStyle={localStyles.transactionsListContent}
        data={activeAccount?.isAddButton ? [] : filteredTransactions}
        renderItem={({ item }) => (
          <TransactionItem item={item as any} onDelete={handleDeleteTransaction}/>
        )}
        ListEmptyComponent={<NoTransactionsFound />}
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