import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from '@clerk/expo';
import { useChat } from '../../../hooks/useChat';
import { useSavings } from '../../../hooks/useSavings';
import { useCategories } from '../../../hooks/useCategories';
import ReallocationModal from '../../../components/chat/ReallocationModal';

const { width } = Dimensions.get('window');

export default function ChatScreen() {
  const { user } = useUser();
  const userId = user?.id;

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

  const { savingsPlans, fetchSavings } = useSavings(userId);
  const { categories, fetchCategories } = useCategories(userId);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const [isNewSessionModalVisible, setIsNewSessionModalVisible] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const [isReallocationModalVisible, setIsReallocationModalVisible] = useState(false);
  const [activeTransferDetails, setActiveTransferDetails] = useState({
    sourceCategory: '',
    destCategory: '',
    amount: 0,
    sourceBefore: 100.0,
    sourceAfter: 50.0,
    destBefore: 20.0,
    destAfter: 70.0,
  });

  const [inputText, setInputText] = useState('');
  const API_URL = process.env.EXPO_PUBLIC_API_URL;

  // Initial load
  useEffect(() => {
    if (userId) {
      fetchSessions();
      fetchSavings();
      fetchCategories(); // Load categories on mount
    }
  }, [userId, fetchSessions, fetchSavings, fetchCategories]);

  // Set default active session once sessions load
  useEffect(() => {
    if (sessions.length > 0 && !activeSessionId) {
      setActiveSessionId(sessions[0].id);
      fetchMessages(sessions[0].id);
    }
  }, [sessions, activeSessionId, fetchMessages]);

  const handleSelectSession = (sessionId: string) => {
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

  const handleSendMessage = async () => {
    if (!inputText.trim() || !activeSessionId) return;

    const userQuery = inputText.trim();
    setInputText('');

    // Send user message to backend 
    const aiResponse = await sendMessage(activeSessionId, 'user', userQuery);

    // Refresh message list for the current session
    fetchMessages(activeSessionId);

    // Check if Gemini detected a reallocation intent requiring modal confirmation
    if (aiResponse?.metadata?.actionType === 'reallocation') {
      const details = aiResponse.metadata.transferDetails;
      const srcPlan = savingsPlans.find(p => p.name.toLowerCase() === details.sourceCategory.toLowerCase());
      const destPlan = savingsPlans.find(p => p.name.toLowerCase() === details.destCategory.toLowerCase());

      setActiveTransferDetails({
        sourceCategory: details.sourceCategory,
        destCategory: details.destCategory,
        amount: details.amount,
        sourceBefore: srcPlan?.saved_amount || 100.0,
        sourceAfter: (srcPlan?.saved_amount || 100.0) - details.amount,
        destBefore: destPlan?.saved_amount || 20.0,
        destAfter: (destPlan?.saved_amount || 20.0) + details.amount,
      });
      setIsReallocationModalVisible(true);
    }
  };

  const handleConfirmReallocation = async (details: any) => {
    try {
      const response = await fetch(`${API_URL}/categories/reallocate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
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
    <SafeAreaView style={styles.container}>
      {/* ================= HEADER ================= */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => setIsDrawerOpen(true)}
          style={styles.headerIconButton}
        >
          <Ionicons name="menu-outline" size={26} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{activeSession?.session_name || 'Finley AI Chat'}</Text>
          <View style={styles.statusIndicatorRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Online</Text>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => setIsNewSessionModalVisible(true)}
          style={styles.headerIconButton}
        >
          <Ionicons name="add-circle-outline" size={26} color="#00D293" />
        </TouchableOpacity>
      </View>

      {/* ================= MAIN CHAT AREA ================= */}
      {isLoadingMessages ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#00D293" />
        </View>
      ) : (
        <ScrollView
          style={styles.chatScroll}
          contentContainerStyle={styles.chatScrollContent}
        >
          {messages.map((item) => {
            const isUser = item.role === 'user';
            const hasAction = item.metadata?.actionType === 'reallocation';

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
                  {hasAction && item.metadata?.transferDetails && (
                    <View style={styles.actionCard}>
                      <View style={styles.actionCardHeader}>
                        <Ionicons name="swap-horizontal" size={18} color="#00D293" />
                        <Text style={styles.actionCardTitle}>Pending Reallocation</Text>
                      </View>
                      <Text style={styles.actionCardDetail}>
                        {item.metadata.transferDetails.sourceCategory} → {item.metadata.transferDetails.destCategory}:{' '}
                        <Text style={styles.boldText}>${item.metadata.transferDetails.amount.toFixed(2)}</Text>
                      </Text>

                      <TouchableOpacity
                        style={styles.reviewButton}
                        onPress={() => {
                          const det = item.metadata.transferDetails;
                          
                          // Find actual matching categories from user's state/budgets safely
                          const cleanName = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                          const srcCat = categories.find(c => cleanName(c.name).includes(cleanName(det.sourceCategory)));
                          const destCat = categories.find(c => cleanName(c.name).includes(cleanName(det.destCategory)));

                          const srcBefore = Number(srcCat?.current_amount || 100.0);
                          const destBefore = Number(destCat?.current_amount || 0.0);
                          const transferAmount = Number(det.amount);

                          setActiveTransferDetails({
                            sourceCategory: det.sourceCategory,
                            destCategory: det.destCategory,
                            amount: transferAmount,
                            sourceBefore: srcBefore,
                            sourceAfter: srcBefore - transferAmount,
                            destBefore: destBefore,
                            destAfter: destBefore + transferAmount,
                          });
                          setIsReallocationModalVisible(true);
                        }}
                      >
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
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask Finley to adjust budgets..."
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#03151E' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E2D3D', backgroundColor: '#0C1A25' },
  headerIconButton: { padding: 4 },
  headerTitleContainer: { alignItems: 'center' },
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