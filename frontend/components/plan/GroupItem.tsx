import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupedCategory, Category } from '@/hooks/useCategories';
import CategoryItem from './CategoryItem';

interface Props {
  group: GroupedCategory;
  isCollapsed: boolean;
  spendingMap: Record<string, number>;
  onToggle: (id: string) => void;
  onAddCategory: (id: string) => void;
  onEditGroup: (group: GroupedCategory) => void;
  onEditCategory: (category: Category) => void;
  onCoverCategory: (category: Category) => void;
}

export default function GroupItem({ 
  group, isCollapsed, spendingMap, onToggle, onAddCategory, onEditGroup, onEditCategory, onCoverCategory
}: Props) {
  
  const groupTargetTotal = group.categories.reduce((sum, cat) => sum + Number(cat.target_amount || 0), 0);
  
  const groupAvailableTotal = group.categories.reduce((sum, cat) => {
    const target = Number(cat.target_amount || 0);
    const spent = spendingMap[cat.id] || 0;
    return sum + (target - spent);
  }, 0);

  const isGroupOverspent = groupAvailableTotal < 0;

  return (
    <View style={[styles.groupContainer, isGroupOverspent && styles.groupContainerOverspent]}>
      <TouchableOpacity 
        style={[styles.groupHeader, isGroupOverspent && styles.groupHeaderOverspent]} 
        onPress={() => onToggle(group.id)} 
        activeOpacity={0.8}
      >
        <View style={styles.groupHeaderLeft}>
          <Ionicons name={isCollapsed ? "chevron-forward" : "chevron-down"} size={18} color={isGroupOverspent ? "#FF6B6B" : "#64748B"} />
          <Text style={[styles.groupTitle, isGroupOverspent && styles.textOverspent]}>{group.name}</Text>
          {isGroupOverspent && <Ionicons name="alert-circle" size={16} color="#FF6B6B" />}
        </View>
        <View style={styles.groupHeaderRight}>
          <Text style={styles.groupTotals}>
            <Text style={{ color: isGroupOverspent ? '#FF6B6B' : '#00D293' }}>
              ${groupAvailableTotal.toFixed(0)}
            </Text> /${groupTargetTotal.toFixed(0)}
          </Text>
          <TouchableOpacity style={styles.groupActionBtn} onPress={() => onAddCategory(group.id)}>
            <Ionicons name="add" size={16} color={isGroupOverspent ? "#FF6B6B" : "#00D293"} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.groupActionBtn} onPress={() => onEditGroup(group)}>
            <Ionicons name="create-outline" size={16} color="#64748B" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>

      {!isCollapsed && (
        <View style={styles.groupContent}>
          {group.categories.length === 0 ? (
            <Text style={styles.emptyGroupText}>No envelopes in this group.</Text>
          ) : (
            group.categories.map((cat) => (
              <CategoryItem 
                key={cat.id} 
                category={cat} 
                spentAmount={spendingMap[cat.id] || 0}
                onEdit={onEditCategory} 
                onCover={onCoverCategory}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  groupContainer: { marginBottom: 16, backgroundColor: '#0C1A25', borderRadius: 16, borderWidth: 1, borderColor: '#1E2D3D', overflow: 'hidden' },
  
  groupContainerOverspent: { borderColor: 'rgba(255, 107, 107, 0.3)' },
  groupHeaderOverspent: { backgroundColor: 'rgba(255, 107, 107, 0.03)'  },
  textOverspent: { color: '#FF6B6B' },

  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#0C1A25' },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  groupTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  groupHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupTotals: { color: '#64748B', fontSize: 13, fontWeight: '600' },
  groupActionBtn: { padding: 4 },
  groupContent: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 8, backgroundColor: '#03151E' },
  emptyGroupText: { color: '#64748B', fontSize: 13, textAlign: 'center', paddingVertical: 12 },
});