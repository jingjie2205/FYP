import { SignOutButton } from '@/components/sign-out-button'
import { ThemedText } from '@/components/themed-text'
import { ThemedView } from '@/components/themed-view'
import { Show, useSession, useUser } from '@clerk/expo'
import { Link } from 'expo-router'
import { Alert, Text, TouchableOpacity, Image, View, FlatList, RefreshControl } from 'react-native'
import { useTransactions } from '@/hooks/useTransactions'
import { useEffect, useState } from 'react'
import PageLoader from '@/components/PageLoader'
import { styles } from '@/assets/styles/home.styles'
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

  const { transactions, summary, isLoading, loadData, deleteTransaction } = useTransactions(isLoaded && isSignedIn ? user?.id : null)

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

  if (isLoading && !refreshing) return <PageLoader />

  const handleDelete = (id : string) => {
    Alert.alert("Delete Transaction", "Are you sure you want to delete this transaction?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteTransaction(id) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* { HEADER SECTION } */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('@/assets/images/icon.png')} style={styles.headerLogo} resizeMode="contain"/>
            <View style={styles.welcomeContainer}>
              <Text style={styles.welcomeText}>Welcome</Text>
              <Text style={styles.usernameText}>{user?.emailAddresses[0]?.emailAddress.split('@')[0]}</Text>
            </View>
          </View>
        </View>
        {/* { "RIGHT" } */}
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.addButton} onPress={() => router.push('/create')}>
            <Ionicons name="add-circle-outline" size={24} color="#FFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
          <SignOutButton />
        </View>
      </View>
      <BalanceCard summary={summary} />
      <View style={styles.transactionsHeaderContainer}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
      </View>
      <FlatList
        style={styles.transactionsList}
        contentContainerStyle={styles.transactionsListContent}
        data={transactions}
        renderItem={({ item }) => <TransactionItem item={item} onDelete={handleDelete}/>}
        ListEmptyComponent={<NoTransactionsFound />}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  )
}