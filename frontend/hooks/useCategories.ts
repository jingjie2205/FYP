import { useCallback, useState, useMemo } from 'react';
import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface CategoryGroup {
  id: string;
  user_id: string;
  name: string;
  created_at?: string;
}

export interface Category {
  id: string;
  user_id: string;
  group_id: string;
  name: string;
  /** Amount assigned for the month being viewed (or the default budget when no month is passed). */
  target_amount: number;
  current_amount: number; 
  created_at?: string;
  // Only present when fetched with a month:
  /** Leftover carried in from the previous month. */
  rollover?: number;
  /** Default monthly budget used when a new month is rolled over. */
  default_amount?: number;
  /** False when no budget row exists for that month (e.g. months before tracking began). */
  has_budget?: boolean;
  month?: string;
}

export interface GroupedCategory extends CategoryGroup {
  categories: Category[];
}

/**
 * @param month optional "YYYY-MM". When given, each category's target_amount / rollover
 *              reflect that month's envelope instead of the default budget.
 */
export const useCategories = (userId: string | undefined, month?: string) => {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // ==========================================
  // FETCH ALL DATA
  // ==========================================
  const fetchCategories = useCallback(async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // const [groupsRes, categoriesRes] = await Promise.all([
      //   fetch(`${API_URL}/groups/${userId}`),
      //   fetch(`${API_URL}/categories/${userId}`)
      // ]);
      
      // if (!groupsRes.ok || !categoriesRes.ok) {
      //   throw new Error('Failed to fetch budget hierarchy');
      // }
      const groupsRes = await fetch(`${API_URL}/groups/${userId}`);
      const categoriesRes = await fetch(
        `${API_URL}/categories/${userId}${month ? `?month=${month}` : ''}`
      );

      if (!groupsRes.ok) {
        const errText = await groupsRes.text();
        console.log("Groups Fetch Error:", groupsRes.status, errText);
      }
      if (!categoriesRes.ok) {
        const errText = await categoriesRes.text();
        console.log("Categories Fetch Error:", categoriesRes.status, errText);
      }

      if (!groupsRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to fetch budget hierarchy');
      }

      const groupsData = await groupsRes.json();
      const categoriesData = await categoriesRes.json();

      setGroups(groupsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error fetching budget hierarchy:', error);
      Alert.alert('Error', 'Could not load envelopes and groups.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, month]);

  const groupedCategories: GroupedCategory[] = useMemo(() => {
    return groups.map(group => ({
      ...group,
      categories: categories.filter(cat => cat.group_id === group.id)
    }));
  }, [groups, categories]);

  // ==========================================
  // GROUP (HEADER) OPERATIONS
  // ==========================================
  const createGroup = async (name: string) => {
    if (!userId) return false;
    try {
      const response = await fetch(`${API_URL}/groups/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, user_id: userId }),
      });

      if (!response.ok) throw new Error('Failed to create group');

      const newGroup = await response.json();
      setGroups((prev) => [...prev, newGroup]);
      return true;
    } catch (error) {
      console.error('Error creating group:', error);
      Alert.alert('Error', 'Could not create category group.');
      return false;
    }
  };

  const updateGroup = async (groupId: string, name: string) => {
    try {
      const response = await fetch(`${API_URL}/groups/${groupId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      if (!response.ok) throw new Error('Failed to update group');

      const updatedGroup = await response.json();
      
      setGroups((prev) =>
        prev.map((group) => (group.id === groupId ? updatedGroup : group))
      );
      return true;
    } catch (error) {
      console.error('Error updating group:', error);
      Alert.alert('Error', 'Could not rename category group. Please try again.');
      return false;
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!userId) return false;
    try {
      const response = await fetch(`${API_URL}/groups/${groupId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete group');

      setGroups((prev) => prev.filter((group) => group.id !== groupId));
      setCategories((prev) => prev.filter((cat) => cat.group_id !== groupId));
      return true;
    } catch (error) {
      console.error('Error deleting group:', error);
      Alert.alert('Error', 'Could not delete category group.');
      return false;
    }
  };

  // ==========================================
  // CATEGORY (ENVELOPE) OPERATIONS
  // ==========================================
  const createCategory = async (categoryData: Pick<Category, 'name' | 'target_amount' | 'group_id'>) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_URL}/categories/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...categoryData, user_id: userId, month }),
      });

      if (!response.ok) throw new Error('Failed to create category');

      const newCategory = await response.json();
      setCategories((prev) => [...prev, newCategory]);
      return true;
    } catch (error) {
      console.error('Error creating category:', error);
      Alert.alert('Error', 'Could not create category. Please try again.');
      return false;
    }
  };

  /**
   * @param options.applyToDefault false = change only this month's envelope (e.g. covering overspending),
   *                               true (default) = also change the default budget used for future months
   */
  const updateCategory = async (
    categoryId: string,
    updateData: Partial<Omit<Category, 'id' | 'user_id'>>,
    options: { applyToDefault?: boolean } = {}
  ) => {
    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...updateData,
          month,
          apply_to_default: options.applyToDefault ?? true,
        }),
      });

      if (!response.ok) throw new Error('Failed to update category');

      const updatedCategory = await response.json();
      
      setCategories((prev) =>
        prev.map((cat) => (cat.id === categoryId ? updatedCategory : cat))
      );
      return true;
    } catch (error) {
      console.error('Error updating category:', error);
      Alert.alert('Error', 'Could not update category. Please try again.');
      return false;
    }
  };

  const deleteCategory = async (categoryId: string) => {
    if (!userId) return false;

    try {
      const response = await fetch(`${API_URL}/categories/${categoryId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }), 
      });

      if (!response.ok) throw new Error('Failed to delete category');

      setCategories((prev) => prev.filter((category) => category.id !== categoryId));
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      Alert.alert('Error', 'Could not delete category. Please try again.');
      return false;
    }
  };

  return {
    categories,
    groups,
    groupedCategories,
    isLoading,
    fetchCategories,
    createGroup,
    updateGroup,
    deleteGroup,
    createCategory,
    updateCategory,
    deleteCategory,
  };
};