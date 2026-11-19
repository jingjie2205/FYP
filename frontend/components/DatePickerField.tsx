import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getPhoneDateString } from '@/utils/month';

interface Props {
  /** "YYYY-MM-DD" or empty string */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest selectable date ("YYYY-MM-DD"). Defaults to today on the phone. */
  minDate?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
// Built from numbers, so the result is always a real calendar date (no "2027-2-30")
const toDateString = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

// Accepts "YYYY-MM-DD" or an ISO timestamp; returns the date part only (no timezone shifting)
function parseDateString(value: string): { y: number; m: number; d: number } | null {
  const match = String(value || '').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) return null;
  const y = Number(match[1]), m = Number(match[2]), d = Number(match[3]);
  const check = new Date(y, m - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) return null;
  return { y, m, d };
}

export function formatDisplayDate(value: string): string {
  const p = parseDateString(value);
  if (!p) return '';
  return new Date(p.y, p.m - 1, p.d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function DatePickerField({ value, onChange, placeholder = 'Select a date', minDate }: Props) {
  const min = minDate || getPhoneDateString();
  const selected = parseDateString(value);
  const today = parseDateString(getPhoneDateString())!;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected || today).y);
  const [viewMonth, setViewMonth] = useState((selected || today).m); // 1-12

  // Jump the calendar to the chosen date whenever the value changes from outside
  useEffect(() => {
    const p = parseDateString(value);
    if (p) { setViewYear(p.y); setViewMonth(p.m); }
  }, [value]);

  const cells = useMemo(() => {
    const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();
    const list: (number | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [viewYear, viewMonth]);

  const shiftMonth = (delta: number) => {
    const total = viewYear * 12 + (viewMonth - 1) + delta;
    setViewYear(Math.floor(total / 12));
    setViewMonth((total % 12) + 1);
  };

  const isDisabled = (d: number) => toDateString(viewYear, viewMonth, d) < min;
  const isSelected = (d: number) => !!selected && selected.y === viewYear && selected.m === viewMonth && selected.d === d;
  const isToday = (d: number) => today.y === viewYear && today.m === viewMonth && today.d === d;

  return (
    <View>
      <TouchableOpacity style={[styles.field, open && styles.fieldOpen]} onPress={() => setOpen(o => !o)} activeOpacity={0.8}>
        <Ionicons name="calendar-outline" size={18} color="#64748B" />
        <Text style={[styles.fieldText, !selected && styles.placeholder]}>
          {selected ? formatDisplayDate(value) : placeholder}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </TouchableOpacity>

      {open && (
        <View style={styles.calendar}>
          <View style={styles.monthRow}>
            <TouchableOpacity onPress={() => shiftMonth(-12)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="play-back" size={14} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftMonth(-1)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="chevron-back" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <Text style={styles.monthTitle}>{MONTH_NAMES[viewMonth - 1]} {viewYear}</Text>
            <TouchableOpacity onPress={() => shiftMonth(1)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => shiftMonth(12)} hitSlop={8} style={styles.navBtn}>
              <Ionicons name="play-forward" size={14} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.weekRow}>
            {WEEKDAYS.map((w, i) => <Text key={i} style={styles.weekday}>{w}</Text>)}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => (
              <View key={i} style={styles.cellWrap}>
                {d !== null && (
                  <TouchableOpacity
                    disabled={isDisabled(d)}
                    onPress={() => { onChange(toDateString(viewYear, viewMonth, d)); setOpen(false); }}
                    style={[styles.cell, isToday(d) && styles.cellToday, isSelected(d) && styles.cellSelected]}
                  >
                    <Text style={[styles.cellText, isDisabled(d) && styles.cellTextDisabled, isSelected(d) && styles.cellTextSelected]}>{d}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, padding: 16 },
  fieldOpen: { borderColor: '#00D293' },
  fieldText: { flex: 1, color: '#FFFFFF', fontSize: 16 },
  placeholder: { color: '#475569' },
  calendar: { marginTop: 8, backgroundColor: '#03151E', borderWidth: 1, borderColor: '#1E2D3D', borderRadius: 12, padding: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  navBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#0C1A25', alignItems: 'center', justifyContent: 'center' },
  monthTitle: { flex: 1, textAlign: 'center', color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekday: { flex: 1, textAlign: 'center', color: '#64748B', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cellWrap: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2 },
  cell: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellToday: { borderWidth: 1, borderColor: '#1E4D4A' },
  cellSelected: { backgroundColor: '#00D293', borderColor: '#00D293' },
  cellText: { color: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  cellTextDisabled: { color: '#2A3A4C' },
  cellTextSelected: { color: '#03151E', fontWeight: '800' },
});
