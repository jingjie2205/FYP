import { useUser } from '@clerk/expo';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSavings, SavingsPlan } from '@/hooks/useSavings';
import PageLoader from '@/components/PageLoader';
import { COLORS } from '@/constants/colors';

export default function SavingsPage() {
  const { user, isLoaded, isSignedIn } = useUser();
  const currentUserId = isLoaded && isSignedIn ? user?.id : undefined;

  const { savingsPlans, isLoading, fetchSavings, createSavingsPlan, updateSavingsPlan } = useSavings(currentUserId);
  const [refreshing, setRefreshing] = useState(false);

  // Modal States
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [savedAmount, setSavedAmount] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (currentUserId) fetchSavings();
  }, [currentUserId, fetchSavings]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchSavings();
    setRefreshing(false);
  };

  const openCreateModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setTargetAmount('');
    setSavedAmount('');
    setDeadline('');
    setModalVisible(true);
  };

  const openEditModal = (plan: SavingsPlan) => {
    setIsEditing(true);
    setCurrentId(plan.id);
    setName(plan.name);
    setTargetAmount(plan.target_amount.toString());
    setSavedAmount(plan.saved_amount.toString());
    setDeadline(plan.deadline);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !targetAmount) {
      Alert.alert('Validation Error', 'Please provide a name and target amount.');
      return;
    }

    const payload = {
      name: name.trim(),
      target_amount: parseFloat(targetAmount) || 0,
      saved_amount: parseFloat(savedAmount) || 0,
      deadline: deadline.trim() || '2027-12-31',
    };

    let success = false;
    if (isEditing && currentId) {
      success = await updateSavingsPlan(currentId, payload);
    } else {
      success = await createSavingsPlan(payload);
    }

    if (success) {
      setModalVisible(false);
      fetchSavings();
    }
  };

  if (isLoading && !refreshing) return <PageLoader />;

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Savings Goals</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal}>
          <Ionicons name="add" size={18} color="#FFF" />
          <Text style={styles.addBtnText}>New Goal</Text>
        </TouchableOpacity>
      </View>

      {/* LIST OF GOALS */}
      <FlatList
        data={savingsPlans}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const target = Number(item.target_amount) || 1;
          const saved = Number(item.saved_amount) || 0;
          const rawPercentage = (saved / target) * 100;
          const percentage = Math.min(Math.max(rawPercentage, 0), 100).toFixed(1);

          return (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View>
                  <Text style={styles.planName}>{item.name}</Text>
                  <Text style={styles.deadlineText}>Target by: {item.deadline}</Text>
                </View>
                <TouchableOpacity onPress={() => openEditModal(item)} style={styles.editIconBtn}>
                  <Ionicons name="pencil" size={16} color="#4B5563" />
                </TouchableOpacity>
              </View>

              <View style={styles.amountRow}>
                <Text style={styles.savedText}>${saved.toLocaleString()} <Text style={styles.targetSubText}>/ ${target.toLocaleString()}</Text></Text>
                <Text style={styles.percentageText}>{percentage}%</Text>
              </View>

              {/* Progress Bar Container */}
              <View style={styles.progressBarBackground}>
                <View style={[styles.progressBarFill, { width: `${percentage}%` as any}]} />
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="flag-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyText}>No savings plans found. Create one to get started!</Text>
          </View>
        }
      />

      {/* CREATE / EDIT MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalHeader}>{isEditing ? 'Edit Savings Plan' : 'New Savings Plan'}</Text>
            
            <Text style={styles.label}>Plan Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. New Home Downpayment" 
              placeholderTextColor="#9CA3AF"
              value={name}
              onChangeText={setName}
            />
            
            <Text style={styles.label}>Target Amount ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="50000" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={targetAmount}
              onChangeText={setTargetAmount}
            />

            <Text style={styles.label}>Already Saved ($)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="5000" 
              placeholderTextColor="#9CA3AF"
              keyboardType="numeric"
              value={savedAmount}
              onChangeText={setSavedAmount}
            />

            <Text style={styles.label}>Completion Deadline</Text>
            <TextInput 
              style={styles.input} 
              placeholder="YYYY-MM-DD" 
              placeholderTextColor="#9CA3AF"
              value={deadline}
              onChangeText={setDeadline}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveText}>{isEditing ? 'Save Changes' : 'Create Plan'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 16, paddingTop: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  addBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primary, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, gap: 4 },
  addBtnText: { color: '#FFF', fontSize: 12, fontWeight: '600' },
  listContent: { paddingBottom: 40 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 18, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  planName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  deadlineText: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  editIconBtn: { padding: 6, backgroundColor: '#F3F4F6', borderRadius: 8 },
  amountRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
  savedText: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  targetSubText: { fontSize: 13, fontWeight: '400', color: '#6B7280' },
  percentageText: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  progressBarBackground: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 4 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyText: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, marginTop: 10 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  modalContent: { backgroundColor: COLORS.card, padding: 22, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  modalHeader: { fontSize: 17, fontWeight: '700', marginBottom: 14, color: COLORS.text },
  label: { fontSize: 12, fontWeight: '600', color: '#4B5563', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 12, color: COLORS.text },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 10 },
  cancelBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#4B5563' },
  saveBtn: { flex: 1, padding: 12, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: 'center' },
  saveText: { fontWeight: '600', color: '#FFF' },
});