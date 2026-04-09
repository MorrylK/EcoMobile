import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { MobileI18nProvider } from '@/lib/mobile-i18n';
import { MobileAuthProvider } from '@/lib/mobile-auth';
import { Colors } from '@/constants/theme';
import { InternetStatusBar } from '@/components/ui/InternetStatusBar';
import { ToastContainer } from '@/components/ui/ToastContainer';
import { UpdateChecker } from '@/components/ui/UpdateChecker';
import { BiometricLockScreen } from '@/components/ui/BiometricLockScreen';
import { useBiometricLock } from '@/hooks/useBiometricLock';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';
import "@/global.css";

const CustomLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.background,
    card: Colors.light.card,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.notification,
  },
};

const CustomDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.background,
    card: Colors.dark.card,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.notification,
  },
};

SplashScreen.preventAutoHideAsync();

function AppContent() {
  const colorScheme = useColorScheme();
  const { isLocked, isReady, unlock } = useBiometricLock();

  // Activer SSE au niveau global
  useNotificationSSE();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
      <View style={{ flex: 1 }}>
        <InternetStatusBar showInAllScreens={true} position="top" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(modals)" options={{ headerShown: false, presentation: 'modal' }} />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        <ToastContainer />
        <UpdateChecker />
        {isReady && isLocked && <BiometricLockScreen onUnlock={unlock} />}
      </View>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    'Aptos': require('../assets/fonts/Aptos.ttf'),
    'Aptos-Display': require('../assets/fonts/Aptos-Display.ttf'),
    'Aptos-SemiBold': require('../assets/fonts/Aptos-SemiBold.ttf'),
    'Aptos-Bold': require('../assets/fonts/Aptos-Bold.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <MobileI18nProvider>
      <MobileAuthProvider>
        <AppContent />
      </MobileAuthProvider>
    </MobileI18nProvider>
  );
}