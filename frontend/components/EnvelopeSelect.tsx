import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupedCategory } from '@/hooks/useCategories';

interface Props {
  groups: GroupedCategory[];
  /** Selected envelope (category) id, or null when nothing is chosen yet */
  value: string | null;
  onChange: (categoryId: string) => void;
  placeholder?: string;
}

// Dropdown listing envelopes under their group headers. The list scrolls, so it stays usable with many envelopes.
export default function EnvelopeSelect({ groups, value, onChange, placeholder = 'Select an envelope' }: Props) {
  const [open, setOpen] = useState(false);

  const nonEmptyGroups = groups.filter((g) => g.categories.length > 0);
  const selected = nonEmptyGroups.flatMap((g) => g.categories).find((c) => c.id === value);

  return (
    <View>
      <TouchableOpacity style={[styles.field, open && styles.fieldOpen]} onPress={() => setOpen((o) => !o)} activeOpacity={0.8}>
        <Ionicons name="wallet-outline" size={18} color="#64748B" />
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? selected.name : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </TouchableOpacity>

      {open && (
        <View style={styles.list}>
          <ScrollView nestedScrollEnabled style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator>
            {nonEmptyGroups.map((group) => (
              <View key={group.id}>
                <Text style={styles.groupLabel}>{group.name.toUpperCase()}</Text>
                {group.categories.map((cat) => {
                  const isSelected = cat.id === value;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.option, isSelected && styles.optionSelected]}
                      onPress={() => { onChange(cat.id); setOpen(false); }}
                    >
                      <Text style={[styles.optionText, isSelected && styles.optionTextSelected]} numberOfLines={1}>{cat.name}</Text>
                      {isSelected && <Ionicons name="checkmark" size={16} color="#00D293" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#121E2C', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14 },
  fieldOpen: { borderColor: '#00D293' },
  fieldText: { flex: 1, color: '#FFFFFF', fontSize: 14 },
  placeholder: { color: '#475569' },
  list: { marginTop: 8, backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, paddingVertical: 6 },
  groupLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', letterSpacing: 0.8, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  option: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 11 },
  optionSelected: { backgroundColor: 'rgba(0, 210, 147, 0.08)' },
  optionText: { color: '#E2E8F0', fontSize: 14, flex: 1 },
  optionTextSelected: { color: '#00D293', fontWeight: '700' },
});
