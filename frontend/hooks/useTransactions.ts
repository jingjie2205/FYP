import { useCallback, useState } from 'react'
import { Alert } from 'react-native'

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export const useTransactions = (userId : string | undefined) => {
  const [transactions, setTransactions] = useState([])
  const [summary, setSummary] = useState({
    balance: 0,
    expenses: 0,
    income: 0,
  })

  const [isLoading, setIsLoading] = useState(true)

  const fetchTransactions = useCallback(async () => {
    try {
        const response = await fetch(`${API_URL}/transactions/${userId}`)
        const data = await response.json()
        setTransactions(data)
    } catch (e) {
        console.error("Error fetching transactions:", e)
    }
  }, [userId])

  const fetchSummary = useCallback(async () => {
    try {
        const response = await fetch(`${API_URL}/transactions/summary/${userId}`)
        const data = await response.json()
        setSummary(data)
    } catch (e) {
        console.error("Error fetching summary:", e)
    }
  }, [userId])

  const loadData = useCallback(async () => {
    if (!userId) return
    setIsLoading(true)

    try {
        await Promise.all([fetchTransactions(), fetchSummary()])
    } catch (e) {
        console.error("Error fetching data:", e)
    } finally {
        setIsLoading(false)
    }
  }, [userId, fetchTransactions, fetchSummary])

  const deleteTransaction = async (id : string) => {
    try {
        const response = await fetch(`${API_URL}/transactions/${id}`, {
            method: 'DELETE',
        })
        if (!response.ok) {
            throw new Error('Failed to delete transaction')
        }
        await loadData()
        Alert.alert('Transaction deleted')
    } catch (e) {
        console.error('Error deleting transaction:', e)
        const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred'
        Alert.alert('Error deleting transaction', errorMessage)
    }
  }
  
  return {
    transactions,
    summary,
    isLoading,
    loadData,
    deleteTransaction,
  }
}