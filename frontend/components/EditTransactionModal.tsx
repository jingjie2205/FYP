import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  /** The transaction being edited; the modal is hidden when null */
  transaction: any | null;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  onClose: () => void;
  onSave: (id: string, payload: {
    title: string;
    amount: number;
    type: 'income' | 'expense';
    account_id: string;
    category_id: string | null;
    transaction_date: string;
  }) => Promise<void> | void;
}

export default function EditTransactionModal({ transaction, accounts, categories, onClose, onSave }: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [date, setDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Pre-fill whenever a different transaction is opened
  useEffect(() => {
    if (!transaction) return;
    setTitle(transaction.title || '');
    setAmount(String(Math.abs(Number(transaction.amount || 0))));
    setType(transaction.type === 'income' ? 'income' : 'expense');
    setDate(String(transaction.transaction_date || transaction.created_at || '').slice(0, 10));
    setAccountId(transaction.account_id || '');
    setCategoryId(transaction.category_id || null);
    setSaving(false);
  }, [transaction?.id]);

  const handleSave = async () => {
    const parsedAmount = parseFloat(amount);
    if (!title.trim()) return Alert.alert('Error', 'Please enter a title.');
    if (isNaN(parsedAmount) || parsedAmount <= 0) return Alert.alert('Error', 'Amount must be greater than 0.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T00:00:00`).getTime())) {
      return Alert.alert('Error', 'Date must be in YYYY-MM-DD format.');
    }
    if (!accountId) return Alert.alert('Error', 'Please select an account.');

    setSaving(true);
    await onSave(transaction.id, {
      title: title.trim(),
      amount: parsedAmount,
      type,
      account_id: accountId,
      category_id: categoryId,
      transaction_date: date,
    });
    setSaving(false);
  };

  return (
    <Modal visible={!!transaction} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.header}>Edit Transaction</Text>
              <Text style={styles.subHeader}>Changes update balances, budgets and analytics</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
            <Text style={styles.label}>TYPE</Text>
            <View style={styles.row}>
              {(['expense', 'income'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, type === t && (t === 'income' ? styles.typeIncomeActive : styles.typeExpenseActive)]}
                  onPress={() => setType(t)}
                >
                  <Text style={[styles.typeText, type === t && styles.typeTextActive]}>
                    {t === 'income' ? 'Income' : 'Expense'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>TITLE</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Title" placeholderTextColor="#475569" />

            <Text style={styles.label}>AMOUNT ($)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#475569" />

            <Text style={styles.label}>DATE (YYYY-MM-DD)</Text>
            <TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="2026-11-18" placeholderTextColor="#475569" autoCapitalize="none" />

            <Text style={styles.label}>ACCOUNT</Text>
            <View style={styles.chipWrap}>
              {accounts.map((a) => (
                <TouchableOpacity key={a.id} style={[styles.chip, accountId === a.id && styles.chipActive]} onPress={() => setAccountId(a.id)}>
                  <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>CATEGORY</Text>
            <View style={styles.chipWrap}>
              <TouchableOpacity style={[styles.chip, categoryId === null && styles.chipActive]} onPress={() => setCategoryId(null)}>
                <Text style={[styles.chipText, categoryId === null && styles.chipTextActive]}>None</Text>
              </TouchableOpacity>
              {categories.map((c) => (
                <TouchableOpacity key={c.id} style={[styles.chip, categoryId === c.id && styles.chipActive]} onPress={() => setCategoryId(c.id)}>
                  <Text style={[styles.chipText, categoryId === c.id && styles.chipTextActive]}>{c.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.75)' },
  content: { backgroundColor: '#0C1521', padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#1E2D3D' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  header: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  subHeader: { fontSize: 12, color: '#64748B', marginTop: 2 },
  closeBtn: { padding: 4 },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 8, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#1E2D3D', backgroundColor: '#121E2C', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', alignItems: 'center' },
  typeIncomeActive: { backgroundColor: 'rgba(0,210,147,0.12)', borderColor: '#00D293' },
  typeExpenseActive: { backgroundColor: 'rgba(255,107,107,0.12)', borderColor: '#FF6B6B' },
  typeText: { color: '#64748B', fontWeight: '700', fontSize: 13 },
  typeTextActive: { color: '#FFFFFF' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D' },
  chipActive: { borderColor: '#00D293', backgroundColor: 'rgba(0,210,147,0.08)' },
  chipText: { color: '#8295AB', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#00D293' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#94A3B8' },
  saveBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: '#00D293', alignItems: 'center' },
  saveText: { fontWeight: '700', color: '#03151E' },
});
