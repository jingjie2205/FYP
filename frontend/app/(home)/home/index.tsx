import { SignOutButton } from '@/components/sign-out-button'
import { useSession, useUser } from '@clerk/expo'
import { Alert, Text, TouchableOpacity, Image, View, FlatList, RefreshControl, StyleSheet } from 'react-native'
import { useTransactions } from '@/hooks/useTransactions'
import { useEffect, useState } from 'react'
import PageLoader from '@/components/PageLoader'
import { COLORS } from '@/constants/colors'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { BalanceCard } from '@/components/BalanceCard'
import { TransactionItem } from '@/components/TransactionItem'
import NoTransactionsFound from '@/components/NoTransactionsFound'

export default function Page() {
  const { user, isLoaded, isSignedIn } = useUser()
  const router = useRouter()
  const { session } = useSession()
  const [refreshing, setRefreshing] = useState(false)

  const { transactions, summary, isLoading, loadData, deleteTransaction } = useTransactions(isLoaded && isSignedIn ? user?.id : undefined)

  const onRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  useEffect(() => {
    if (user?.id) {
        loadData();
    }
  }, [loadData, user?.id])

  if (isLoading && !refreshing && isSignedIn) return <PageLoader />

  const handleDelete = (id : string) => {
    Alert.alert("Delete Transaction", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  };

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

      <BalanceCard summary={summary} />

      {/* SECTION HEADER*/}
      <View style={localStyles.sectionHeader}>
        <View style={localStyles.sectionTitleWrap}>
          <Text style={localStyles.sectionTitle}>Recent Transactions</Text>
          <Text style={localStyles.sectionCount}>({transactions.length})</Text>
        </View>
      </View>

      <FlatList
        style={localStyles.transactionsList}
        contentContainerStyle={localStyles.transactionsListContent}
        data={transactions}
        renderItem={({ item }) => <TransactionItem item={item} onDelete={handleDelete}/>}
        ListEmptyComponent={<NoTransactionsFound />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
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
    marginBottom: 16,
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
});