import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { getPhoneDateString } from '@/utils/month';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface SavingsPlan {
  id: string;
  name: string;
  target_amount: number;
  saved_amount: number;
  deadline: string; // ISO date string or formatted string
}

export const useSavings = (userId: string | undefined) => {
  const [savingsPlans, setSavingsPlans] = useState<SavingsPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchSavings = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/savings/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch savings plans');
      const data = await response.json();
      setSavingsPlans(data);
    } catch (error) {
      console.error('Error fetching savings:', error);
      Alert.alert('Error', 'Could not load savings plans.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // New goals always start at 0 saved; money only enters a goal through contributeToPlan
  const createSavingsPlan = async (planData: Pick<SavingsPlan, 'name' | 'target_amount' | 'deadline'>) => {
    if (!userId) return false;
    try {
      const response = await fetch(`${API_URL}/savings/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
      if (!response.ok) throw new Error('Failed to create savings plan');
      const newPlan = await response.json();
      setSavingsPlans(prev => [newPlan, ...prev]);
      return true;
    } catch (error) {
      console.error('Error creating savings plan:', error);
      Alert.alert('Error', 'Could not create savings plan.');
      return false;
    }
  };

  const updateSavingsPlan = async (id: string, planData: Partial<Pick<SavingsPlan, 'name' | 'target_amount' | 'deadline'>>) => {
    try {
      const response = await fetch(`${API_URL}/savings/plan/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planData),
      });
      if (!response.ok) throw new Error('Failed to update savings plan');
      const updated = await response.json();
      setSavingsPlans(prev => prev.map(p => (p.id === id ? updated : p)));
      return true;
    } catch (error) {
      console.error('Error updating savings plan:', error);
      Alert.alert('Error', 'Could not update savings plan.');
      return false;
    }
  };

  // Deleting a goal releases its saved amount back into Unallocated Cash
  const deleteSavingsPlan = async (planId: string) => {
    try {
      const response = await fetch(`${API_URL}/savings/${planId}`, { 
        method: 'DELETE' 
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete savings plan');
      }
      
      setSavingsPlans(prev => prev.filter(p => p.id !== planId));
      return true;
    } catch (error) {
      console.error('Error deleting savings plan:', error);
      return false;
    }
  };

  // Moves money between Unallocated Cash and a goal (recorded as a 'savings' /
  // 'savings_withdrawal' transaction that never affects account balances).
  const moveFunds = async (planId: string, amount: number, direction: 'contribute' | 'withdraw') => {
    if (!userId) return false;
    try {
      const response = await fetch(`${API_URL}/savings/${planId}/${direction}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, amount, transaction_date: getPhoneDateString() }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || 'Request failed');
      }
      const updated = await response.json();
      setSavingsPlans(prev => prev.map(p => (p.id === planId ? updated : p)));
      return true;
    } catch (error) {
      console.error(`Error during savings ${direction}:`, error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update savings goal.');
      return false;
    }
  };

  const contributeToPlan = (planId: string, amount: number) => moveFunds(planId, amount, 'contribute');
  const withdrawFromPlan = (planId: string, amount: number) => moveFunds(planId, amount, 'withdraw');

  return { savingsPlans, isLoading, fetchSavings, createSavingsPlan, updateSavingsPlan, deleteSavingsPlan, contributeToPlan, withdrawFromPlan };
};