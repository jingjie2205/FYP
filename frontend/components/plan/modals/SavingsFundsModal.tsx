import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SavingsPlan } from '@/hooks/useSavings';

interface Props {
  visible: boolean;
  mode: 'add' | 'withdraw';
  plan: SavingsPlan | null;
  /** Unallocated Cash available to fund a goal */
  availablePool: number;
  onClose: () => void;
  onConfirm: (amount: number) => Promise<void> | void;
}

export default function SavingsFundsModal({ visible, mode, plan, availablePool, onClose, onConfirm }: Props) {
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setSaving(false);
    }
  }, [visible]);

  const isAdd = mode === 'add';
  const saved = Number(plan?.saved_amount || 0);
  // Adding is limited by the pool; withdrawing by what the goal holds
  const maxAmount = isAdd ? Math.max(0, availablePool) : saved;
  const parsed = parseFloat(amount);
  const hasValue = !isNaN(parsed) && parsed > 0;
  // Compare in cents to avoid float noise
  const exceeds = hasValue && Math.round(parsed * 100) > Math.round(maxAmount * 100);
  const canSubmit = hasValue && !exceeds && !saving;

  const handleConfirm = async () => {
    if (!canSubmit) return;
    setSaving(true);
    await onConfirm(parsed);
    setSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.header}>{isAdd ? 'Add Funds' : 'Withdraw to Cash'}</Text>
              <Text style={styles.subHeader}>
                {isAdd ? `Move money from Unallocated Cash into "${plan?.name}"` : `Return money from "${plan?.name}" to Unallocated Cash`}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.infoLabel}>{isAdd ? 'UNALLOCATED CASH' : 'SAVED IN GOAL'}</Text>
            <Text style={[styles.infoValue, maxAmount <= 0 && { color: '#FF6B6B' }]}>${maxAmount.toFixed(2)}</Text>
          </View>

          <View style={styles.labelRow}>
            <Text style={styles.label}>AMOUNT ($)</Text>
            <TouchableOpacity onPress={() => setAmount(maxAmount > 0 ? String(Math.floor(maxAmount * 100) / 100) : '')} disabled={maxAmount <= 0}>
              <Text style={[styles.maxText, maxAmount <= 0 && { opacity: 0.4 }]}>Max</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={[styles.input, exceeds && styles.inputError]}
            placeholder="0.00"
            placeholderTextColor="#475569"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
          />

          {exceeds && (
            <Text style={styles.errorText}>
              {isAdd
                ? `You only have $${maxAmount.toFixed(2)} of Unallocated Cash available.`
                : `This goal only has $${maxAmount.toFixed(2)} saved.`}
            </Text>
          )}
          {isAdd && maxAmount <= 0 && !exceeds && (
            <Text style={styles.errorText}>No Unallocated Cash available. Free some up from your envelopes first.</Text>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, !canSubmit && styles.disabled]} onPress={handleConfirm} disabled={!canSubmit}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : isAdd ? 'Add Funds' : 'Withdraw'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(3, 21, 30, 0.9)', justifyContent: 'flex-end' },
  content: { backgroundColor: '#0C1A25', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderWidth: 1, borderColor: '#1E2D3D' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  header: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', marginBottom: 4 },
  subHeader: { color: '#64748B', fontSize: 13 },
  closeBtn: { padding: 4, backgroundColor: '#1E2D3D', borderRadius: 12, marginLeft: 12 },
  infoBox: { backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, padding: 14 },
  infoLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  infoValue: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', marginTop: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  label: { color: '#94A3B8', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  maxText: { color: '#00D293', fontSize: 12, fontWeight: '700' },
  input: { backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, padding: 16, color: '#FFFFFF', fontSize: 18 },
  inputError: { borderColor: '#FF6B6B' },
  errorText: { color: '#FF6B6B', fontSize: 12, marginTop: 8 },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  saveBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#00D293', alignItems: 'center' },
  saveText: { color: '#03151E', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.4 },
});
