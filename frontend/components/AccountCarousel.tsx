import React, { useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';

const { width } = Dimensions.get('window');

export interface CarouselAccountCard {
  id: string;
  name: string;
  type: string;
  balance: number;
  isAddButton?: boolean;
  isOverview?: boolean;
}

interface AccountCarouselProps {
  cards: CarouselAccountCard[];
  activeIndex: number;
  onSelectIndex: (index: number) => void;
  onOpenCreate: () => void;
  onOpenEdit: (account: CarouselAccountCard) => void;
}

export function AccountCarousel({
  cards,
  activeIndex,
  onSelectIndex,
  onOpenCreate,
  onOpenEdit,
}: AccountCarouselProps) {
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      onSelectIndex(viewableItems[0].index);
    }
  }).current;

  return (
    <View style={styles.carouselContainer}>
      <FlatList
        data={cards}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={width - 32 + 16}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (item.isAddButton) {
            return (
              <TouchableOpacity
                style={[styles.balanceCard, styles.addCardContainer, { width: width - 32 }]}
                onPress={onOpenCreate}
              >
                <View style={styles.addIconCircle}>
                  <Ionicons name="add" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.addCardTitle}>Add New Account</Text>
                <Text style={styles.addCardSubtitle}>
                  Tap to configure a new bank, wallet or card
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <View style={[styles.balanceCard, { width: width - 32 }]}>
              <View style={styles.cardTopRow}>
                <View style={styles.cardTopLeft}>
                  <Text style={styles.cardAccountName}>{item.name}</Text>
                  <View style={styles.accountTypeBadge}>
                    <Text style={styles.accountTypeText}>{item.type}</Text>
                  </View>
                </View>

                {!item.isOverview && (
                  <TouchableOpacity
                    onPress={() => onOpenEdit(item)}
                    style={styles.editIconBtn}
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color="#9CA3AF" />
                  </TouchableOpacity>
                )}
              </View>

              <Text style={styles.netAmount}>
                ${Math.abs(item.balance || 0).toFixed(2)}
                <Text style={styles.netSubtitle}>
                  {' '}
                  {(item.balance || 0) >= 0 ? 'Balance' : 'Debt'}
                </Text>
              </Text>
            </View>
          );
        }}
      />

      {cards.length > 1 && (
        <View style={styles.paginationDots}>
          {cards.map((_, idx) => (
            <View
              key={idx}
              style={[styles.dot, activeIndex === idx && styles.activeDot]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  carouselContainer: {
    marginBottom: 12,
    marginHorizontal: -16,
  },
  listContent: {
    paddingHorizontal: 16,
  },
  balanceCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 22,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    marginRight: 16,
  },
  addCardContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 135,
    borderStyle: 'dashed',
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
  addIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  addCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  addCardSubtitle: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardAccountName: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  accountTypeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  accountTypeText: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '600',
  },
  editIconBtn: {
    padding: 4,
  },
  netAmount: {
    fontSize: 32,
    fontWeight: '700',
    marginTop: 16,
    color: COLORS.text,
  },
  netSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  activeDot: {
    width: 16,
    backgroundColor: COLORS.primary,
  },
});