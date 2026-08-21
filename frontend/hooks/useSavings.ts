import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

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

  const createSavingsPlan = async (planData: Omit<SavingsPlan, 'id'>) => {
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

  const updateSavingsPlan = async (id: string, planData: Partial<SavingsPlan>) => {
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

  return { savingsPlans, isLoading, fetchSavings, createSavingsPlan, updateSavingsPlan };
};