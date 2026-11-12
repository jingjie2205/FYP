import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  actionRequired?: boolean;
  actionCompleted?: boolean;
}

interface Session {
  id: string;
  name: string;
  updatedAt: string;
}

export default function ChatScreen() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([
    { id: '1', name: 'Budget Reallocation', updatedAt: 'Just now' },
    { id: '2', name: 'Monthly Expense Review', updatedAt: 'Yesterday' },
    { id: '3', name: 'Savings Goal Planning', updatedAt: 'Oct 14' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');

  const [isNewSessionModalVisible, setIsNewSessionModalVisible] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  const [isReallocationModalVisible, setIsReallocationModalVisible] = useState(false);
  const [reallocationDetails] = useState({
    sourceCategory: 'Entertainment',
    destCategory: 'Groceries',
    amount: 50.0,
    sourceBefore: 120.0,
    sourceAfter: 70.0,
    destBefore: 35.0,
    destAfter: 85.0,
  });

  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'm1',
      sender: 'user',
      text: 'Can you reallocate $50 from my Entertainment budget to Groceries?',
      timestamp: '10:42 AM',
    },
    {
      id: 'm2',
      sender: 'assistant',
      text: "I've prepared the transfer for you. Moving $50.00 will reduce your Entertainment envelope to $70.00 and increase Groceries to $85.00.\n\nPlease review and confirm the reallocation below:",
      timestamp: '10:42 AM',
      actionRequired: true,
      actionCompleted: false,
    },
  ]);

  const [inputText, setInputText] = useState('');

  const handleConfirmReallocation = () => {
    setIsReallocationModalVisible(false);
    setMessages((prev) =>
      prev.map((m) =>
        m.actionRequired ? { ...m, actionRequired: false, actionCompleted: true } : m
      )
    );
    setMessages((prev) => [
      ...prev,
      {
        id: `m-${Date.now()}`,
        sender: 'assistant',
        text: '✅ Successfully transferred $50.00 from Entertainment to Groceries. Your budget envelopes have been updated.',
        timestamp: '10:43 AM',
      },
    ]);
  };

  const handleCreateSession = () => {
    if (!newSessionName.trim()) return;
    const newSession: Session = {
      id: Date.now().toString(),
      name: newSessionName.trim(),
      updatedAt: 'Just now',
    };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setNewSessionName('');
    setIsNewSessionModalVisible(false);
    setIsDrawerOpen(false);
    setMessages([
      {
        id: 'welcome',
        sender: 'assistant',
        text: "Hi, I'm Finley! How can I assist with your envelope budget today?",
        timestamp: 'Just now',
      },
    ]);
  };

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
          <Text style={styles.headerTitle}>Budget Reallocation</Text>
          <View style={styles.statusIndicatorRow}>
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
      <ScrollView
        style={styles.chatScroll}
        contentContainerStyle={styles.chatScrollContent}
      >
        {messages.map((item) => (
          <View
            key={item.id}
            style={[
              styles.messageRow,
              item.sender === 'user' ? styles.userMessageRow : styles.assistantMessageRow,
            ]}
          >
            {item.sender === 'assistant' && (
              <View style={styles.avatar}>
                <Ionicons name="sparkles" size={16} color="#03151E" />
              </View>
            )}

            <View
              style={[
                styles.messageBubble,
                item.sender === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  item.sender === 'user'
                    ? styles.userMessageText
                    : styles.assistantMessageText,
                ]}
              >
                {item.text}
              </Text>

              {/* Action Card inside Finley's Message */}
              {item.actionRequired && (
                <View style={styles.actionCard}>
                  <View style={styles.actionCardHeader}>
                    <Ionicons name="swap-horizontal" size={18} color="#00D293" />
                    <Text style={styles.actionCardTitle}>Pending Reallocation</Text>
                  </View>
                  <Text style={styles.actionCardDetail}>
                    Entertainment → Groceries: <Text style={styles.boldText}>$50.00</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.reviewButton}
                    onPress={() => setIsReallocationModalVisible(true)}
                  >
                    <Text style={styles.reviewButtonText}>Review & Confirm</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Action Completed Tag */}
              {item.actionCompleted && (
                <View style={styles.completedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#00D293" />
                  <Text style={styles.completedBadgeText}>Transfer Confirmed</Text>
                </View>
              )}

              <Text
                style={[
                  styles.timestampText,
                  item.sender === 'user' ? styles.userTimestamp : styles.assistantTimestamp,
                ]}
              >
                {item.timestamp}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* ================= INPUT FOOTER ================= */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Ask Finley to adjust budgets..."
          placeholderTextColor="#64748B"
          value={inputText}
          onChangeText={setInputText}
        />
        <TouchableOpacity style={styles.sendButton}>
          <Ionicons name="arrow-up-circle" size={36} color="#00D293" />
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
                  onPress={() => {
                    setActiveSessionId(s.id);
                    setIsDrawerOpen(false);
                  }}
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
                      {s.name}
                    </Text>
                    <Text style={styles.sessionTime}>{s.updatedAt}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 1: NEW SESSION POPUP ================= */}
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
                onPress={handleCreateSession}
              >
                <Text style={styles.confirmButtonText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= MODAL 2: REALLOCATION TRANSACTION MODAL ================= */}
      <Modal
        visible={isReallocationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsReallocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.reallocationModalCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="swap-horizontal-outline" size={22} color="#00D293" />
                <Text style={styles.modalHeaderTitle}>Confirm Transfer</Text>
              </View>
              <TouchableOpacity onPress={() => setIsReallocationModalVisible(false)}>
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <Text style={styles.reallocationPrompt}>
              Finley has calculated the adjustments. Verify the balances before writing this transaction to the ledger:
            </Text>

            {/* Source Envelope */}
            <View style={styles.envelopeCard}>
              <View style={styles.envelopeCardTop}>
                <Text style={styles.envelopeRole}>FROM</Text>
                <Text style={styles.envelopeName}>{reallocationDetails.sourceCategory}</Text>
              </View>
              <View style={styles.balanceDiffRow}>
                <Text style={styles.oldBalance}>
                  Current: ${reallocationDetails.sourceBefore.toFixed(2)}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#64748B" />
                <Text style={styles.newBalanceDeduction}>
                  After: ${reallocationDetails.sourceAfter.toFixed(2)} (-$50.00)
                </Text>
              </View>
            </View>

            {/* Destination Envelope */}
            <View style={styles.envelopeCard}>
              <View style={styles.envelopeCardTop}>
                <Text style={styles.envelopeRole}>TO</Text>
                <Text style={styles.envelopeName}>{reallocationDetails.destCategory}</Text>
              </View>
              <View style={styles.balanceDiffRow}>
                <Text style={styles.oldBalance}>
                  Current: ${reallocationDetails.destBefore.toFixed(2)}
                </Text>
                <Ionicons name="arrow-forward" size={14} color="#64748B" />
                <Text style={styles.newBalanceAddition}>
                  After: ${reallocationDetails.destAfter.toFixed(2)} (+$50.00)
                </Text>
              </View>
            </View>

            {/* Total Transfer Pill */}
            <View style={styles.totalPill}>
              <Text style={styles.totalPillLabel}>Transfer Amount</Text>
              <Text style={styles.totalPillAmount}>${reallocationDetails.amount.toFixed(2)}</Text>
            </View>

            {/* Confirmation Buttons */}
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setIsReallocationModalVisible(false)}
              >
                <Text style={styles.modalCancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleConfirmReallocation}
              >
                <Text style={styles.modalConfirmButtonText}>Confirm & Reallocate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#03151E',
  },
  header: {
    height: 60,
    backgroundColor: '#03151E',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E2D3D',
  },
  headerIconButton: {
    padding: 6,
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  statusIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00D293',
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    color: '#64748B',
  },
  chatScroll: {
    flex: 1,
  },
  chatScrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  userMessageRow: {
    justifyContent: 'flex-end',
  },
  assistantMessageRow: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#00D293',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginTop: 2,
  },
  messageBubble: {
    maxWidth: '82%',
    borderRadius: 16,
    padding: 14,
  },
  userBubble: {
    backgroundColor: '#00D293',
    borderTopRightRadius: 2,
  },
  assistantBubble: {
    backgroundColor: '#0C1A25',
    borderTopLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  messageText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  userMessageText: {
    color: '#03151E',
  },
  assistantMessageText: {
    color: '#FFFFFF',
  },
  timestampText: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  userTimestamp: {
    color: '#03151E',
    opacity: 0.7,
  },
  assistantTimestamp: {
    color: '#64748B',
  },
  actionCard: {
    marginTop: 12,
    backgroundColor: '#03151E',
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#00D293',
  },
  actionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  actionCardDetail: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 10,
  },
  boldText: {
    fontWeight: '700',
    color: '#FFFFFF',
  },
  reviewButton: {
    backgroundColor: '#00D293',
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  reviewButtonText: {
    color: '#03151E',
    fontWeight: '700',
    fontSize: 12.5,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0, 210, 147, 0.1)',
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(0, 210, 147, 0.2)',
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D293',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#03151E',
    borderTopWidth: 1,
    borderTopColor: '#1E2D3D',
  },
  input: {
    flex: 1,
    height: 42,
    backgroundColor: '#0C1A25',
    borderRadius: 21,
    paddingHorizontal: 16,
    fontSize: 14,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  sendButton: {
    marginLeft: 10,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3, 21, 30, 0.6)',
    flexDirection: 'row',
  },
  drawerContainer: {
    width: width * 0.78,
    backgroundColor: '#03151E',
    height: '100%',
    padding: 18,
    borderRightWidth: 1,
    borderRightColor: '#1E2D3D',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00D293',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 16,
    justifyContent: 'center',
  },
  newChatButtonText: {
    color: '#03151E',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 6,
  },
  sessionList: {
    flex: 1,
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 8,
    marginBottom: 6,
  },
  activeSessionItem: {
    backgroundColor: '#0C1A25',
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  sessionInfo: {
    marginLeft: 10,
    flex: 1,
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  activeSessionName: {
    color: '#00D293',
    fontWeight: '600',
  },
  sessionTime: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 21, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  popupBox: {
    width: '100%',
    backgroundColor: '#0C1A25',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  popupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  popupSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 14,
  },
  popupInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    backgroundColor: '#03151E',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    color: '#FFFFFF',
    marginBottom: 18,
  },
  popupActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#00D293',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  confirmButtonText: {
    color: '#03151E',
    fontSize: 14,
    fontWeight: '700',
  },
  reallocationModalCard: {
    width: '100%',
    backgroundColor: '#0C1A25',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 6,
  },
  reallocationPrompt: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 18,
  },
  envelopeCard: {
    backgroundColor: '#03151E',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
  },
  envelopeCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  envelopeRole: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  envelopeName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  balanceDiffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  oldBalance: {
    fontSize: 12,
    color: '#64748B',
  },
  newBalanceDeduction: {
    fontSize: 12,
    fontWeight: '600',
    color: '#EF4444', 
  },
  newBalanceAddition: {
    fontSize: 12,
    fontWeight: '600',
    color: '#00D293',
  },
  totalPill: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#03151E',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 18,
  },
  totalPillLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  totalPillAmount: {
    fontSize: 15,
    fontWeight: '800',
    color: '#00D293',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    backgroundColor: '#03151E',
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  modalCancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1.5,
    backgroundColor: '#00D293',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 8,
  },
  modalConfirmButtonText: {
    color: '#03151E',
    fontSize: 14,
    fontWeight: '700',
  },
});