import { Logo } from '@/components/ui/Logo';
import { Text } from '@/components/ui/Text';
import { ActivePlanBanner } from '@/components/ui/ActivePlanBanner';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useInternet } from '@/hooks/useInternet';
import { notificationService } from '@/services/notificationService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { ArrowLeft, Bell, Menu, RefreshCw } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';

interface MobileHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showNotifications?: boolean;
  notificationCount?: number;
  onNotifications?: () => void;
  showMenu?: boolean;
  onMenu?: () => void;
  onRefresh?: () => void;
  showRefresh?: boolean;
}

export function MobileHeader({
  title,
  showBack,
  onBack,
  showNotifications,
  notificationCount = 0,
  onNotifications,
  showMenu,
  onMenu,
  onRefresh,
  showRefresh = false,
}: MobileHeaderProps) {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);

  const { isConnected } = useInternet();

  const [realNotificationCount, setRealNotificationCount] = useState(notificationCount);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isHomePage = !title && !showBack;
  const showEcoMobileLogo = !showBack

  useEffect(() => {
    const loadNotificationCount = async () => {
      if (!showNotifications) return;

      try {
        const count = await notificationService.getUnreadCount();
        setRealNotificationCount(count);
      } catch (error) {
        console.error('❌ Error loading notification count:', error);
        setRealNotificationCount(notificationCount);
      }
    };

    loadNotificationCount();
  }, [showNotifications, notificationCount]);

  const refreshNotifications = async () => {
    try {
      const count = await notificationService.getUnreadCount();
      setRealNotificationCount(count);
    } catch (error) {
      console.error('❌ Error refreshing notification count:', error);
    }
  };

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    haptics.light();
    setIsRefreshing(true);
    
    try {
      await refreshNotifications();
      onRefresh();
    } catch (error) {
      console.error('❌ Error during refresh:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <View 
        style={[
          styles.p16,
          styles.shadowLg,
          styles.hT10,
          { 
            backgroundColor: '#16a34a',
            zIndex: 40,
            justifyContent: 'flex-end',
          }
        ]}
      >
        <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
          <View style={[styles.row, styles.alignCenter, styles.gap12, styles.flex1]}>
            {showBack && onBack && (
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onBack();
                }}
                style={[styles.p8, styles.rounded8, { marginLeft: -8 }]}
                accessibilityLabel={t('common.back')}
              >
                <ArrowLeft size={24} color="white" />
              </TouchableOpacity>
            )}
            {showMenu && (
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onMenu?.();
                }}
                style={[styles.p8, styles.rounded8, { marginLeft: -8 }]}
                accessibilityLabel="Menu"
              >
                <Menu size={24} color="white" />
              </TouchableOpacity>
            )}
            
            {/* Brand Logo and Name */}
            {showEcoMobileLogo && (
              <View style={[styles.row, styles.gap8]}>
                <View 
                  style={[
                    styles.w32,
                    styles.h32,
                    styles.rounded16,
                    styles.alignCenter,
                    styles.justifyCenter,
                    /*{ backgroundColor: 'white' }*/
                  ]}
                >
                  <Logo size={40} color="white" />
                </View>
                {isHomePage && (
                  <Text variant="title" color="white" size="xl">
                    FreeBike
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Page Title */}
          {title && (
            <View style={[styles.alignCenter]}>
              <Text size="xl" weight="bold" color="white">
                {title}
              </Text>
            </View>
          )}

          {/* Right Actions */}
          <View style={[styles.row, styles.alignCenter, styles.gap8, styles.flex1, { justifyContent: 'flex-end' }]}>
            {showRefresh && onRefresh && (
              <TouchableOpacity
                onPress={handleRefresh}
                disabled={isRefreshing}
                style={[styles.p8, styles.rounded8]}
                accessibilityLabel={t('common.refresh')}
              >
                <RefreshCw 
                  size={20} 
                  color="white" 
                  style={isRefreshing ? { transform: [{ rotate: '360deg' }] } : undefined}
                />
              </TouchableOpacity>
            )}
            
            {showNotifications && (
              <TouchableOpacity
                onPress={() => {
                  haptics.light();
                  onNotifications?.();
                }}
                style={[styles.relative, styles.p8, styles.rounded8]}
                accessibilityLabel="Notifications"
              >
                <Bell size={24} color="white" />
                {realNotificationCount > 0 && (
                  <View 
                    style={[
                      styles.absolute,
                      styles.w20,
                      styles.h20,
                      { borderRadius: 10 },
                      styles.alignCenter,
                      styles.justifyCenter,
                      {
                        backgroundColor: '#ef4444',
                        borderWidth: 2,
                        borderColor: '#16a34a',
                        top: 4,
                        right: 4
                      }
                    ]}
                  >
                    <Text 
                      size="xs" 
                      color="white" 
                      weight="medium"
                    >
                      {realNotificationCount > 9 ? '9+' : realNotificationCount.toString()}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <ActivePlanBanner />

      {!isConnected && (
        <View 
          style={{
            backgroundColor: '#ef4444',
            paddingVertical: 8,
            paddingHorizontal: 16,
            zIndex: 30,
          }}
        >
          <Text size="sm" color="white" weight="medium" style={{ textAlign: 'center' }}>
            Pas de connexion Internet
          </Text>
        </View>
      )}
    </>
  );
}