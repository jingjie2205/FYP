import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsPlan } from '@/hooks/useSavings';
import DatePickerField from '@/components/DatePickerField';

interface Props {
  visible: boolean;
  initialData?: SavingsPlan | null;
  onClose: () => void;
  onSave: (payload: { name: string; target_amount: number; deadline: string }) => void;
  onDelete?: () => void;
}

export default function SavingsModal({ visible, initialData, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [deadline, setDeadline] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initialData?.name || '');
      setTarget(initialData?.target_amount ? String(initialData.target_amount) : '');
      // Keep only the date part so timestamps from the API never leak into the picker
      setDeadline(initialData?.deadline ? String(initialData.deadline).slice(0, 10) : '');
    }
  }, [visible, initialData]);

  const handleSave = () => {
    onSave({
      name: name.trim(),
      target_amount: parseFloat(target) || 0,
      // Empty = no target date (shown as "Ongoing"); otherwise always a real YYYY-MM-DD from the picker
      deadline
    });
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalHeader}>{initialData ? 'Edit Savings Goal' : 'New Savings Goal'}</Text>
              <Text style={styles.modalSubHeader}>Plan your target and tracking parameters</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ maxHeight: 480 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.label}>GOAL TITLE</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Vacation, Emergency Fund" 
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />
          
          <View style={styles.modalInputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>TARGET ($)</Text>
              <TextInput 
                style={styles.input} 
                placeholder="5000" 
                placeholderTextColor="#475569"
                keyboardType="decimal-pad"
                value={target}
                onChangeText={setTarget}
              />
            </View>
          </View>

          {!initialData && (
            <Text style={styles.hintText}>Goals start at $0. Add funds from your Unallocated Cash after creating it.</Text>
          )}

          <Text style={styles.label}>TARGET DATE</Text>
          <DatePickerField value={deadline} onChange={setDeadline} placeholder="Select a target date" />
          </ScrollView>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveText}>{initialData ? 'Save Changes' : 'Create Goal'}</Text>
            </TouchableOpacity>
          </View>

          {initialData && onDelete && (
            <TouchableOpacity style={styles.deleteBtnModal} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
              <Text style={styles.deleteBtnText}>Delete Savings Plan</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3, 21, 30, 0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#0C1A25', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E2D3D' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  modalHeader: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  modalSubHeader: { color: '#64748B', fontSize: 13 },
  modalCloseBtn: { padding: 4, backgroundColor: '#1E2D3D', borderRadius: 12 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 16 },
  hintText: { color: '#64748B', fontSize: 12, marginTop: 10 },
  modalInputRow: { flexDirection: 'row', gap: 12 },
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#00D293', alignItems: 'center' },
  saveText: { color: '#03151E', fontSize: 15, fontWeight: '700' },
  deleteBtnModal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  deleteBtnText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600' },
});