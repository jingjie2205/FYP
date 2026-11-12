import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  initialData?: { name: string; target: number };
  onClose: () => void;
  onSave: (name: string, targetAmount: number) => void;
  onDelete?: () => void;
}

export default function CategoryModal({ visible, initialData, onClose, onSave, onDelete }: Props) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');

  useEffect(() => {
    if (visible) {
      setName(initialData?.name || '');
      setTarget(initialData?.target ? String(initialData.target) : '');
    }
  }, [visible, initialData]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalHeader}>{initialData ? 'Edit Envelope' : 'New Envelope'}</Text>
              <Text style={styles.modalSubHeader}>Set allocated limits for this budget</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>BUDGET NAME</Text>
          <TextInput 
            style={styles.input} 
            placeholder="e.g. Groceries, Dining Out" 
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
          />
          
          <Text style={styles.label}>ALLOCATED BUDGET ($)</Text>
          <TextInput 
            style={styles.input} 
            placeholder="0.00" 
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={target}
            onChangeText={setTarget}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveBtn} 
              onPress={() => onSave(name, parseFloat(target) || 0)}
            >
              <Text style={styles.saveText}>Save Envelope</Text>
            </TouchableOpacity>
          </View>

          {initialData && onDelete && (
            <TouchableOpacity style={styles.deleteBtnModal} onPress={onDelete}>
              <Ionicons name="trash-outline" size={16} color="#FF6B6B" />
              <Text style={styles.deleteBtnText}>Delete Envelope</Text>
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
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#00D293', alignItems: 'center' },
  saveText: { color: '#03151E', fontSize: 15, fontWeight: '700' },
  deleteBtnModal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 8 },
  deleteBtnText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600' },
});