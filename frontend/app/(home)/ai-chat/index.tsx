import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useChat, parseMetadata } from '../../../hooks/useChat';
import { useAccounts } from '../../../hooks/useAccounts';
import { useCategories } from '../../../hooks/useCategories';
import ReallocationModal from '../../../components/chat/ReallocationModal';
import BudgetAllocationModal, { BudgetPlan } from '../../../components/chat/BudgetAllocationModal';
import RecurringProposalModal, { RecurringProposal, RecurringSubmission } from '../../../components/chat/RecurringProposalModal';
import { getPhoneDateString, getPhoneMonthKey } from '../../../utils/month';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const { user } = useUser();
  const userId = user?.id;
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const {
    sessions,
    messages,
    isLoadingMessages,
    isSending,
    fetchSessions,
    createSession,
    fetchMessages,
    sendMessage,
    deleteSession,
    setMessages,
  } = useChat(userId);

  const { accounts, fetchAccounts } = useAccounts(userId);
  // Current month's envelopes: target_amount is the amount assigned this month
  const { categories, groupedCategories, fetchCategories } = useCategories(userId, getPhoneMonthKey());

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [isNewSessionModalVisible, setIsNewSessionModalVisible] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const [isReallocationModalVisible, setIsReallocationModalVisible] = useState(false);
  const [activeTransferDetails, setActiveTransferDetails] = useState({
    sourceCategory: '',
    destCategory: '',
    amount: 0,
    sourceBefore: 0,
    sourceAfter: 0,
    destBefore: 0,
    destAfter: 0,
  });

  const [budgetPlan, setBudgetPlan] = useState<BudgetPlan | null>(null);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [recurringProposal, setRecurringProposal] = useState<RecurringProposal | null>(null);
  const [recurringModalVisible, setRecurringModalVisible] = useState(false);

  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToLatest = (animated = true) => scrollViewRef.current?.scrollToEnd({ animated });

  // Keep the newest message visible when messages change or the keyboard opens
  const latestMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    const t = setTimeout(() => scrollToLatest(true), 50);
    return () => clearTimeout(t);
  }, [messages.length, latestMessageId]);

  // Track keyboard visibility so the input bar can swap its bottom padding
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => setTimeout(() => scrollToLatest(true), 50));
    return () => sub.remove();
  }, []);
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchSessions();
      fetchAccounts();
      fetchCategories(); // Load categories on mount
    }
  }, [userId, fetchSessions, fetchAccounts, fetchCategories]);

  // Set default active session once sessions load
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
      fetchMessages(sessions[0].id);
    }
  }, [sessions, activeSessionId, fetchMessages]);

  const handleSelectSession = (sessionId: string) => {
    if (sessionId !== activeSessionId) setMessages([]);
    setActiveSessionId(sessionId);
    fetchMessages(sessionId);
    setIsDrawerOpen(false);
  };

  const handleCreateNewSession = async () => {
    if (!newSessionName.trim()) return;
    const newSession = await createSession(newSessionName.trim());
    if (newSession) {
      setActiveSessionId(newSession.id);
      fetchMessages(newSession.id);
    }
    setNewSessionName('');
    setIsNewSessionModalVisible(false);
    setIsDrawerOpen(false);
  };

  // Look a category up by id first, then by case-insensitive name
  const findCategory = (id?: string, name?: string) =>
    categories.find((c) => id && c.id === id) ||
    categories.find((c) => name && c.name.trim().toLowerCase() === name.trim().toLowerCase());

  const openReallocation = (det: any) => {
    const src = findCategory(det.sourceCategoryId, det.sourceCategory);
    const dest = findCategory(det.destCategoryId, det.destCategory);
    const amount = Number(det.amount);
    // Balances are the amounts assigned to each envelope this month
    const srcBefore = Number(src?.target_amount ?? 0);
    const destBefore = Number(dest?.target_amount ?? 0);

    setActiveTransferDetails({
      sourceCategory: src?.name || det.sourceCategory,
      destCategory: dest?.name || det.destCategory,
      amount,
      sourceBefore: srcBefore,
      sourceAfter: srcBefore - amount,
      destBefore,
      destAfter: destBefore + amount,
    });
    setIsReallocationModalVisible(true);
  };

  const openProposal = (metadata: any) => {
    if (metadata?.actionType === 'reallocation' && metadata.transferDetails) {
      openReallocation(metadata.transferDetails);
    } else if (metadata?.actionType === 'budget_allocation' && metadata.budgetPlan) {
      setBudgetPlan(metadata.budgetPlan);
      setBudgetModalVisible(true);
    } else if (metadata?.actionType === 'recurring_proposal' && metadata.recurringDetails) {
      setRecurringProposal({ mode: metadata.mode, recurringDetails: metadata.recurringDetails });
      setRecurringModalVisible(true);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSessionId) return;

    const userQuery = inputText.trim();
    setInputText('');

    // Send user message to backend (the phone's date is added by useChat)
    const aiResponse = await sendMessage(activeSessionId, 'user', userQuery);

    // Refresh message list for the current session
    fetchMessages(activeSessionId);

    // Proposals are never applied automatically: the user confirms them in a modal
    const aiMetadata = parseMetadata(aiResponse?.metadata);
    if (aiMetadata.actionType === 'reallocation') {
      openProposal(aiMetadata);
    }
  };

  const announce = async (text: string) => {
    if (!activeSessionId) return;
    await sendMessage(activeSessionId, 'assistant', text);
    fetchMessages(activeSessionId);
  };

  const handleConfirmBudget = async (plan: BudgetPlan) => {
    const changes = plan.allocations.filter((a) => Math.abs(Number(a.proposedAssigned) - Number(a.currentAssigned)) >= 0.005);
    if (changes.length === 0) {
      throw new Error('This plan matches your current budget, so there is nothing to apply.');
    }

    let applied = 0;
    for (const a of changes) {
      const response = await fetch(`${API_URL}/categories/${a.categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, target_amount: Number(a.proposedAssigned), month: plan.month }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        await fetchCategories();
        throw new Error(
          (applied > 0 ? `Applied ${applied} of ${changes.length} changes before a problem occurred. ` : '') +
            (data.error || `Could not update "${a.categoryName}".`)
        );
      }
      // The server returns the envelope as saved for that month: confirm the new amount really stuck
      if (Math.abs(Number(data.target_amount) - Number(a.proposedAssigned)) >= 0.005) {
        await fetchCategories();
        throw new Error(`"${a.categoryName}" did not save the new amount. Nothing more was changed; please try again.`);
      }
      applied++;
    }
    setBudgetModalVisible(false);
    await fetchCategories();
    await announce(`✅ Your budget for ${plan.month} has been applied (${applied} envelope${applied === 1 ? '' : 's'} updated).`);
  };

  const handleConfirmRecurring = async (v: RecurringSubmission) => {
    const isUpdate = v.mode === 'update' && !!v.recurringId;
    const response = await fetch(isUpdate ? `${API_URL}/recurring/${v.recurringId}` : `${API_URL}/recurring`, {
      method: isUpdate ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        isUpdate
          ? {
              user_id: userId,
              title: v.title,
              amount: v.amount,
              frequency: v.frequency,
              account_id: v.accountId,
              ...(v.type === 'expense' ? { category_id: v.categoryId } : {}),
              next_run_date: v.nextDate,
              date: getPhoneDateString(),
            }
          : {
              user_id: userId,
              account_id: v.accountId,
              category_id: v.categoryId,
              title: v.title,
              amount: v.amount,
              type: v.type,
              frequency: v.frequency,
              next_run_date: v.nextDate,
            }
      ),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || 'Could not save this recurring payment.');
    }
    setRecurringModalVisible(false);
    await announce(
      `✅ ${isUpdate ? 'Updated' : 'Created'} recurring ${v.type} "${v.title}" ($${v.amount.toFixed(2)} ${v.frequency.toLowerCase()}, next on ${v.nextDate}).`
    );
  };

  const handleConfirmReallocation = async (details: any) => {
    try {
      const response = await fetch(`${API_URL}/categories/reallocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          today: getPhoneDateString(),
          sourceName: details.sourceCategory.trim(),
          destName: details.destCategory.trim(),
          amount: details.amount,
        }),
      });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to execute budget transfer.');
        }

        setIsReallocationModalVisible(false);

        if (activeSessionId) {
          await sendMessage(
            activeSessionId,
            'assistant',
            `✅ Successfully transferred $${details.amount.toFixed(2)} from ${details.sourceCategory} to ${details.destCategory}. Your budget envelopes have been updated.`
          );
          fetchMessages(activeSessionId);
          fetchCategories(); // Refresh local category balances
        }
      } catch (error: any) {
        setIsReallocationModalVisible(false);
        Alert.alert('Reallocation Failed', error.message || 'Could not complete the budget transfer.');
      }
    };

  const activeSession = sessions.find(s => s.id === activeSessionId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : insets.top}
      >
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setIsDrawerOpen(true)}
          style={styles.headerIconButton}
        >
          <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{activeSession?.session_name || 'Chat'}</Text>
          {/* <View style={styles.statusIndicatorRow}> */}
          {/* <View style={styles.onlineDot} /> */}
            {/* <Text style={styles.statusText}>Online</Text> */}
          {/* </View> */}
        </View>

        <TouchableOpacity
          onPress={() => setIsNewSessionModalVisible(true)}
          style={styles.headerIconButton}
        >
          <Ionicons name="add-circle-outline" size={26} color="#00D293" />
        </TouchableOpacity>
      </View>

      {/* ================= MAIN CHAT AREA ================= */}
      {isLoadingMessages && messages.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00D293" />
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.chatScroll}
          contentContainerStyle={styles.chatScrollContent}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollToLatest(true)}
        >
          {messages.map((item) => {
            const isUser = item.role === 'user';
            const metadata = parseMetadata(item.metadata);

            return (
              <View
                key={item.id}
                style={[
                  styles.messageRow,
                  isUser ? styles.userMessageRow : styles.assistantMessageRow,
                ]}
              >
                {!isUser && (
                  <View style={styles.avatar}>
                    <Ionicons name="sparkles" size={16} color="#03151E" />
                  </View>
                )}

                <View
                  style={[
                    styles.messageBubble,
                    isUser ? styles.userBubble : styles.assistantBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isUser ? styles.userMessageText : styles.assistantMessageText,
                    ]}
                  >
                    {item.content}
                  </Text>

                  {/* Action Card inside Finley's Message */}
                  {metadata?.actionType === 'reallocation' && metadata?.transferDetails && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardHeader}>
                        <Ionicons name="swap-horizontal" size={18} color="#00D293" />
                        <Text style={styles.actionCardTitle}>Pending Reallocation</Text>
                      </View>
                      <Text style={styles.actionCardDetail}>
                        {metadata.transferDetails.sourceCategory} → {metadata.transferDetails.destCategory}:{' '}
                        <Text style={styles.boldText}>${Number(metadata.transferDetails.amount).toFixed(2)}</Text>
                      </Text>
                      <TouchableOpacity style={styles.reviewButton} onPress={() => openProposal(metadata)}>
                        <Text style={styles.reviewButtonText}>Review & Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {metadata?.actionType === 'budget_allocation' && metadata?.budgetPlan && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardHeader}>
                        <Ionicons name="pie-chart-outline" size={18} color="#00D293" />
                        <Text style={styles.actionCardTitle}>
                          Proposed Monthly Budget (${Number(metadata.budgetPlan.targetIncome).toFixed(2)})
                        </Text>
                      </View>
                      <Text style={styles.actionCardDetail}>
                        {metadata.budgetPlan.allocations.length} envelopes · {metadata.budgetPlan.month}
                      </Text>
                      <TouchableOpacity style={styles.reviewButton} onPress={() => openProposal(metadata)}>
                        <Text style={styles.reviewButtonText}>Review & Apply</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {metadata?.actionType === 'recurring_proposal' && metadata?.recurringDetails && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardHeader}>
                        <Ionicons name="repeat" size={18} color="#00D293" />
                        <Text style={styles.actionCardTitle}>
                          {metadata.mode === 'update' ? 'Update Recurring' : 'Create Recurring'}
                        </Text>
                      </View>
                      <Text style={styles.actionCardDetail}>
                        {metadata.recurringDetails.title}:{' '}
                        <Text style={styles.boldText}>${Number(metadata.recurringDetails.amount).toFixed(2)}</Text>{' '}
                        {String(metadata.recurringDetails.frequency).toLowerCase()}
                      </Text>
                      <TouchableOpacity style={styles.reviewButton} onPress={() => openProposal(metadata)}>
                        <Text style={styles.reviewButtonText}>Review & Confirm</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <Text
                    style={[
                      styles.timestampText,
                      isUser ? styles.userTimestamp : styles.assistantTimestamp,
                    ]}
                  >
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* ================= INPUT FOOTER ================= */}
      <View style={[styles.inputContainer, { paddingBottom: isKeyboardVisible ? 10 : Math.max(insets.bottom, 12) }]}>
        <TextInput
          style={styles.input}
          placeholder="Ask AI to adjust budgets..."
          placeholderTextColor="#64748B"
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={handleSendMessage}
        />
        <TouchableOpacity 
          style={styles.sendButton} 
          onPress={handleSendMessage}
          disabled={isSending}
        >
          {isSending ? (
            <ActivityIndicator size="small" color="#00D293" />
          ) : (
            <Ionicons name="arrow-up-circle" size={36} color="#00D293" />
          )}
        </TouchableOpacity>
      </View>

      </KeyboardAvoidingView>

      {/* ================= SIDE DRAWER / SESSION PANEL ================= */}
      <Modal
        visible={isDrawerOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDrawerOpen(false)}
      >
        <View style={styles.drawerBackdrop}>
          <View style={styles.drawerContainer}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Chat Sessions</Text>
              <TouchableOpacity onPress={() => setIsDrawerOpen(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.newChatButton}
              onPress={() => {
                setIsDrawerOpen(false);
                setIsNewSessionModalVisible(true);
              }}
            >
              <Ionicons name="add" size={20} color="#03151E" />
              <Text style={styles.newChatButtonText}>New Conversation</Text>
            </TouchableOpacity>

            <ScrollView style={styles.sessionList}>
              {sessions.map((s) => (
                <TouchableOpacity
                  key={s.id}
                  style={[
                    styles.sessionItem,
                    s.id === activeSessionId && styles.activeSessionItem,
                  ]}
                  onPress={() => handleSelectSession(s.id)}
                >
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={s.id === activeSessionId ? '#00D293' : '#64748B'}
                  />
                  <View style={styles.sessionInfo}>
                    <Text
                      style={[
                        styles.sessionName,
                        s.id === activeSessionId && styles.activeSessionName,
                      ]}
                      numberOfLines={1}
                    >
                      {s.session_name}
                    </Text>
                    <Text style={styles.sessionTime}>
                      {new Date(s.updated_at).toLocaleDateString()}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      Alert.alert(
                        'Delete Session',
                        `Are you sure you want to delete "${s.session_name}" and all its messages?`,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              const success = await deleteSession(s.id);
                              if (success && activeSessionId === s.id) {
                                const remaining = sessions.filter(item => item.id !== s.id);
                                if (remaining.length > 0) {
                                  setActiveSessionId(remaining[0].id);
                                  fetchMessages(remaining[0].id);
                                } else {
                                  setActiveSessionId(null);
                                  setMessages([]);
                                }
                              }
                            },
                          },
                        ]
                      );
                    }}
                    style={styles.deleteSessionButton}
                  >
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= NEW SESSION POPUP ================= */}
      <Modal
        visible={isNewSessionModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsNewSessionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.popupBox}>
            <Text style={styles.popupTitle}>Create New Session</Text>
            <Text style={styles.popupSubtitle}>
              Give this conversation a topic to organize your budget queries.
            </Text>
            <TextInput
              style={styles.popupInput}
              placeholder="e.g. Vacation Planning"
              placeholderTextColor="#64748B"
              value={newSessionName}
              onChangeText={setNewSessionName}
              autoFocus
            />
            <View style={styles.popupActionsRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setIsNewSessionModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateNewSession}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= REALLOCATION MODAL ================= */}
      <ReallocationModal
        visible={isReallocationModalVisible}
        onClose={() => setIsReallocationModalVisible(false)}
        onConfirm={handleConfirmReallocation}
        details={activeTransferDetails}
      />

      {/* ================= BUDGET ALLOCATION MODAL ================= */}
      <BudgetAllocationModal
        visible={budgetModalVisible}
        plan={budgetPlan}
        onClose={() => setBudgetModalVisible(false)}
        onConfirm={handleConfirmBudget}
      />

      {/* ================= RECURRING PROPOSAL MODAL ================= */}
      <RecurringProposalModal
        visible={recurringModalVisible}
        proposal={recurringProposal}
        accounts={accounts}
        groups={groupedCategories}
        onClose={() => setRecurringModalVisible(false)}
        onConfirm={handleConfirmRecurring}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03151E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E2D3D', backgroundColor: '#0C1A25' },
  headerIconButton: { padding: 4 },
  headerTitleContainer: { alignItems: 'stretch', display: 'flex' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  statusIndicatorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00D293', marginRight: 4 },
  statusText: { fontSize: 11, color: '#64748B' },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatScroll: { flex: 1, paddingHorizontal: 16 },
  chatScrollContent: { paddingVertical: 16 },
  messageRow: { flexDirection: 'row', marginVertical: 8, alignItems: 'flex-end' },
  userMessageRow: { justifyContent: 'flex-end' },
  assistantMessageRow: { justifyContent: 'flex-start' },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#00D293', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  userBubble: { backgroundColor: '#00D293', borderBottomRightRadius: 4 },
  assistantBubble: { backgroundColor: '#0C1A25', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#1E2D3D' },
  messageText: { fontSize: 14, lineHeight: 20 },
  userMessageText: { color: '#03151E', fontWeight: '500' },
  assistantMessageText: { color: '#FFFFFF' },
  actionCard: { marginTop: 10, backgroundColor: '#03151E', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#1E2D3D' },
  actionCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  actionCardTitle: { fontSize: 13, fontWeight: '700', color: '#00D293', marginLeft: 6 },
  actionCardDetail: { fontSize: 12, color: '#64748B', marginBottom: 8 },
  boldText: { color: '#FFFFFF', fontWeight: '700' },
  reviewButton: { backgroundColor: '#00D293', borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  reviewButtonText: { color: '#03151E', fontSize: 12, fontWeight: '700' },
  timestampText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  userTimestamp: { color: '#03151E', opacity: 0.7 },
  assistantTimestamp: { color: '#64748B' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#0C1A25', borderTopWidth: 1, borderTopColor: '#1E2D3D' },
  input: { flex: 1, backgroundColor: '#03151E', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#1E2D3D', maxHeight: 100 },
  sendButton: { marginLeft: 8, justifyContent: 'center', alignItems: 'center' },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(3, 21, 30, 0.7)', justifyContent: 'flex-start' },
  drawerContainer: { width: width * 0.75, height: '100%', backgroundColor: '#0C1A25', padding: 16, borderRightWidth: 1, borderRightColor: '#1E2D3D' },
  drawerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  drawerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  newChatButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#00D293', padding: 10, borderRadius: 8, justifyContent: 'center', marginBottom: 16 },
  newChatButtonText: { color: '#03151E', fontWeight: '700', marginLeft: 6, fontSize: 14 },
  sessionList: { flex: 1 },
  sessionItem: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 8, marginBottom: 8, backgroundColor: '#03151E' },
  activeSessionItem: { backgroundColor: '#1E2D3D', borderWidth: 1, borderColor: '#00D293' },
  sessionInfo: { flex: 1, marginLeft: 10 },
  sessionName: { fontSize: 14, color: '#FFFFFF', fontWeight: '500' },
  activeSessionName: { color: '#00D293', fontWeight: '700' },
  sessionTime: { fontSize: 10, color: '#64748B', marginTop: 2 },
  deleteSessionButton: { padding: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(3, 21, 30, 0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  popupBox: { width: '100%', backgroundColor: '#0C1A25', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#1E2D3D' },
  popupTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', marginBottom: 6 },
  popupSubtitle: { fontSize: 13, color: '#64748B', marginBottom: 16 },
  popupInput: { backgroundColor: '#03151E', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#FFFFFF', fontSize: 14, borderWidth: 1, borderColor: '#1E2D3D', marginBottom: 20 },
  popupActionsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 14, marginRight: 8 },
  cancelButtonText: { color: '#64748B', fontWeight: '600' },
  confirmButton: { backgroundColor: '#00D293', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  confirmButtonText: { color: '#03151E', fontWeight: '700' },
});