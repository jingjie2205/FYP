import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface Category {
  id: string;
  user_id: string;
  name: string;
  target_amount: number; // Assigned money
  current_amount: number; // Available spendable money
  created_at?: string;
}

export const useCategories = (userId: string | undefined) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 1. Fetch Categories
  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/categories/${userId}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.log("Fetch Categories Error Details:", response.status, errorText);
        throw new Error('Failed to fetch categories');
      }

      const data = await response.json();
      setCategories(data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      Alert.alert('Error', 'Could not load categories.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // 2. Create Category
  const createCategory = async (categoryData: Omit<Category, 'id' | 'current_amount'> & { target_amount?: number }) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/categories/${userId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...categoryData, user_id: userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create category');
      }

      const newCategory = await response.json();
      setCategories((prevCategories) => [...prevCategories, newCategory]);
      return true;
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Could not create category. Please try again.');
      return false;
    }
  };

  // 3. Update Category (supports updating name, target_amount, and current_amount)
  const updateCategory = async (categoryId: string, updateData: Partial<Omit<Category, 'id' | 'user_id'>>) => {
    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        throw new Error('Failed to update category');
      }

      const updatedCategory = await response.json();
      
      // Update local state smoothly
      setCategories((prevCategories) =>
        prevCategories.map((cat) => (cat.id === categoryId ? updatedCategory : cat))
      );
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Could not update category. Please try again.');
      return false;
    }
  };

  // 4. Delete Category
  const deleteCategory = async (categoryId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }), 
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      setCategories((prevCategories) => 
        prevCategories.filter((category) => category.id !== categoryId)
      );
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', 'Could not delete category. Please try again.');
    }
  };

  return {
    categories,
    isLoading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};