import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface Account {
  id: string;
  name: string;
  type: string; // e.g., 'cash', 'debit', 'credit'
  balance?: number;
}

export const useAccounts = (userId: string | undefined) => {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Adjust this endpoint if your routes are structured differently
      const response = await fetch(`${API_URL}/accounts/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const data = await response.json();
      setAccounts(data);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      Alert.alert('Error', 'Could not load accounts.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  return {
    accounts,
    isLoading,
    fetchAccounts,
  };
};