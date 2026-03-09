import React, { useRef, useState, useCallback } from 'react';
import { View, PanResponder, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Text } from '@/components/ui/Text';

interface VerticalSliderProps {
  value: number | null;       // 0–100 ou null si non évalué
  onChange: (value: number) => void;
  height?: number;            // hauteur de la piste (défaut 120)
  label?: string;             // étiquette au-dessus
  colorScheme?: 'light' | 'dark';
}

function conditionColor(v: number): string {
  if (v <= 30) return '#ef4444';   // rouge — mauvais
  if (v <= 69) return '#f59e0b';   // orange — dégradé
  return '#16a34a';                 // vert — bon
}

function conditionLabel(v: number | null): string {
  if (v === null) return '—';
  if (v <= 30) return 'Mauvais';
  if (v <= 69) return 'Dégradé';
  return 'Bon';
}

export function VerticalSlider({ value, onChange, height = 120, label, colorScheme = 'light' }: VerticalSliderProps) {
  const trackRef = useRef<View>(null);
  const trackHeight = useRef(height);
  const trackY = useRef(0);
  const [localValue, setLocalValue] = useState<number | null>(value);

  const isDark = colorScheme === 'dark';
  const trackBg = isDark ? '#374151' : '#e5e7eb';
  const textColor = isDark ? '#d1d5db' : '#374151';

  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));

  const valueFromY = useCallback((pageY: number): number => {
    const relY = pageY - trackY.current;
    // relY=0 → top → 100%, relY=trackHeight → bottom → 0%
    const pct = 1 - relY / trackHeight.current;
    return clamp(pct * 100);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        trackRef.current?.measure((_x, _y, _w, h, _px, py) => {
          trackHeight.current = h || height;
          trackY.current = py;
          const v = valueFromY(e.nativeEvent.pageY);
          setLocalValue(v);
          onChange(v);
        });
      },
      onPanResponderMove: (e) => {
        const v = valueFromY(e.nativeEvent.pageY);
        setLocalValue(v);
        onChange(v);
      },
    }),
  ).current;

  const displayValue = localValue ?? value;
  const pct = displayValue ?? 50; // Pour le rendu de la piste, 50 si null
  const hasValue = displayValue !== null;
  const fillColor = hasValue ? conditionColor(pct) : (isDark ? '#4b5563' : '#d1d5db');
  const thumbColor = hasValue ? conditionColor(pct) : (isDark ? '#6b7280' : '#9ca3af');

  // Position du thumb (0% = bottom, 100% = top)
  const thumbTop = hasValue ? ((1 - pct / 100) * height) : height / 2;

  const onLayout = (e: LayoutChangeEvent) => {
    trackHeight.current = e.nativeEvent.layout.height;
  };

  return (
    <View style={styles.wrapper}>
      {/* Étiquette */}
      {label && (
        <Text style={[styles.label, { color: textColor }]} numberOfLines={2}>
          {label}
        </Text>
      )}

      {/* Piste + thumb */}
      <View
        ref={trackRef}
        style={[styles.track, { height, backgroundColor: trackBg }]}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        {/* Remplissage coloré du bas jusqu'au thumb */}
        <View
          style={[
            styles.fill,
            {
              height: hasValue ? `${pct}%` as any : '50%',
              backgroundColor: fillColor,
              opacity: hasValue ? 1 : 0.3,
            },
          ]}
        />
        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            {
              top: thumbTop - 10,
              backgroundColor: thumbColor,
              borderColor: isDark ? '#1f2937' : '#fff',
            },
          ]}
        />
      </View>

      {/* Valeur + état */}
      <Text style={[styles.pct, { color: hasValue ? conditionColor(pct) : (isDark ? '#6b7280' : '#9ca3af') }]}>
        {hasValue ? `${Math.round(pct)}%` : '—'}
      </Text>
      <Text style={[styles.state, { color: hasValue ? conditionColor(pct) : (isDark ? '#6b7280' : '#9ca3af') }]}>
        {conditionLabel(displayValue)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    width: 56,
  },
  label: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 6,
    lineHeight: 12,
    width: 52,
  },
  track: {
    width: 12,
    borderRadius: 6,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  fill: {
    width: '100%',
    borderRadius: 6,
    position: 'absolute',
    bottom: 0,
  },
  thumb: {
    position: 'absolute',
    left: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 3,
  },
  pct: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
  },
  state: {
    fontSize: 9,
    marginTop: 1,
  },
});
