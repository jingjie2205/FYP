import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator, ScrollView, TextInput,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerField from '@/components/DatePickerField';
import EnvelopeSelect from '@/components/EnvelopeSelect';
import { GroupedCategory } from '@/hooks/useCategories';

export interface RecurringProposal {
  mode: 'create' | 'update';
  recurringDetails: {
    recurringId: string | null;
    title: string;
    amount: number;
    type: 'expense' | 'income';
    accountId: string | null;
    accountName: string | null;
    categoryId: string | null;
    categoryName: string | null;
    frequency: string;
    nextDate: string;
  };
}

export interface RecurringSubmission {
  mode: 'create' | 'update';
  recurringId: string | null;
  title: string;
  amount: number;
  type: 'expense' | 'income';
  accountId: string;
  categoryId: string | null;
  frequency: string;
  nextDate: string;
}

interface Props {
  visible: boolean;
  proposal: RecurringProposal | null;
  accounts: { id: string; name: string }[];
  groups: GroupedCategory[];
  onClose: () => void;
  /** Applies the confirmed values; should throw an Error with a user-facing message on failure */
  onConfirm: (values: RecurringSubmission) => Promise<void>;
}

const FREQUENCIES = ['Weekly', 'Monthly', 'Yearly'];

export default function RecurringProposalModal({ visible, proposal, accounts, groups, onClose, onConfirm }: Props) {
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState('Monthly');
  const [nextDate, setNextDate] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible || !proposal) return;
    const d = proposal.recurringDetails;
    setTitle(d.title);
    setAmount(String(d.amount));
    setFrequency(d.frequency || 'Monthly');
    setNextDate(d.nextDate);
    setAccountId(d.accountId && accounts.some((a) => a.id === d.accountId) ? d.accountId : '');
    setCategoryId(d.categoryId);
    setError('');
    setSubmitting(false);
  }, [visible, proposal]);

  if (!proposal) return null;
  const { mode, recurringDetails: d } = proposal;
  const isExpense = d.type === 'expense';

  const handleConfirm = async () => {
    if (submitting) return;
    const parsed = parseFloat(amount);
    if (!title.trim()) return setError('Please enter a title.');
    if (!Number.isFinite(parsed) || parsed <= 0) return setError('Amount must be greater than 0.');
    if (!accountId) return setError('Please choose an account.');
    if (isExpense && !categoryId) return setError('Please choose an envelope for this expense.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return setError('Please choose a date.');

    setSubmitting(true);
    setError('');
    try {
      await onConfirm({
        mode,
        recurringId: d.recurringId,
        title: title.trim(),
        amount: parsed,
        type: d.type,
        accountId,
        categoryId: isExpense ? categoryId : null,
        frequency,
        nextDate,
      });
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not save this recurring payment. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <Ionicons name="repeat" size={22} color="#00D293" />
            <Text style={styles.title}>{mode === 'update' ? 'Update Recurring' : 'Create Recurring'}</Text>
            <View style={[styles.typePill, isExpense ? styles.pillExpense : styles.pillIncome]}>
              <Text style={[styles.pillText, { color: isExpense ? '#FF6B6B' : '#00D293' }]}>{isExpense ? 'Expense' : 'Income'}</Text>
            </View>
          </View>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.label}>TITLE</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor="#475569" />

            <Text style={styles.label}>AMOUNT ($)</Text>
            <TextInput style={styles.input} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholderTextColor="#475569" />

            <Text style={styles.label}>FREQUENCY</Text>
            <View style={styles.chipWrap}>
              {FREQUENCIES.map((f) => (
                <TouchableOpacity key={f} style={[styles.chip, frequency === f && styles.chipActive]} onPress={() => setFrequency(f)}>
                  <Text style={[styles.chipText, frequency === f && styles.chipTextActive]}>{f}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>NEXT DATE</Text>
            <DatePickerField value={nextDate} onChange={setNextDate} minDate="1970-01-01" />

            <Text style={styles.label}>ACCOUNT</Text>
            <View style={[styles.chipWrap, !accountId && styles.needs]}>
              {accounts.map((a) => (
                <TouchableOpacity key={a.id} style={[styles.chip, accountId === a.id && styles.chipActive]} onPress={() => setAccountId(a.id)}>
                  <Text style={[styles.chipText, accountId === a.id && styles.chipTextActive]}>{a.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isExpense && (
              <>
                <Text style={styles.label}>ENVELOPE</Text>
                <View style={!categoryId ? styles.needs : undefined}>
                  <EnvelopeSelect groups={groups} value={categoryId} onChange={setCategoryId} />
                </View>
              </>
            )}
          </ScrollView>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={16} color="#FF6B6B" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={submitting}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleConfirm} disabled={submitting}>
              {submitting ? <ActivityIndicator size="small" color="#03151E" /> : <Text style={styles.confirmText}>{mode === 'update' ? 'Save Changes' : 'Create'}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3, 21, 30, 0.8)' },
  content: { backgroundColor: '#0C1A25', padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: '#1E2D3D' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  typePill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10, borderWidth: 1 },
  pillExpense: { backgroundColor: 'rgba(255,107,107,0.12)', borderColor: 'rgba(255,107,107,0.35)' },
  pillIncome: { backgroundColor: 'rgba(0,210,147,0.12)', borderColor: 'rgba(0,210,147,0.35)' },
  pillText: { fontSize: 11, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#1E2D3D', backgroundColor: '#121E2C', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#FFFFFF' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D' },
  chipActive: { borderColor: '#00D293', backgroundColor: 'rgba(0,210,147,0.08)' },
  chipText: { color: '#8295AB', fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: '#00D293' },
  needs: { borderWidth: 1, borderColor: '#38BDF8', borderRadius: 12, padding: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, padding: 10, borderRadius: 10, backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)' },
  errorText: { flex: 1, color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  buttons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelText: { color: '#64748B', fontWeight: '600' },
  confirmBtn: { backgroundColor: '#00D293', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10, minWidth: 120, alignItems: 'center' },
  confirmText: { color: '#03151E', fontWeight: '700' },
});
