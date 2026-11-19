import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, FlatList, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Category } from '@/hooks/useCategories';

interface Props {
  visible: boolean;
  onClose: () => void;
  onConfirm: (donorId: string) => void;
  overspentCategory: Category | null;
  eligibleDonors: any[];
  availablePool: number;
  shortfallAmount: number;
  categorySpendingMap: Record<string, number>;
  /** Available = rollover + assigned - spent. Falls back to assigned - spent when not provided. */
  getAvailable?: (category: Category) => number;
}

export default function CoverModal({ visible, onClose, onConfirm, overspentCategory, eligibleDonors, availablePool, shortfallAmount, categorySpendingMap, getAvailable }: Props) {
  const canUsePool = availablePool > 0 && availablePool >= shortfallAmount;

  // Only envelopes that can cover the shortfall are listed
  const donorOptions = [
    ...(canUsePool ? [{ id: 'pool', name: 'Unallocated Cash Pool', available: availablePool }] : []),
    ...eligibleDonors
      .map(cat => ({
        id: cat.id,
        name: cat.name,
        available: getAvailable ? getAvailable(cat) : Number(cat.target_amount || 0) - (categorySpendingMap[cat.id] || 0),
      }))
      .filter(d => d.available >= shortfallAmount),
  ];

  const [donorSourceId, setDonorSourceId] = useState<string>('');

  // Reset selection to the first valid source when the modal opens
  useEffect(() => {
    if (visible) setDonorSourceId(canUsePool ? 'pool' : (donorOptions[0]?.id ?? ''));
  }, [visible, canUsePool, overspentCategory?.id]);

  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeaderRow}>
            <View>
              <Text style={styles.modalHeader}>Cover Overspending</Text>
              <Text style={styles.modalSubHeader}>
                {overspentCategory?.name} is short by <Text style={{ color: '#FF6B6B', fontWeight: '700' }}>${shortfallAmount.toFixed(2)}</Text>
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.label}>COVER FROM</Text>
          
          <View style={{ maxHeight: 250 }}>
            <FlatList
              data={donorOptions}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No envelope or cash pool has enough to cover ${shortfallAmount.toFixed(2)}.
                </Text>
              }
              renderItem={({ item }) => {
                const isSelected = donorSourceId === item.id;

                return (
                  <TouchableOpacity
                    onPress={() => setDonorSourceId(item.id)}
                    style={[styles.donorCard, isSelected && styles.donorCardSelected]}
                  >
                    <Text style={styles.donorName}>{item.name}</Text>
                    <Text style={[styles.donorAmount, { color: item.id === 'pool' ? '#FFFFFF' : '#00D293' }]}>
                      ${item.available.toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !donorSourceId && styles.donorCardDisabled]}
              disabled={!donorSourceId}
              onPress={() => onConfirm(donorSourceId)}
            >
              <Text style={styles.saveText}>Confirm Transfer</Text>
            </TouchableOpacity>
          </View>
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
  modalButtons: { flexDirection: 'row', gap: 12, marginTop: 32 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#00D293', alignItems: 'center' },
  saveText: { color: '#03151E', fontSize: 15, fontWeight: '700' },
  donorCard: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#1E2D3D', backgroundColor: '#03151E', marginBottom: 8 },
  donorCardSelected: { borderColor: '#00D293', backgroundColor: 'rgba(0, 210, 147, 0.05)' },
  donorCardDisabled: { opacity: 0.4 },
  emptyText: { color: '#64748B', fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  donorName: { color: '#FFFFFF', fontWeight: '600' },
  donorAmount: { fontWeight: '700' }
});