import { Text } from '@/components/ui/Text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { Home, Map, Route, ScanLine, User } from 'lucide-react-native';
import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';

interface BottomNavigationProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function BottomNavigation({ activeScreen, onNavigate }: BottomNavigationProps) {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const colors = Colors[colorScheme];

  const navItems = [
    { id: 'home', icon: Home, label: t('nav.home') },
    { id: 'map', icon: Map, label: t('nav.map') },
    { id: 'scan', icon: ScanLine, label: t('nav.scan') },
    { id: 'rides', icon: Route, label: t('nav.rides') },
    { id: 'profile', icon: User, label: t('nav.profile') },
  ];

  return (
    <View style={[
      { backgroundColor: colors.card },
      { borderTopWidth: 1, borderTopColor: colors.border },
      { paddingBottom: 0 }
    ]}>
      <View style={[
        styles.row,
        styles.alignCenter,
        styles.spaceBetween,
        styles.p16,
        { maxWidth: 600, marginHorizontal: 'auto', width: '100%' }
      ]}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;
          const isScan = item.id === 'scan';

          if (isScan) {
            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => onNavigate(item.id)}
                style={[styles.column, styles.alignCenter, styles.justifyCenter, { marginTop: -32 }]}
                activeOpacity={0.7}
              >
                <View style={[
                  styles.w56,
                  styles.h56,
                  { backgroundColor: colors.primary },
                  styles.roundedFull,
                  styles.alignCenter,
                  styles.justifyCenter,
                  styles.shadowLg
                ]}>
                  <Icon color="white" size={24} />
                </View>
                <Text size="xs" color="primary" style={styles.mt4}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => onNavigate(item.id)}
              style={[
                styles.column,
                styles.alignCenter,
                styles.justifyCenter,
                styles.p8,
                styles.rounded8
              ]}
              activeOpacity={0.7}
            >
              <Icon 
                color={isActive ? colors.primary : colors.icon} 
                size={24} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <Text 
                size="xs" 
                color={isActive ? "primary" : "muted"} 
                style={styles.mt4}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}