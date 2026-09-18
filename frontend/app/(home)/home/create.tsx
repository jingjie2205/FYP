import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/expo";
import { useState, useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";

import { API_URL } from "@/constants/api";
import { useCategories } from "../../../hooks/useCategories"; 
import { useAccounts } from "../../../hooks/useAccounts";

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();

  const { categories, fetchCategories, isLoading: isCategoriesLoading } = useCategories(user?.id);
  const { accounts, fetchAccounts, isLoading: isAccountsLoading } = useAccounts(user?.id); 

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAccount, setSelectedAccount] = useState("");
  const [isExpense, setIsExpense] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchCategories();
      fetchAccounts(); 
    }
  }, [user?.id, fetchCategories, fetchAccounts]);

  const handleCreateTransaction = async () => {
    if (!title.trim()) return Alert.alert("Error", "Please enter a transaction title");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return Alert.alert("Error", "Please enter a valid amount");
    }
    if (!selectedAccount) return Alert.alert("Error", "Please select an account");
    if (!selectedCategory) return Alert.alert("Error", "Please select a category");

    setIsLoading(true);
    try {
      const parsedAmount = Math.abs(parseFloat(amount));
      const currentDate = new Date().toISOString();

      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user?.id,
          account_id: selectedAccount,
          category_id: selectedCategory,
          title: title.trim(),
          amount: parsedAmount,
          type: isExpense ? "expense" : "income",
          transaction_date: currentDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create transaction");
      }

      Alert.alert("Success", "Transaction created successfully", [
        { text: "OK", onPress: () => router.back() }
      ]);
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create transaction");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Transaction</Text>
        <TouchableOpacity
          style={styles.saveButtonContainer}
          onPress={handleCreateTransaction}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#00D293" />
          ) : (
            <Text style={styles.saveButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        
        {/* Transaction Type Selector */}
        <View style={styles.typeSelector}>
          <TouchableOpacity
            style={[styles.typeButton, isExpense ? styles.typeExpenseActive : styles.typeInactive]}
            onPress={() => setIsExpense(true)}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={20}
              color={isExpense ? "#FF6B6B" : "#64748B"}
            />
            <Text style={[styles.typeButtonText, isExpense ? styles.typeTextExpense : styles.typeTextInactive]}>
              Expense
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.typeButton, !isExpense ? styles.typeIncomeActive : styles.typeInactive]}
            onPress={() => setIsExpense(false)}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={20}
              color={!isExpense ? "#00D293" : "#64748B"}
            />
            <Text style={[styles.typeButtonText, !isExpense ? styles.typeTextIncome : styles.typeTextInactive]}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* Amount Input */}
        <View style={styles.amountContainer}>
          <Text style={[styles.currencySymbol, isExpense ? styles.textExpense : styles.textIncome]}>
            {isExpense ? "-" : "+"}$
          </Text>
          <TextInput
            style={[styles.amountInput, isExpense ? styles.textExpense : styles.textIncome]}
            placeholder="0.00"
            placeholderTextColor="#1E2D3D"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
        </View>

        <View style={styles.card}>
          {/* Title Input */}
          <Text style={styles.sectionTitle}>TRANSACTION DETAILS</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="create-outline" size={20} color="#64748B" />
            <TextInput
              style={styles.textInput}
              placeholder="Merchant or Description"
              placeholderTextColor="#475569"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Account Selector */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SELECT ACCOUNT</Text>
          {isAccountsLoading ? (
            <ActivityIndicator size="small" color="#00D293" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.grid}>
              {accounts.map((account) => {
                const isActive = selectedAccount === account.id;
                return (
                  <TouchableOpacity
                    key={account.id}
                    style={[styles.gridChip, isActive && styles.gridChipActive]}
                    onPress={() => setSelectedAccount(account.id)}
                  >
                    <Ionicons
                      name="card-outline"
                      size={18}
                      color={isActive ? "#00D293" : "#64748B"}
                    />
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                      {account.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Category Selector */}
          <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SELECT CATEGORY</Text>
          {isCategoriesLoading ? (
            <ActivityIndicator size="small" color="#00D293" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.grid}>
              {categories.map((category) => {
                const isActive = selectedCategory === category.id;
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[styles.gridChip, isActive && styles.gridChipActive]}
                    onPress={() => setSelectedCategory(category.id)}
                  >
                    <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default CreateScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070D14",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: Platform.OS === "android" ? (StatusBar.currentHeight || 24) + 16 : 60,
    paddingBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  saveButtonContainer: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#0C2028",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#174747",
  },
  saveButtonText: {
    color: "#00D293",
    fontSize: 14,
    fontWeight: "700",
  },
  content: {
    flex: 1,
  },
  typeSelector: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 24,
  },
  typeButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  typeInactive: {
    backgroundColor: "#121E2C",
    borderColor: "#1E2D3D",
  },
  typeExpenseActive: {
    backgroundColor: "#1D1620",
    borderColor: "#3D2028",
  },
  typeIncomeActive: {
    backgroundColor: "#0C2028",
    borderColor: "#174747",
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  typeTextInactive: {
    color: "#64748B",
  },
  typeTextExpense: {
    color: "#FF6B6B",
  },
  typeTextIncome: {
    color: "#00D293",
  },
  amountContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  currencySymbol: {
    fontSize: 48,
    fontWeight: "700",
    marginRight: 4,
  },
  amountInput: {
    fontSize: 56,
    fontWeight: "800",
    minWidth: 100,
    textAlign: "center",
  },
  textExpense: {
    color: "#FF6B6B",
  },
  textIncome: {
    color: "#00D293",
  },
  card: {
    backgroundColor: "#0C1521",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
    minHeight: "100%",
    borderWidth: 1,
    borderColor: "#192839",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#64748B",
    marginBottom: 12,
    letterSpacing: 1.1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121E2C",
    borderWidth: 1,
    borderColor: "#1E2D3D",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "500",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  gridChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#121E2C",
    borderWidth: 1,
    borderColor: "#1E2D3D",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    gap: 8,
  },
  gridChipActive: {
    backgroundColor: "#0C2028",
    borderColor: "#00D293",
  },
  chipText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
  },
  chipTextActive: {
    color: "#00D293",
    fontWeight: "700",
  },
});