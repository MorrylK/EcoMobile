// app/(tabs)/_layout.tsx
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { Slot, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';

const BOTTOM_NAV_SCREENS = ['home', 'map', 'scan', 'rides', 'profile'];

const NO_BOTTOM_NAV_SCREENS = [
  'chat', 'notifications', 'edit-profile', 'security', 
  'wallet', 'ride-details', 'bike-details', 'bike-inspection',
  'ride-in-progress', 'report-issue'
];

export default function TabsLayout() {
  const router = useRouter();
  const segments = useSegments();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const [activeScreen, setActiveScreen] = useState('home');

  useEffect(() => {
    const currentTab = segments[segments.length - 1];
    if (currentTab && BOTTOM_NAV_SCREENS.includes(currentTab)) {
      setActiveScreen(currentTab);
    }
  }, [segments]);

  const handleNavigate = (screen: string) => {
    setActiveScreen(screen);
    
    switch(screen) {
      case 'home':
        router.navigate('/(tabs)/home');
        break;
      case 'map':
        router.navigate('/(tabs)/map');
        break;
      case 'scan':
        router.navigate('/(tabs)/scan');
        break;
      case 'rides':
        router.navigate('/(tabs)/rides');
        break;
      case 'profile':
        router.navigate('/(tabs)/profile');
        break;
      default:
        router.navigate('/(tabs)/home');
    }
  };

  const currentScreen = segments[segments.length - 1] || 'home';
  const showBottomNav = BOTTOM_NAV_SCREENS.includes(currentScreen);
  const isModalScreen = NO_BOTTOM_NAV_SCREENS.includes(currentScreen);

  return (
    <View style={[styles.flex1, {
      backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb',
      paddingTop: isModalScreen ? 0 : 0
    }]}>
      {/* Contenu des pages */}
      <View style={styles.flex1}>
        <Slot />
      </View>

      {/* Bandeau forfait actif — au-dessus de la barre de navigation
      {showBottomNav && <ActivePlanBanner />} */}

      {showBottomNav && (
        <BottomNavigation
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
        />
      )}
    </View>
  );
}