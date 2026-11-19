import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMonth } from '@/hooks/useMonth';
import { formatMonthKey } from '@/utils/month';

interface Props {
  style?: StyleProp<ViewStyle>;
}

export default function MonthSelector({ style }: Props) {
  const { selectedMonth, isCurrentMonth, goToPreviousMonth, goToNextMonth, setSelectedMonth, currentMonth } = useMonth();

  return (
    <View style={[styles.wrap, style]}>
      <TouchableOpacity style={styles.arrowBtn} onPress={goToPreviousMonth} hitSlop={8}>
        <Ionicons name="chevron-back" size={18} color="#94A3B8" />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={styles.monthText}>{formatMonthKey(selectedMonth)}</Text>
        {isCurrentMonth ? (
          <Text style={styles.subText}>Current month</Text>
        ) : (
          <TouchableOpacity onPress={() => setSelectedMonth(currentMonth)} hitSlop={6}>
            <Text style={styles.backToCurrent}>Past month · Back to current</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.arrowBtn, isCurrentMonth && styles.arrowDisabled]}
        onPress={goToNextMonth}
        disabled={isCurrentMonth}
        hitSlop={8}
      >
        <Ionicons name="chevron-forward" size={18} color={isCurrentMonth ? '#2A3A4C' : '#94A3B8'} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0C1521',
    borderWidth: 1,
    borderColor: '#192839',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  arrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#121E2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowDisabled: { backgroundColor: 'transparent' },
  center: { alignItems: 'center', flex: 1 },
  monthText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  subText: { color: '#64748B', fontSize: 10, fontWeight: '600', marginTop: 1 },
  backToCurrent: { color: '#F59E0B', fontSize: 10, fontWeight: '700', marginTop: 1 },
});
