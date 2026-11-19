import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal, ScrollView,
  KeyboardAvoidingView, Platform, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DatePickerField from '@/components/DatePickerField';
import EnvelopeSelect from '@/components/EnvelopeSelect';
import { GroupedCategory } from '@/hooks/useCategories';
import { getPhoneDateString } from '@/utils/month';
import { API_URL as FALLBACK_API_URL } from '@/constants/api';

const API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;

type TxType = 'expense' | 'income';

export interface TransactionDraft {
  title?: string | null;
  amount?: number | null;
  account_id?: string | null;
  category_id?: string | null;
  transaction_date?: string;
  fromReceipt?: boolean;
  uncertain_fields?: string[];
}

interface AccountLite {
  id: string;
  name: string;
  type?: string;
}

interface Props {
  visible: boolean;
  userId: string | undefined;
  accounts: AccountLite[];
  groups: GroupedCategory[];
  /** Account selected in the Home carousel; falls back to the first account when null (e.g. "All Accounts") */
  defaultAccountId: string | null;
  /** Pre-fills the form (e.g. from a scanned receipt). Nothing is saved until the user taps Save. */
  initialDraft?: TransactionDraft | null;
  onClose: () => void;
  /** Called after at least one transaction was created, so the caller can refresh its data */
  onCreated: () => Promise<void> | void;
}

const money = (n: number) => n.toFixed(2);

