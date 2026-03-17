import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { Text } from './Text';

interface StarRatingProps {
  value: number | null; // 1-5, null = non évalué
  onChange?: (v: number) => void;
  size?: number;
  colorScheme?: 'light' | 'dark' | null;
  readonly?: boolean;
}

export function StarRating({ value, onChange, size = 28, colorScheme, readonly = false }: StarRatingProps) {
  const filled = colorScheme === 'dark' ? '#f59e0b' : '#f59e0b';
  const empty = colorScheme === 'dark' ? '#4b5563' : '#d1d5db';

  return (
    <View style={styles.row}>
      {[1, 2, 3, 4, 5].map((star) => {
        const active = value !== null && star <= value;
        return readonly ? (
          <Text
            key={star}
            style={[styles.star, { fontSize: size, color: active ? filled : empty }]}
          >
            ★
          </Text>
        ) : (
          <TouchableOpacity
            key={star}
            onPress={() => onChange?.(star)}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Text style={[styles.star, { fontSize: size, color: active ? filled : empty }]}>
              ★
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  star: {
    lineHeight: undefined,
  },
});
