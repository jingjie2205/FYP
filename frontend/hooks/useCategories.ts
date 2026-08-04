import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

// You can adjust this interface to match your database schema
export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  icon?: string;
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
        // Temporarily add these two lines to see the REAL error in your terminal
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
  const createCategory = async (categoryData: Omit<Category, 'id'>) => {
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
      
      // Update local state immediately so the UI reflects the change without a refresh
      setCategories((prevCategories) => [...prevCategories, newCategory]);
      
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Could not create category. Please try again.');
    }
  };

  // 3. Delete Category
  const deleteCategory = async (categoryId: string) => {
    if (!userId) return;

    try {
      const response = await fetch(`${API_URL}/api/categories/${categoryId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        // Passing userId in the body to ensure the backend verifies ownership before deleting
        body: JSON.stringify({ userId }), 
      });

      if (!response.ok) {
        throw new Error('Failed to delete category');
      }

      // Remove the deleted category from local state
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
    deleteCategory,
  };
};