import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ReallocationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (details: any) => Promise<void>;
  details: {
    sourceCategory: string;
    destCategory: string;
    amount: number;
    sourceBefore: number;
    sourceAfter: number;
    destBefore: number;
    destAfter: number;
  };
}

export default function ReallocationModal({
  visible,
  onClose,
  onConfirm,
  details,
}: ReallocationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirmPress = async () => {
    try {
      setIsSubmitting(true);
      await onConfirm(details);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent={true} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.headerRow}>
            <Ionicons name="swap-horizontal" size={24} color="#00D293" />
            <Text style={styles.modalTitle}>Confirm Budget Reallocation</Text>
          </View>

          <Text style={styles.modalSubtitle}>
            Finley suggests moving funds between your budget envelopes:
          </Text>

          <View style={styles.transferSummaryBox}>
            <View style={styles.transferLeg}>
              <Text style={styles.legLabel}>From: {details.sourceCategory}</Text>
              <Text style={styles.legValues}>
                ${details.sourceBefore.toFixed(2)} → <Text style={styles.redText}>${details.sourceAfter.toFixed(2)}</Text>
              </Text>
            </View>

            <Ionicons name="arrow-down" size={18} color="#64748B" style={styles.arrowIcon} />

            <View style={styles.transferLeg}>
              <Text style={styles.legLabel}>To: {details.destCategory}</Text>
              <Text style={styles.legValues}>
                ${details.destBefore.toFixed(2)} → <Text style={styles.greenText}>${details.destAfter.toFixed(2)}</Text>
              </Text>
            </View>

            <View style={styles.amountDivider} />
            <Text style={styles.transferAmountText}>
              Transfer Amount: <Text style={styles.boldWhite}>${details.amount.toFixed(2)}</Text>
            </Text>
          </View>

          <View style={styles.actionButtonsRow}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose} disabled={isSubmitting}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPress} disabled={isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#03151E" />
              ) : (
                <Text style={styles.confirmButtonText}>Execute Transfer</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(3, 21, 30, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#0C1A25',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1E2D3D',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginLeft: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  transferSummaryBox: {
    backgroundColor: '#03151E',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E2D3D',
    marginBottom: 20,
  },
  transferLeg: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  legLabel: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  legValues: {
    fontSize: 14,
    color: '#64748B',
  },
  redText: {
    color: '#EF4444',
    fontWeight: '600',
  },
  greenText: {
    color: '#00D293',
    fontWeight: '600',
  },
  arrowIcon: {
    alignSelf: 'center',
    marginVertical: 6,
  },
  amountDivider: {
    height: 1,
    backgroundColor: '#1E2D3D',
    marginVertical: 10,
  },
  transferAmountText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  boldWhite: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#00D293',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#03151E',
    fontSize: 14,
    fontWeight: '700',
  },
});