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
import { useRouter } from 'expo-router';
import { COLORS } from '@/constants/colors';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

export default function ReceiptScannerButton() {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  const handleImageSelected = async (asset: ImagePicker.ImagePickerAsset) => {
    try {
      setIsScanning(true);

      const formData = new FormData();
      formData.append('receipt', {
        uri: asset.uri,
        name: 'receipt.jpg',
        type: 'image/jpeg',
      } as any);

      const response = await fetch(`${API_URL}/receipts/scan`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to process receipt');
      }

      const extracted = await response.json();
      // Returns: { title, amount, date, suggestedCategory }

      // Route directly to CreateScreen with pre-filled query params
      router.push({
        pathname: '/home/create',
        params: {
          scannedTitle: extracted.title || '',
          scannedAmount: extracted.amount ? String(extracted.amount) : '',
          scannedDate: extracted.date || '',
          scannedCategory: extracted.suggestedCategory || '',
        },
      });
    } catch (error: any) {
      console.error('Scan error:', error);
      Alert.alert('Scan Failed', error.message || 'Could not parse receipt.');
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

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0]);
    }
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Photo library access is required.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      handleImageSelected(result.assets[0]);
    }
  };

  const promptOptions = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) openCamera();
          if (buttonIndex === 2) openGallery();
        }
      );
    } else {
      Alert.alert(
        'Upload Receipt',
        'Choose receipt source',
        [
          { text: 'Camera', onPress: openCamera },
          { text: 'Gallery', onPress: openGallery },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  return (
    <TouchableOpacity
      style={styles.scanBtn}
      onPress={promptOptions}
      disabled={isScanning}
    >
      {isScanning ? (
        <ActivityIndicator size="small" color="#FFF" />
      ) : (
        <>
          <Ionicons name="scan-outline" size={18} color="#FFF" />
          <Text style={styles.scanBtnText}>Scan Receipt</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#059669', // Distinct green action
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
  },
  scanBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
});