import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  SafeAreaView, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { useUser } from '@clerk/expo'
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL

export default function PlanScreen() {
  const { user } = useUser();
  const userId = user?.id;

  const [activeTab, setActiveTab] = useState<'spending' | 'savings'>('spending');
  const [loading, setLoading] = useState(true);
  const [planOverview, setPlanOverview] = useState({ 
    availablePool: 0, 
    totalCash: 0, 
    totalAllocated: 0 
  });

  // Fetch plan overview (Available Pool calculation)
  const fetchPlanOverview = async () => {
    if (!userId) return;
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/plan/${userId}`);
      if (!response.ok) throw new Error('Failed to fetch plan overview');
      const data = await response.json();
      setPlanOverview(data);
    } catch (error) {
      console.error('Error fetching plan overview:', error);
      Alert.alert('Error', 'Could not load budget plan data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchPlanOverview();
    }
  }, [userId]);

  // Handler for creating spending category or savings plan
  const handleCreateNew = () => {
    if (activeTab === 'spending') {
      // TODO: Open your existing Create Category modal or form flow here
      Alert.alert('Create Category', 'Trigger spending category creation flow here.');
    } else {
      // TODO: Open your existing Create Savings Plan modal or form flow here
      Alert.alert('Create Savings Goal', 'Trigger savings plan creation flow here.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 1. READY TO ASSIGN POOL HEADER */}
      <View style={styles.poolCard}>
        <Text style={styles.poolTitle}>Ready to Assign</Text>
        {loading ? (
          <ActivityIndicator size="small" color="#10B981" style={{ marginVertical: 10 }} />
        ) : (
          <Text style={[
            styles.poolAmount, 
            { color: planOverview.availablePool < 0 ? '#EF4444' : '#10B981' }
          ]}>
            ${planOverview.availablePool.toFixed(2)}
          </Text>
        )}
        <Text style={styles.poolSubtitle}>
          From total cash: ${planOverview.totalCash.toFixed(2)}
        </Text>
      </View>

      {/* 2. TAB SWITCHER & ACTION BUTTON */}
      <View style={styles.tabActionRow}>
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'spending' && styles.activeTab]} 
            onPress={() => setActiveTab('spending')}
          >
            <Text style={[styles.tabText, activeTab === 'spending' && styles.activeTabText]}>
              Spending
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.tab, activeTab === 'savings' && styles.activeTab]} 
            onPress={() => setActiveTab('savings')}
          >
            <Text style={[styles.tabText, activeTab === 'savings' && styles.activeTabText]}>
              Savings
            </Text>
          </TouchableOpacity>
        </View>

        {/* Dynamic Create Button */}
        <TouchableOpacity style={styles.createButton} onPress={handleCreateNew}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* 3. CONDITIONAL TAB CONTENT CONTAINER */}
      <View style={styles.contentContainer}>
        {activeTab === 'spending' ? (
          <View style={styles.placeholderContainer}>
            <Ionicons name="wallet-outline" size={48} color="#9CA3AF" />
            <Text style={styles.placeholderText}>Spending Envelopes List Coming Here</Text>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <Ionicons name="shield-checkmark-outline" size={48} color="#9CA3AF" />
            <Text style={styles.placeholderText}>Savings Goals List Coming Here</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  poolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: Platform.select({ ios: 0.05, android: 0.1, default: 0.05 }),
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  poolTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  poolAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginVertical: 6,
  },
  poolSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tabActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  tabContainer: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
  activeTabText: {
    color: '#111827',
  },
  createButton: {
    backgroundColor: '#10B981',
    justifyContent: 'center',
    alignItems: 'center',
    width: 44,
    height: 44,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
});