import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/expo";

import { useCategories } from "../../../hooks/useCategories";
import { useAccounts } from "../../../hooks/useAccounts";

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface ReceiptItem {
  name: string;
  price: number;
}

interface ParsedReceipt {
  title: string;
  amount: number;
  date: string;
  suggestedCategory: string;
  items: ReceiptItem[];
}

export default function ScanOCRIndexScreen() {
  const router = useRouter();
  const { user } = useUser();

  const { categories, fetchCategories, isLoading: isCategoriesLoading } = useCategories(user?.id);
  const { accounts, fetchAccounts, isLoading: isAccountsLoading } = useAccounts(user?.id);

  const [selectedImage, setSelectedImage] = useState<{
    uri: string;
    base64?: string | null;
    mimeType?: string | null;
  } | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Review Modal Form State
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [date, setDate] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [items, setItems] = useState<ReceiptItem[]>([]);

  // Dropdown overlay states
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchCategories();
      fetchAccounts();
    }
  }, [user?.id, fetchCategories, fetchAccounts]);

  const handleImagePicked = (asset: ImagePicker.ImagePickerAsset) => {
    setSelectedImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType || "image/jpeg",
    });
  };

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 0.5,
    base64: true,
    allowsEditing: false,
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Camera access is required.");
      return;
    }
    const res = await ImagePicker.launchCameraAsync(pickerOptions);
    if (!res.canceled && res.assets && res.assets.length > 0) {
      handleImagePicked(res.assets[0]);
    }
  };

  const handleImageUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Denied", "Photo library access is required.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync(pickerOptions);
    if (!res.canceled && res.assets && res.assets.length > 0) {
      handleImagePicked(res.assets[0]);
    }
  };

  const processReceiptWithGemini = async () => {
    if (!selectedImage?.base64) {
      Alert.alert("Error", "Please take or upload a receipt photo first.");
      return;
    }

    setAnalyzing(true);
    try {
      const categoryNames = categories.map((c) => c.name).filter(Boolean);

      const response = await fetch(`${API_URL}/receipts/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          image: selectedImage.base64,
          mimeType: selectedImage.mimeType || "image/jpeg",
          categories: categoryNames,
        }),
      });

      const rawText = await response.text();
      let data: ParsedReceipt;

      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(`Server returned non-JSON [${response.status}]: ${rawText.slice(0, 100)}`);
      }

      if (!response.ok) {
        throw new Error((data as any).error || `Scan failed with status ${response.status}`);
      }

      setTitle(data.title || "Scanned Receipt");
      setAmount(data.amount ? String(data.amount) : "0.00");
      setDate(data.date || new Date().toISOString().split("T")[0]);
      setItems(Array.isArray(data.items) ? data.items : []);

      const matchedCategory = categories.find(
        (c) => c.name.toLowerCase() === (data.suggestedCategory || "").toLowerCase()
      );
      setSelectedCategoryId(matchedCategory ? matchedCategory.id : categories[0]?.id || "");
      setSelectedAccountId(accounts[0]?.id || "");

      setModalVisible(true);
    } catch (err: any) {
      console.error("Gemini Scan Error:", err);
      Alert.alert("Scan Failed", err.message || "An unexpected error occurred during OCR analysis.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleItemChange = (index: number, field: "name" | "price", val: string) => {
    const updated = [...items];
    if (field === "price") {
      const parsed = parseFloat(val) || 0;
      updated[index] = { ...updated[index], price: parsed };
      const newTotal = updated.reduce((acc, curr) => acc + curr.price, 0);
      setAmount(newTotal.toFixed(2));
    } else {
      updated[index] = { ...updated[index], name: val };
    }
    setItems(updated);
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
    const newTotal = updated.reduce((acc, curr) => acc + curr.price, 0);
    setAmount(newTotal.toFixed(2));
  };

  const addItem = () => {
    setItems([...items, { name: "New Item", price: 0.0 }]);
  };

  const handleSaveTransaction = async () => {
    if (!title.trim()) return Alert.alert("Error", "Please enter a transaction title");
    const parsedAmount = Math.abs(parseFloat(amount));
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      return Alert.alert("Error", "Please enter a valid amount");
    }
    if (!selectedAccountId) return Alert.alert("Error", "Please select an account");
    if (!selectedCategoryId) return Alert.alert("Error", "Please select a category");

    setIsSubmitting(true);
    try {
      const currentDate = date ? new Date(date).toISOString() : new Date().toISOString();

      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user?.id,
          account_id: selectedAccountId,
          category_id: selectedCategoryId,
          title: title.trim(),
          amount: parsedAmount,
          type: "expense",
          transaction_date: currentDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create transaction");
      }

      Alert.alert("Success", "Transaction created from receipt successfully!", [
        {
          text: "OK",
          onPress: () => {
            setModalVisible(false);
            setSelectedImage(null);
            router.back();
          },
        },
      ]);
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  const activeCategoryName =
    categories.find((c) => c.id === selectedCategoryId)?.name || "Select Category";
  const activeAccountName =
    accounts.find((a) => a.id === selectedAccountId)?.name || "Select Account";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.subHeading}>AI RECEIPT SCANNER</Text>
          <Text style={styles.mainHeading}>Scan & Categorize</Text>
        </View>

        {/* Scan & Preview Card */}
        <View style={styles.scanCard}>
          {selectedImage ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity style={styles.clearBadge} onPress={() => setSelectedImage(null)}>
                <Ionicons name="close-circle" size={24} color="#FF6B6B" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraIconContainer}>
              <Ionicons name="receipt-outline" size={36} color="#00D293" />
            </View>
          )}

          <Text style={styles.cardTitle}>
            {selectedImage ? "Receipt Ready" : "Scan or Upload Receipt"}
          </Text>
          <Text style={styles.cardDescription}>
            Extract items with Gemini 3.6 Flash, match budget envelopes, and create transactions instantly.
          </Text>

          {analyzing ? (
            <View style={styles.loaderContainer}>
              <ActivityIndicator size="large" color="#00D293" />
              <Text style={styles.loaderText}>Extracting receipt data with Gemini...</Text>
            </View>
          ) : (
            <View style={styles.actionColumn}>
              {selectedImage && (
                <TouchableOpacity style={styles.analyzeButton} onPress={processReceiptWithGemini}>
                  <Ionicons name="sparkles" size={18} color="#03151E" />
                  <Text style={styles.analyzeButtonText}>Analyze with Gemini</Text>
                </TouchableOpacity>
              )}

              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.primaryButton} onPress={handleCamera}>
                  <Ionicons name="camera-outline" size={18} color="#03151E" />
                  <Text style={styles.primaryButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleImageUpload}>
                  <Ionicons name="arrow-up-outline" size={18} color="#00D293" />
                  <Text style={styles.secondaryButtonText}>Upload</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Review & Edit Transaction Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Verify Transaction</Text>
                <Text style={styles.modalSub}>Confirm details before creating transaction</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={22} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>TRANSACTION TITLE / MERCHANT</Text>
              <TextInput
                style={styles.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Merchant name"
                placeholderTextColor="#64748B"
              />

              <View style={styles.rowInputs}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>AMOUNT ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={amount}
                    keyboardType="numeric"
                    onChangeText={setAmount}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>DATE</Text>
                  <TextInput style={styles.input} value={date} onChangeText={setDate} />
                </View>
              </View>

              <Text style={styles.inputLabel}>CATEGORY</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => {
                  fetchCategories();
                  setCategoryDropdownOpen(true);
                }}
              >
                <View style={styles.dropdownValueRow}>
                  <Ionicons name="pricetag-outline" size={16} color="#00D293" />
                  <Text style={styles.dropdownSelectorText}>{activeCategoryName}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <Text style={styles.inputLabel}>DEDUCT FROM ACCOUNT</Text>
              <TouchableOpacity
                style={styles.dropdownSelector}
                onPress={() => {
                  fetchAccounts();
                  setAccountDropdownOpen(true);
                }}
              >
                <View style={styles.dropdownValueRow}>
                  <Ionicons name="card-outline" size={16} color="#00D293" />
                  <Text style={styles.dropdownSelectorText}>{activeAccountName}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
              </TouchableOpacity>

              <View style={styles.itemsHeaderRow}>
                <Text style={styles.inputLabel}>PARSED RECEIPT ITEMS ({items.length})</Text>
                <TouchableOpacity onPress={addItem}>
                  <Text style={styles.addItemText}>+ Add Item</Text>
                </TouchableOpacity>
              </View>

              {items.map((item, idx) => (
                <View key={idx} style={styles.itemEditRow}>
                  <TextInput
                    style={[styles.input, { flex: 2, marginBottom: 0 }]}
                    value={item.name}
                    onChangeText={(txt) => handleItemChange(idx, "name", txt)}
                  />
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    value={String(item.price)}
                    keyboardType="numeric"
                    onChangeText={(txt) => handleItemChange(idx, "price", txt)}
                  />
                  <TouchableOpacity onPress={() => removeItem(idx)} style={styles.deleteBtn}>
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalVisible(false)}
                disabled={isSubmitting}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
                onPress={handleSaveTransaction}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#03151E" />
                ) : (
                  <Text style={styles.confirmButtonText}>Save Transaction</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Dropdown Modal */}
      <Modal visible={categoryDropdownOpen} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Category</Text>
            {isCategoriesLoading ? (
              <ActivityIndicator size="small" color="#00D293" style={{ paddingVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.pickerItem,
                      selectedCategoryId === cat.id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(cat.id);
                      setCategoryDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedCategoryId === cat.id && styles.pickerItemTextActive,
                      ]}
                    >
                      {cat.name}
                    </Text>
                    {selectedCategoryId === cat.id && (
                      <Ionicons name="checkmark" size={18} color="#00D293" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setCategoryDropdownOpen(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Account Dropdown Modal */}
      <Modal visible={accountDropdownOpen} transparent animationType="fade">
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Account</Text>
            {isAccountsLoading ? (
              <ActivityIndicator size="small" color="#00D293" style={{ paddingVertical: 20 }} />
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {accounts.map((acc) => (
                  <TouchableOpacity
                    key={acc.id}
                    style={[
                      styles.pickerItem,
                      selectedAccountId === acc.id && styles.pickerItemActive,
                    ]}
                    onPress={() => {
                      setSelectedAccountId(acc.id);
                      setAccountDropdownOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedAccountId === acc.id && styles.pickerItemTextActive,
                      ]}
                    >
                      {acc.name}
                    </Text>
                    {selectedAccountId === acc.id && (
                      <Ionicons name="checkmark" size={18} color="#00D293" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <TouchableOpacity
              style={styles.pickerCloseBtn}
              onPress={() => setAccountDropdownOpen(false)}
            >
              <Text style={styles.pickerCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#070D14" },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 12 : 54,
    paddingBottom: 40,
  },
  headerSection: { marginBottom: 24 },
  subHeading: { color: "#00D293", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginBottom: 4 },
  mainHeading: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  scanCard: {
    backgroundColor: "#0C1521",
    borderColor: "#192839",
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  cameraIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: "#0F262B",
    borderColor: "#174747",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  previewContainer: { position: "relative", alignItems: "center", marginBottom: 16 },
  previewImage: { width: 180, height: 240, borderRadius: 16, borderWidth: 1, borderColor: "#1E3A3A" },
  clearBadge: { position: "absolute", top: -8, right: -8, backgroundColor: "#070D14", borderRadius: 12 },
  cardTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginBottom: 8 },
  cardDescription: { color: "#8295AB", fontSize: 13, textAlign: "center", lineHeight: 19, paddingHorizontal: 10, marginBottom: 20 },
  actionColumn: { width: "100%", gap: 10 },
  actionRow: { flexDirection: "row", gap: 12, width: "100%" },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00D293",
    borderRadius: 14,
    paddingVertical: 14,
  },
  analyzeButtonText: { color: "#03151E", fontSize: 15, fontWeight: "700" },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#00D293",
    borderRadius: 14,
    paddingVertical: 14,
  },
  primaryButtonText: { color: "#03151E", fontSize: 14, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#121E2C",
    borderColor: "#1F344B",
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
  },
  secondaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  loaderContainer: { paddingVertical: 16, alignItems: "center", gap: 8 },
  loaderText: { color: "#94A3B8", fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#0C1521",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: "#1E2D3D",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  modalTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "700" },
  modalSub: { color: "#64748B", fontSize: 12, marginTop: 2 },
  inputLabel: { color: "#64748B", fontSize: 11, fontWeight: "700", marginBottom: 6 },
  input: {
    backgroundColor: "#121E2C",
    borderColor: "#1E2D3D",
    borderWidth: 1,
    borderRadius: 10,
    color: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    fontSize: 14,
  },
  dropdownSelector: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#121E2C",
    borderColor: "#1E2D3D",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 14,
  },
  dropdownValueRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dropdownSelectorText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  rowInputs: { flexDirection: "row", gap: 12 },
  itemsHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  addItemText: { color: "#00D293", fontSize: 12, fontWeight: "600" },
  itemEditRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 8 },
  deleteBtn: { padding: 8 },
  modalActionRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#1E2D3D",
  },
  cancelButtonText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
  confirmButton: {
    flex: 2,
    backgroundColor: "#00D293",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  confirmButtonDisabled: { opacity: 0.6 },
  confirmButtonText: { color: "#03151E", fontSize: 14, fontWeight: "700" },
  pickerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerContainer: {
    width: "100%",
    backgroundColor: "#0C1521",
    borderColor: "#1E2D3D",
    borderWidth: 1,
    borderRadius: 20,
    padding: 18,
  },
  pickerTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700", marginBottom: 14 },
  pickerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#142131",
  },
  pickerItemActive: { backgroundColor: "#10202F", borderRadius: 8 },
  pickerItemText: { color: "#94A3B8", fontSize: 14 },
  pickerItemTextActive: { color: "#00D293", fontWeight: "700" },
  pickerCloseBtn: { marginTop: 14, alignItems: "center", paddingVertical: 8 },
  pickerCloseText: { color: "#94A3B8", fontSize: 14, fontWeight: "600" },
});