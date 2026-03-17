import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageUtils, STORAGE_KEYS } from '@/utils/storage';
import { getTranslationSync } from '@/lib/mobile-i18n';

export function useBiometricLock() {
  const [isLocked, setIsLocked] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setIsReady(true);
      return;
    }
    initLock();
    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, []);

  const checkBioAvailable = async (): Promise<boolean> => {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return has && enrolled;
  };

  const initLock = async () => {
    const available = await checkBioAvailable();
    setIsBiometricAvailable(available);

    const enabled = (await storageUtils.getBoolean(STORAGE_KEYS.BIOMETRIC_AUTH)) ?? false;
    const realEnabled = enabled && available;
    setIsEnabled(realEnabled);

    // Verrouillage systématique au cold start si activé
    if (realEnabled) {
      setIsLocked(true);
    }

    setIsReady(true);
  };

  const handleAppStateChange = useCallback(async (nextState: AppStateStatus) => {
    const prev = appStateRef.current;
    appStateRef.current = nextState;

    if (nextState === 'background' || nextState === 'inactive') {
      const enabled = (await storageUtils.getBoolean(STORAGE_KEYS.BIOMETRIC_AUTH)) ?? false;
      if (enabled) {
        setIsLocked(true);
      }
    } else if (nextState === 'active' && prev !== 'active') {
      // App revient au premier plan
      const enabled = (await storageUtils.getBoolean(STORAGE_KEYS.BIOMETRIC_AUTH)) ?? false;
      const available = await checkBioAvailable();
      if (enabled && available) {
        setIsLocked(true);
      }
    }
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: getTranslationSync('biometricLock.prompt'),
        fallbackLabel: getTranslationSync('security.usePasscode'),
        disableDeviceFallback: false,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') return false;
    const available = await checkBioAvailable();
    if (!available) return false;
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: getTranslationSync('security.authenticateToEnable'),
      fallbackLabel: getTranslationSync('security.usePasscode'),
      disableDeviceFallback: false,
    });
    if (result.success) {
      await storageUtils.setBoolean(STORAGE_KEYS.BIOMETRIC_AUTH, true);
      setIsEnabled(true);
      return true;
    }
    return false;
  }, []);

  const disable = useCallback(async () => {
    await storageUtils.setBoolean(STORAGE_KEYS.BIOMETRIC_AUTH, false);
    setIsEnabled(false);
    setIsLocked(false);
  }, []);

  return { isLocked, isEnabled, isReady, isBiometricAvailable, unlock, enable, disable };
}
