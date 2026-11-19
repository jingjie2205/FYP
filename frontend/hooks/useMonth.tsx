import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getPhoneDateString, getPhoneMonthKey, shiftMonthKey } from '@/utils/month';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

interface MonthContextValue {
  /** Month according to the phone's date ("YYYY-MM"). */
  currentMonth: string;
  /** Month the user is currently viewing. */
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  isCurrentMonth: boolean;
  /** True once the first rollover attempt has finished (success or failure). */
  rolloverReady: boolean;
  /** Increments every time a rollover completes, so screens can refetch. */
  rolloverVersion: number;
  /** Re-run recurring processing + rollover now, then refetch (used after creating a rule). */
  syncNow: () => Promise<void>;
}

const MonthContext = createContext<MonthContextValue | null>(null);

export function MonthProvider({ userId, children }: { userId?: string; children: React.ReactNode }) {
  const [currentDate, setCurrentDate] = useState(getPhoneDateString());
  const [currentMonth, setCurrentMonth] = useState(getPhoneMonthKey());
  const [selectedMonth, setSelectedMonthState] = useState(currentMonth);
  const [rolloverReady, setRolloverReady] = useState(false);
  const [rolloverVersion, setRolloverVersion] = useState(0);
  const lastRolledFor = useRef<string | null>(null);
  const lastProcessedFor = useRef<string | null>(null);

  // Runs when the app opens / returns to the foreground / the phone date changes:
  //  1. post recurring transactions that are due (checked per DAY, e.g. rent due on the 15th)
  //  2. roll envelopes forward to the phone's month (checked per MONTH)
  // Recurring goes first so last month's recurring expenses count in its leftover.
  // Both endpoints are idempotent, so repeating a call is harmless.
  const sync = useCallback(async (date: string, force = false) => {
    if (!userId) return;
    const month = date.slice(0, 7);
    let changed = false;

    const recurringKey = `${userId}:${date}`;
    if (force || lastProcessedFor.current !== recurringKey) {
      lastProcessedFor.current = recurringKey;
      try {
        const response = await fetch(`${API_URL}/recurring/process/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date }),
        });
        if (!response.ok) {
          console.log('Recurring processing failed:', response.status, await response.text());
          lastProcessedFor.current = null; // retry on next foreground
        } else {
          const result = await response.json();
          if (result.created > 0) changed = true;
        }
      } catch (e) {
        console.error('Error processing recurring transactions:', e);
        lastProcessedFor.current = null;
      }
    }

    const rolloverKey = `${userId}:${month}`;
    if (lastRolledFor.current !== rolloverKey) {
      lastRolledFor.current = rolloverKey;
      changed = true;
      try {
        const response = await fetch(`${API_URL}/budgets/rollover/${userId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ month }),
        });
        if (!response.ok) {
          console.log('Rollover failed:', response.status, await response.text());
          lastRolledFor.current = null; // allow retry on next foreground
        }
      } catch (e) {
        console.error('Error running monthly rollover:', e);
        lastRolledFor.current = null;
      }
    }

    setRolloverReady(true);
    // Tell screens to refetch (new recurring transactions and/or new month rows)
    if (changed) setRolloverVersion((v) => v + 1);
  }, [userId]);

  // Run on login / when the phone date changes
  useEffect(() => {
    sync(currentDate);
  }, [currentDate, sync]);

  // Lets a screen force a re-check right away (e.g. after creating a recurring rule due today)
  const syncNow = useCallback(() => sync(getPhoneDateString(), true), [sync]);

  // Re-check the phone date whenever the app returns to the foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      setCurrentDate(getPhoneDateString());
      const phoneMonth = getPhoneMonthKey();
      setCurrentMonth((prev) => {
        if (prev === phoneMonth) return prev;
        // If the user was looking at the old "current" month, follow them into the new one
        setSelectedMonthState((sel) => (sel === prev ? phoneMonth : sel > phoneMonth ? phoneMonth : sel));
        return phoneMonth;
      });
    });
    return () => sub.remove();
  }, []);

  const setSelectedMonth = useCallback((month: string) => {
    // Never allow viewing months after the phone's current month
    setSelectedMonthState(month > currentMonth ? currentMonth : month);
  }, [currentMonth]);

  const goToPreviousMonth = useCallback(() => {
    setSelectedMonthState((m) => shiftMonthKey(m, -1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSelectedMonthState((m) => {
      const next = shiftMonthKey(m, 1);
      return next > currentMonth ? m : next;
    });
  }, [currentMonth]);

  return (
    <MonthContext.Provider
      value={{
        currentMonth,
        selectedMonth,
        setSelectedMonth,
        goToPreviousMonth,
        goToNextMonth,
        isCurrentMonth: selectedMonth === currentMonth,
        rolloverReady: rolloverReady || !userId,
        rolloverVersion,
        syncNow,
      }}
    >
      {children}
    </MonthContext.Provider>
  );
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error('useMonth must be used inside <MonthProvider>');
  return ctx;
}
