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

  const createAccount = async (accountData: { name: string; type: string; balance: number }) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_URL}/accounts/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          ...accountData,
        }),
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error("Server error response:", responseText);
        throw new Error(`Failed to create account: ${response.status}`);
      }

      const newAccount = JSON.parse(responseText);
      setAccounts(prevAccounts => [...prevAccounts, newAccount]);
      return true;
    } catch (error) {
      console.error('Error creating account:', error);
      Alert.alert('Error', 'Could not create account.');
      return false;
    }
  };

  const updateAccount = async (
    accountId: string,
    accountData: { name: string; type: string; balance: number }
  ) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_URL}/accounts/${accountId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(accountData),
      });

      if (!response.ok) {
        throw new Error('Failed to update account');
      }

      const updated = await response.json();
      setAccounts(prev => prev.map(acc => (acc.id === accountId ? { ...acc, ...updated } : acc)));
      return true;
    } catch (error) {
      console.error('Error updating account:', error);
      Alert.alert('Error', 'Could not update account.');
      return false;
    }
  };

  const deleteAccount = async (accountId: string) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_URL}/accounts/${accountId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      setAccounts(prev => prev.filter(acc => acc.id !== accountId));
      return true;
    } catch (error) {
      console.error('Error deleting account:', error);
      Alert.alert('Error', 'Could not delete account.');
      return false;
    }
  };

  return {
    accounts,
    isLoading,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  };
};