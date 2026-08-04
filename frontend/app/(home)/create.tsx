import {
  View,
  Text,
  Alert,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useUser } from "@clerk/expo";
import { useState, useEffect } from "react";
import { API_URL } from "@/constants/api";
import { styles } from "../../assets/styles/create.styles";
import { COLORS } from "../../constants/colors";
import { Ionicons } from "@expo/vector-icons";

// Import your new hook (adjust the path if necessary)
import { useCategories } from "../../hooks/useCategories"; 

const CreateScreen = () => {
  const router = useRouter();
  const { user } = useUser();

  // Integrated Hook
  const { categories, fetchCategories, createCategory, isLoading: isCategoriesLoading } = useCategories(user?.id);

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isExpense, setIsExpense] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // New states for creating a category dynamically
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Fetch categories when the screen mounts
  useEffect(() => {
    if (user?.id) {
      fetchCategories();
    }
  }, [user?.id, fetchCategories]);

  const handleCreateTransaction = async () => {
    // validations
    if (!title.trim()) return Alert.alert("Error", "Please enter a transaction title");
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }

    if (!selectedCategory) return Alert.alert("Error", "Please select a category");

    setIsLoading(true);
    try {
      const formattedAmount = isExpense
        ? -Math.abs(parseFloat(amount))
        : Math.abs(parseFloat(amount));

      const response = await fetch(`${API_URL}/transactions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: user?.id,
          title,
          amount: formattedAmount,
          category: selectedCategory,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create transaction");
      }

      Alert.alert("Success", "Transaction created successfully");
      router.back();
    } catch (error: unknown) {
      Alert.alert("Error", error instanceof Error ? error.message : "Failed to create transaction");
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for creating a new category
  const handleAddNewCategory = async () => {
    if (!newCategoryName.trim()) {
      return Alert.alert("Error", "Category name cannot be empty");
    }
    
    await createCategory({
      name: newCategoryName.trim(),
      type: isExpense ? "expense" : "income",
      icon: "ellipsis-horizontal", // Default icon for user-created categories
    });
    
    setNewCategoryName("");
    setIsAddingCategory(false);
  };

  // Filter categories based on the current transaction type (Expense vs Income)
  const currentCategories = categories.filter(
    (cat) => cat.type === (isExpense ? "expense" : "income")
  );

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Transaction</Text>
        <TouchableOpacity
          style={[styles.saveButtonContainer, isLoading && styles.saveButtonDisabled]}
          onPress={handleCreateTransaction}
          disabled={isLoading}
        >
          <Text style={styles.saveButton}>{isLoading ? "Saving..." : "Save"}</Text>
          {!isLoading && <Ionicons name="checkmark" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.typeSelector}>
          {/* EXPENSE SELECTOR */}
          <TouchableOpacity
            style={[styles.typeButton, isExpense && styles.typeButtonActive]}
            onPress={() => {
              setIsExpense(true);
              setSelectedCategory(""); // Reset selection when switching types
            }}
          >
            <Ionicons
              name="arrow-down-circle"
              size={22}
              color={isExpense ? COLORS.white : COLORS.expense}
              style={styles.typeIcon}
            />
            <Text style={[styles.typeButtonText, isExpense && styles.typeButtonTextActive]}>
              Expense
            </Text>
          </TouchableOpacity>

          {/* INCOME SELECTOR */}
          <TouchableOpacity
            style={[styles.typeButton, !isExpense && styles.typeButtonActive]}
            onPress={() => {
              setIsExpense(false);
              setSelectedCategory("");
            }}
          >
            <Ionicons
              name="arrow-up-circle"
              size={22}
              color={!isExpense ? COLORS.white : COLORS.income}
              style={styles.typeIcon}
            />
            <Text style={[styles.typeButtonText, !isExpense && styles.typeButtonTextActive]}>
              Income
            </Text>
          </TouchableOpacity>
        </View>

        {/* AMOUNT CONTAINER */}
        <View style={styles.amountContainer}>
          <Text style={styles.currencySymbol}>$</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0.00"
            placeholderTextColor={COLORS.textLight}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
        </View>

        {/* INPUT CONTAINER */}
        <View style={styles.inputContainer}>
          <Ionicons
            name="create-outline"
            size={22}
            color={COLORS.textLight}
            style={styles.inputIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Transaction Title"
            placeholderTextColor={COLORS.textLight}
            value={title}
            onChangeText={setTitle}
          />
        </View>

        {/* TITLE */}
        <Text style={styles.sectionTitle}>
          <Ionicons name="pricetag-outline" size={16} color={COLORS.text} /> Category
        </Text>

        {/* DYNAMIC CATEGORY GRID */}
        {isCategoriesLoading ? (
           <ActivityIndicator size="small" color={COLORS.primary} style={{ marginVertical: 10 }} />
        ) : (
          <View style={styles.categoryGrid}>
            {currentCategories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryButton,
                  selectedCategory === category.name && styles.categoryButtonActive,
                ]}
                onPress={() => setSelectedCategory(category.name)}
              >
                <Text
                  style={[
                    styles.categoryButtonText,
                    selectedCategory === category.name && styles.categoryButtonTextActive,
                  ]}
                >
                  {category.name}
                </Text>
              </TouchableOpacity>
            ))}

            {/* ADD NEW CATEGORY BUTTON */}
            {!isAddingCategory && (
              <TouchableOpacity
                style={styles.categoryButton}
                onPress={() => setIsAddingCategory(true)}
              >
                <Ionicons name="add" size={20} color={COLORS.text} style={styles.categoryIcon} />
                <Text style={styles.categoryButtonText}>Add New</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* INLINE CATEGORY CREATION FORM */}
        {isAddingCategory && (
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 15, paddingHorizontal: 5 }}>
            <TextInput
              style={[styles.input, { flex: 1, borderBottomWidth: 1, borderBottomColor: COLORS.textLight, paddingBottom: 5 }]}
              placeholder={`New ${isExpense ? 'Expense' : 'Income'} Category...`}
              placeholderTextColor={COLORS.textLight}
              value={newCategoryName}
              onChangeText={setNewCategoryName}
              autoFocus
            />
            <TouchableOpacity onPress={handleAddNewCategory} style={{ marginLeft: 15 }}>
              <Ionicons name="checkmark-circle" size={28} color={COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setIsAddingCategory(false)} style={{ marginLeft: 10 }}>
              <Ionicons name="close-circle" size={28} color={COLORS.expense} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      )}
    </View>
  );
};

export default CreateScreen;