import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { Fingerprint } from 'lucide-react-native';

interface BiometricLockScreenProps {
  onUnlock: () => Promise<boolean>;
}

export function BiometricLockScreen({ onUnlock }: BiometricLockScreenProps) {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [isUnlocking, setIsUnlocking] = useState(false);

  const handleUnlock = async () => {
    if (isUnlocking) return;
    setIsUnlocking(true);
    await onUnlock();
    setIsUnlocking(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#111827' : '#ffffff' }]}>
      <View style={styles.inner}>
        <View style={[styles.iconWrap, { backgroundColor: isDark ? '#1f2937' : '#f3f4f6' }]}>
          <Fingerprint size={52} color={isDark ? '#60a5fa' : '#2563eb'} />
        </View>

        <Text
          style={[styles.title, { color: isDark ? '#f9fafb' : '#111827' }]}
        >
          {t('biometricLock.title')}
        </Text>

        <Text
          style={[styles.subtitle, { color: isDark ? '#9ca3af' : '#6b7280' }]}
        >
          {t('biometricLock.subtitle')}
        </Text>

        <TouchableOpacity
          onPress={handleUnlock}
          disabled={isUnlocking}
          style={[styles.btn, { backgroundColor: isDark ? '#2563eb' : '#2563eb', opacity: isUnlocking ? 0.6 : 1 }]}
          activeOpacity={0.8}
        >
          {isUnlocking ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.btnText}>{t('biometricLock.unlockButton')}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inner: {
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 20,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 16,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  btnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