export default function AddTransactionModal({
  visible, userId, accounts, groups, defaultAccountId, initialDraft, onClose, onCreated,
}: Props) {
  const [type, setType] = useState<TxType>('expense');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(getPhoneDateString());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Expense fields
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Income fields: account id -> entered amount
  const [incomeAmounts, setIncomeAmounts] = useState<Record<string, string>>({});

  // Reset the form every time the sheet opens
  useEffect(() => {
    if (!visible) return;
    const preselected =
      defaultAccountId && accounts.some((a) => a.id === defaultAccountId)
        ? defaultAccountId
        : accounts[0]?.id || '';
    if (initialDraft?.fromReceipt) {
      // Receipt review: fill only what the scan was sure about; leave everything else blank
      const draftDate = initialDraft.transaction_date;
      setType('expense');
      setTitle(initialDraft.title ?? '');
      setDate(draftDate && /^\d{4}-\d{2}-\d{2}$/.test(draftDate) ? draftDate : getPhoneDateString());
      setAmount(initialDraft.amount != null && initialDraft.amount > 0 ? String(initialDraft.amount) : '');
      setAccountId(initialDraft.account_id && accounts.some((a) => a.id === initialDraft.account_id) ? initialDraft.account_id : '');
      setCategoryId(initialDraft.category_id ?? null);
    } else {
      setType('expense');
      setTitle('');
      setDate(getPhoneDateString());
      setAmount('');
      setAccountId(preselected);
      setCategoryId(null);
    }
    setIncomeAmounts({});
    setError('');
    setSaving(false);
  }, [visible]);

  const incomeTotal = useMemo(
    () =>
      Object.values(incomeAmounts).reduce((sum, v) => {
        const n = parseFloat(v);
        return sum + (Number.isFinite(n) && n > 0 ? n : 0);
      }, 0),
    [incomeAmounts]
  );

  const postTransaction = async (body: Record<string, unknown>) => {
    const response = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to create transaction');
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setError('');

    if (!userId) return setError('You must be signed in to add a transaction.');
    if (!title.trim()) return setError('Please enter a title.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Please choose a date.');

    if (type === 'expense') {
      const parsed = parseFloat(amount);
      if (!Number.isFinite(parsed) || parsed <= 0) return setError('Amount must be greater than 0.');
      if (!accountId) return setError('Please select an account.');
      if (!categoryId) return setError('Please select an envelope.');

      setSaving(true);
      try {
        await postTransaction({
          user_id: userId,
          account_id: accountId,
          category_id: categoryId,
          title: title.trim(),
          amount: parsed,
          type: 'expense',
          transaction_date: date,
        });
        await onCreated();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to create transaction.');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Income: one transaction per account with an amount > 0
    const entries = accounts
      .map((a) => ({ account: a, value: parseFloat(incomeAmounts[a.id] || '') }))
      .filter((e) => Number.isFinite(e.value) && e.value > 0);
    if (entries.length === 0) return setError('Enter an amount greater than 0 for at least one account.');

    setSaving(true);
    const remaining = { ...incomeAmounts };
    let createdAny = false;
    try {
      for (const { account, value } of entries) {
        await postTransaction({
          user_id: userId,
          account_id: account.id,
          category_id: null,
          title: title.trim(),
          amount: value,
          type: 'income',
          transaction_date: date,
        });
        createdAny = true;
        delete remaining[account.id]; // so a retry never double-posts this account
      }
      await onCreated();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to create transaction.';
      if (createdAny) {
        setIncomeAmounts(remaining);
        await onCreated();
        setError(`${msg} Accounts already saved were cleared; fix the remaining ones and save again.`);
      } else {
        setError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const isExpense = type === 'expense';
  const fromReceipt = !!initialDraft?.fromReceipt;
  // Highlight required expense inputs that are still blank, so the user knows what to vet
  const needsTitle = fromReceipt && isExpense && !title.trim();
  const needsAmount = fromReceipt && isExpense && !(parseFloat(amount) > 0);
  const needsAccount = fromReceipt && isExpense && !accountId;
  const needsEnvelope = fromReceipt && isExpense && !categoryId;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.header}>New Transaction</Text>
              <Text style={styles.subHeader}>
                {isExpense ? 'Spend from an envelope' : 'Income goes to Unallocated Cash'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} disabled={saving}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Expense / Income toggle */}
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.typeBtn, isExpense && styles.typeExpenseActive]}
              onPress={() => { setType('expense'); setError(''); }}
              disabled={saving}
            >
              <Text style={[styles.typeText, isExpense && styles.typeTextActive]}>Expense</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, !isExpense && styles.typeIncomeActive]}
              onPress={() => { setType('income'); setError(''); }}
              disabled={saving}
            >
              <Text style={[styles.typeText, !isExpense && styles.typeTextActive]}>Income</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: 440 }}
          >
            {fromReceipt && (
              <View style={styles.receiptBox}>
                <Ionicons name="scan-outline" size={18} color="#38BDF8" />
                <Text style={styles.receiptText}>Receipt scanned — review and fill in any blank fields before saving</Text>
              </View>
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={18} color="#FF6B6B" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <Text style={styles.label}>TITLE</Text>
            <TextInput
              style={[styles.input, needsTitle && styles.needsInput]}
              value={title}
              onChangeText={setTitle}
              placeholder={isExpense ? 'Merchant or description' : 'e.g. Monthly Salary, Allowance'}
              placeholderTextColor="#475569"
            />

            {isExpense ? (
              <>
                <Text style={styles.label}>AMOUNT ($)</Text>
                <TextInput
                  style={[styles.input, needsAmount && styles.needsInput]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor="#475569"
                />

                <Text style={styles.label}>ACCOUNT</Text>
                <View style={[styles.chipWrap, needsAccount && styles.needsBox]}>
                  {accounts.map((a) => {
                    const active = accountId === a.id;
                    return (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.chip, active && styles.chipActive]}
                        onPress={() => setAccountId(a.id)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{a.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.label}>ENVELOPE (REQUIRED)</Text>
                <View style={needsEnvelope ? styles.needsBox : undefined}>
                  <EnvelopeSelect groups={groups} value={categoryId} onChange={setCategoryId} />
                </View>
              </>
            ) : (
              <>
                <Text style={styles.label}>AMOUNT PER ACCOUNT</Text>
                {accounts.map((a) => (
                  <View key={a.id} style={styles.accountRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountName} numberOfLines={1}>{a.name}</Text>
                      {!!a.type && (
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>{a.type}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.amountField}>
                      <Text style={styles.dollar}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={incomeAmounts[a.id] ?? ''}
                        onChangeText={(v) => setIncomeAmounts((prev) => ({ ...prev, [a.id]: v }))}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#475569"
                      />
                    </View>
                  </View>
                ))}
                <View style={styles.totalBar}>
                  <Text style={styles.totalLabel}>Total Income:</Text>
                  <Text style={styles.totalValue}>${money(incomeTotal)}</Text>
                </View>
              </>
            )}

            <Text style={styles.label}>DATE</Text>
            <DatePickerField value={date} onChange={setDate} minDate="1970-01-01" />
          </ScrollView>

          <View style={styles.buttons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={onClose} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, isExpense ? null : styles.saveBtnIncome, saving && { opacity: 0.6 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator color="#070D14" /> : <Text style={styles.saveText}>Save</Text>}
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
  label: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12, letterSpacing: 0.8 },
  input: { borderWidth: 1, borderColor: '#1E2D3D', backgroundColor: '#121E2C', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#FFFFFF' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 4 },
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
  receiptBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(56,189,248,0.1)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.35)', borderRadius: 12, padding: 10, marginTop: 8 },
  receiptText: { flex: 1, color: '#38BDF8', fontSize: 12, fontWeight: '600' },
  needsInput: { borderColor: '#38BDF8' },
  needsBox: { borderWidth: 1, borderColor: '#38BDF8', borderRadius: 12, padding: 6 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,107,107,0.1)', borderWidth: 1, borderColor: 'rgba(255,107,107,0.3)', borderRadius: 12, padding: 10, marginTop: 8 },
  errorText: { flex: 1, color: '#FF6B6B', fontSize: 12, fontWeight: '600' },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 8 },
  accountName: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  typeBadge: { alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(0,210,147,0.08)', borderWidth: 1, borderColor: '#1E2D3D' },
  typeBadgeText: { color: '#8295AB', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  amountField: { flexDirection: 'row', alignItems: 'center', width: 120, backgroundColor: '#0C1521', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 10, paddingHorizontal: 10 },
  dollar: { color: '#00D293', fontWeight: '700', marginRight: 4 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 14, paddingVertical: 8, textAlign: 'right' },
  totalBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,210,147,0.08)', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, marginTop: 4 },
  totalLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
  totalValue: { color: '#00D293', fontSize: 15, fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: 12, marginTop: 16 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', alignItems: 'center' },
  cancelText: { fontWeight: '600', color: '#94A3B8' },
  saveBtn: { flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF6B6B', alignItems: 'center' },
  saveBtnIncome: { backgroundColor: '#00D293' },
  saveText: { fontWeight: '700', color: '#070D14' },
});
