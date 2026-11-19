import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export interface Session {
  id: string;
  user_id: string;
  session_name: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: any;
  created_at: string;
}

export const useChat = (userId: string | undefined) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Fetch all chat sessions for the user
  const fetchSessions = useCallback(async () => {
    if (!userId) return;
    
    setIsLoadingSessions(true);
    try {
      const response = await fetch(`${API_URL}/chat/sessions/${userId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch chat sessions');
      }

      const data = await response.json();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
      Alert.alert('Error', 'Could not load chat sessions.');
    } finally {
      setIsLoadingSessions(false);
    }
  }, [userId]);

  // Create a new chat session
  const createSession = async (sessionName: string = 'New Conversation') => {
    if (!userId) return null;

    try {
      const response = await fetch(`${API_URL}/chat/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          session_name: sessionName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create session');
      }

      const newSession = await response.json();
      setSessions(prev => [newSession, ...prev]);
      return newSession;
    } catch (error) {
      console.error('Error creating session:', error);
      Alert.alert('Error', 'Could not create a new chat session.');
      return null;
    }
  };

  // Fetch messages for a specific session
  const fetchMessages = useCallback(async (sessionId: string) => {
    if (!sessionId) return;

    setIsLoadingMessages(true);
    try {
      const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch messages');
      }

      const data = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Error fetching messages:', error);
      Alert.alert('Error', 'Could not load chat history.');
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  // Send a message 
  const sendMessage = async (sessionId: string, role: 'user' | 'assistant', content: string, metadata?: any) => {
    if (!sessionId || !content) return null;

    setIsSending(true);
    try {
      const response = await fetch(`${API_URL}/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          content,
          metadata,
        }),
      });

      const responseText = await response.text(); // Get raw text response

      if (!response.ok) {
        console.error("SERVER ERROR RESPONSE:", responseText);
        throw new Error(`Failed to send message: ${response.status} - ${responseText}`);
      }

      const savedMessage = JSON.parse(responseText);
      setMessages(prev => [...prev, savedMessage]);
      return savedMessage;
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Could not send message.');
      return null;
    } finally {
      setIsSending(false);
    }
  };

  // Delete a chat session
  const deleteSession = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_URL}/chat/sessions/${sessionId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete session');
      }

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      Alert.alert('Error', 'Could not delete chat session.');
      return false;
    }
  };

  return {
    sessions,
    messages,
    isLoadingSessions,
    isLoadingMessages,
    isSending,
    fetchSessions,
    createSession,
    deleteSession,
    fetchMessages,
    sendMessage,
    setMessages,
  };
};