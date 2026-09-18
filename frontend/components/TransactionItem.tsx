import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { formatDate } from "@/utils/utils";

interface Transaction {
  title: string;
  id: string;
  category: string;
  amount: number | string;
  created_at: string;
  type: "income" | "expense";
}

interface TransactionItemProps {
  item: Transaction;
  onDelete: (id: string) => void;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Food & Drinks": "fast-food-outline",
  Shopping: "cart-outline",
  Transportation: "car-outline",
  Entertainment: "film-outline",
  Bills: "receipt-outline",
  Income: "wallet-outline",
  Other: "ellipsis-horizontal-outline",
};

export const TransactionItem = ({ item, onDelete }: TransactionItemProps) => {
  const isIncome = item.type === "income";
  const iconName = CATEGORY_ICONS[item.category] || "pricetag-outline";

  const parsedAmount = Math.abs(parseFloat(item.amount?.toString() || "0")).toFixed(2);

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.content} activeOpacity={0.7}>
        {/* Category Icon Badge */}
        <View style={[styles.iconContainer, isIncome ? styles.iconIncome : styles.iconExpense]}>
          <Ionicons
            name={iconName}
            size={20}
            color={isIncome ? "#00D293" : "#FF6B6B"}
          />
        </View>

        {/* Transaction Title & Category */}
        <View style={styles.infoLeft}>
          <Text style={styles.title} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{item.category || "General"}</Text>
          </View>
        </View>

        {/* Amount & Date */}
        <View style={styles.infoRight}>
          <Text style={[styles.amountText, isIncome ? styles.incomeText : styles.expenseText]}>
            {isIncome ? "+" : "-"}${parsedAmount}
          </Text>
          <Text style={styles.dateText}>{formatDate(item.created_at)}</Text>
        </View>
      </TouchableOpacity>

      {/* Delete Button */}
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(item.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={18} color="#64748B" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0C1521",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#192839",
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  content: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },
  iconIncome: {
    backgroundColor: "#0C2028",
    borderColor: "#174747",
  },
  iconExpense: {
    backgroundColor: "#1D1620",
    borderColor: "#3D2028",
  },
  infoLeft: {
    flex: 1,
    marginRight: 8,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#121E2C",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  categoryText: {
    color: "#8295AB",
    fontSize: 11,
    fontWeight: "600",
  },
  infoRight: {
    alignItems: "flex-end",
    marginRight: 10,
  },
  amountText: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4,
  },
  incomeText: {
    color: "#00D293",
  },
  expenseText: {
    color: "#FF6B6B",
  },
  dateText: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "500",
  },
  deleteButton: {
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});