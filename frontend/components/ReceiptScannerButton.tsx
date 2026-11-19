import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { getPhoneDateString } from '@/utils/month';
import { API_URL as FALLBACK_API_URL } from '@/constants/api';
import type { TransactionDraft } from '@/components/AddTransactionModal';

const API_URL = process.env.EXPO_PUBLIC_API_URL || FALLBACK_API_URL;

interface Props {
  userId: string | undefined;
  /** Called with the scanned draft; the caller opens the review sheet. Nothing is saved here. */
  onDraft: (draft: TransactionDraft) => void;
  /** Called with a clean, user-facing message when scanning fails */
  onError: (message: string) => void;
  /** Called when a new scan starts, so the caller can clear an old error */
  onScanStart?: () => void;
}

const SCAN_FAILED = "We couldn't read that receipt. Please try again with a clearer photo.";

export default function ReceiptScannerButton({ userId, onDraft, onError, onScanStart }: Props) {
  const [isScanning, setIsScanning] = useState(false);

  const handleImageSelected = async (asset: ImagePicker.ImagePickerAsset) => {
    if (!userId) return onError('You must be signed in to scan a receipt.');
    if (!asset.base64) return onError(SCAN_FAILED);

    setIsScanning(true);
    onScanStart?.();
    try {
      const response = await fetch(`${API_URL}/receipts/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          image: asset.base64,
          mimeType: asset.mimeType || 'image/jpeg',
          user_id: userId,
          today: getPhoneDateString(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(typeof data?.error === 'string' && data.error.length < 140 ? data.error : SCAN_FAILED);
      }

      const draft = await response.json();
      onDraft({
        title: draft.title ?? null,
        amount: draft.amount ?? null,
        account_id: draft.account_id ?? null,
        category_id: draft.category_id ?? null,
        transaction_date: draft.transaction_date || getPhoneDateString(),
        uncertain_fields: Array.isArray(draft.uncertain_fields) ? draft.uncertain_fields : [],
        fromReceipt: true,
      });
    } catch (error) {
      console.error('Scan error:', error);
      onError(error instanceof Error && error.message ? error.message : SCAN_FAILED);
    } finally {
      setIsScanning(false);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera access is required to scan receipts.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library access is required.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (!result.canceled && result.assets[0]) handleImageSelected(result.assets[0]);
  };

  const promptOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Take Photo', 'Choose from Library'], cancelButtonIndex: 0 },
        (i) => {
          if (i === 1) openCamera();
          if (i === 2) openGallery();
        }
      );
    } else {
      Alert.alert('Scan Receipt', 'Choose receipt source', [
        { text: 'Camera', onPress: openCamera },
        { text: 'Gallery', onPress: openGallery },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <TouchableOpacity style={[styles.scanBtn, isScanning && styles.disabled]} onPress={promptOptions} disabled={isScanning}>
      {isScanning ? (
        <>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.scanBtnText}>Scanning…</Text>
        </>
      ) : (
        <>
          <Ionicons name="scan-outline" size={14} color="#38BDF8" />
          <Text style={styles.scanBtnText}>Scan</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121E2C',
    borderWidth: 1,
    borderColor: '#1E2D3D',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    gap: 6,
  },
  disabled: { opacity: 0.7 },
  scanBtnText: { color: '#38BDF8', fontSize: 12, fontWeight: '700' },
});
