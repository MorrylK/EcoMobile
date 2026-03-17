import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { notificationService } from '@/services/notificationService';
import { userService } from '@/services/userService';
import type { UserStats } from '@/services/userService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { storeLanguage } from '@/utils/storage';
import { Bell, ChevronRight, FileText, Globe, HelpCircle, Info, LogOut, MessageCircle, Shield, User, Wallet, CheckCircle, AlertCircle } from 'lucide-react-native';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { RefreshControl, ScrollView, Switch, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useMobileAuth } from '@/lib/mobile-auth';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/AlertDialog';
import { authService } from '@/services/authService';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { documentService, type DocumentsStatus } from '@/services/documentService';
import { useNotificationSSE } from '@/hooks/useNotificationSSE';

interface MobileProfileProps {
  onNavigate: (screen: string) => void;
}

export default function MobileProfile({ onNavigate }: MobileProfileProps) {
  const { user, logout, refreshUser } = useMobileAuth();
  const { t, language, setLanguage } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const { unreadCount: unreadNotifications } = useNotificationSSE();
  const [isLoading, setIsLoading] = useState(false);
  const [documentsStatus, setDocumentsStatus] = useState<DocumentsStatus | null>(null);
  const isInitialMount = useRef(true);
  const lastLoadTime = useRef<number>(0);
  const isLoadingRef = useRef(false);

  // Charger les données uniquement au montage initial
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      loadProfileData();
    }
  }, []);

  // Recharger les données quand on revient sur la page (avec throttling)
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTime.current;
      const MIN_RELOAD_INTERVAL = 2000; // Minimum 2 secondes entre les rechargements

      if (!isInitialMount.current && timeSinceLastLoad >= MIN_RELOAD_INTERVAL && !isLoadingRef.current) {
        lastLoadTime.current = now;
        loadProfileData();
        // Recharger les données utilisateur depuis l'API
        refreshUser().catch(console.error);
      }
    }, [])
  );

  const loadProfileData = async () => {
    // Éviter les appels multiples simultanés
    if (isLoadingRef.current) {
      return;
    }

    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      
      const [stats, notificationsEnabled, docsStatus] = await Promise.all([
        userService.getStats(),
        notificationService.areNotificationsEnabled(),
        documentService.getDocumentsStatus().catch(() => null)
      ]);

      setUserStats(stats);
      setNotifications(notificationsEnabled);
      setDocumentsStatus(docsStatus);
      
    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  const handleLanguageChange = async (newLanguage: string) => {
    try {
      haptics.light();
      
      if (newLanguage !== 'fr' && newLanguage !== 'en') {
        console.error('Invalid language:', newLanguage);
        return;
      }
      
      setLanguage(newLanguage);
      await storeLanguage(newLanguage);
      
      await userService.updateProfile({ language: newLanguage });
      
      toast.success(t('profile.languageUpdated'));
    } catch (error) {
      console.error('Error updating language:', error);
      toast.error(t('common.error'));
    }
  };

  const handleNotificationsToggle = async (enabled: boolean) => {
    try {
      haptics.light();
      setNotifications(enabled);
      
      await notificationService.updatePreferences({
        pushNotifications: enabled,
        emailNotifications: enabled,
      });
      
      toast.success(enabled ? t('profile.notificationsEnabled') : t('profile.notificationsDisabled'));
    } catch (error) {
      console.error('Error updating notifications:', error);
      setNotifications(!enabled);
      toast.error(t('common.error'));
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogoutDialog(false);
  };

  const menuSections = [
    {
      title: t('profile.sections.account'),
      items: [
        {
          icon: User,
          label: t('profile.editProfile'),
          onPress: () => {
            haptics.light();
            onNavigate('edit-profile');
          },
          color: '#2563eb',
        },
        {
          icon: Wallet,
          label: t('profile.accountManagement'),
          onPress: () => {
            haptics.light();
            onNavigate('account-management');
          },
          color: '#16a34a',
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
        {
          icon: Shield,
          label: t('profile.security'),
          onPress: () => {
            haptics.light();
            onNavigate('security');
          },
          color: '#16a34a',
        },
      ],
    },
    {
      title: t('profile.sections.preferences'),
      items: [
        {
          icon: Globe,
          label: t('profile.language'),
          onPress: () => {
            haptics.light();
          },
          color: '#7c3aed',
          rightElement: (
            <View style={[styles.row, styles.gap8]}>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleLanguageChange('fr');
                }}
                style={[
                  styles.px12,
                  styles.py4,
                  styles.roundedFull,
                  {
                    backgroundColor: language === 'fr' ? '#16a34a' : 
                      colorScheme === 'light' ? '#e5e7eb' : '#374151',
                  }
                ]}
              >
                <Text 
                  size="sm" 
                  color={language === 'fr' ? 'white' : 
                    colorScheme === 'light' ? '#4b5563' : '#9ca3af'}
                >
                  FR
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  handleLanguageChange('en');
                }}
                style={[
                  styles.px12,
                  styles.py4,
                  styles.roundedFull,
                  {
                    backgroundColor: language === 'en' ? '#16a34a' : 
                      colorScheme === 'light' ? '#e5e7eb' : '#374151',
                  }
                ]}
              >
                <Text 
                  size="sm" 
                  color={language === 'en' ? 'white' : 
                    colorScheme === 'light' ? '#4b5563' : '#9ca3af'}
                >
                  EN
                </Text>
              </TouchableOpacity>
            </View>
          ),
        },
        {
          icon: Bell,
          label: t('profile.notifications'),
          onPress: () => {
            haptics.light();
          },
          color: '#d97706',
          rightElement: (
            <Switch
              value={notifications}
              onValueChange={(value) => {
                haptics.light();
                handleNotificationsToggle(value);
              }}
              trackColor={{ false: colorScheme === 'light' ? '#d1d5db' : '#4b5563', true: '#16a34a' }}
              thumbColor="white"
              ios_backgroundColor={colorScheme === 'light' ? '#d1d5db' : '#4b5563'}
            />
          ),
        },
      ],
    },
    {
      title: t('profile.sections.support'),
      items: [
        {
          icon: MessageCircle,
          label: t('profile.chatSupport'),
          onPress: () => {
            haptics.light();
            onNavigate('chat');
          },
          color: '#16a34a',
        },
        {
          icon: HelpCircle,
          label: t('profile.help'),
          onPress: () => {
            haptics.light();
            toast.info(t('profile.helpComingSoon'));
          },
          color: '#ea580c',
        },
        {
          icon: FileText,
          label: t('profile.legal'),
          onPress: () => {
            haptics.light();
            toast.info(t('profile.legalComingSoon'));
          },
          color: '#6b7280',
        },
        {
          icon: Info,
          label: t('profile.appInfo'),
          onPress: () => {
            haptics.light();
            onNavigate('app-info');
          },
          color: '#0ea5e9',
        },
      ],
    },
  ];

  return (
    <View style={styles.container}>
      <MobileHeader 
        title={t('profile.title')} 
        showNotifications
        notificationCount={unreadNotifications}
        onNotifications={() => {
          haptics.light();
          onNavigate('notifications');
        }}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.p24, styles.pb32]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadProfileData}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      >
        {/* Profile Card */}
        <View style={[styles.card, styles.p24, styles.mb24]}>
          <View style={[styles.row, styles.alignCenter, styles.gap16]}>
            <View 
              style={[
                styles.w48,
                styles.h48,
                styles.roundedFull,
                styles.alignCenter,
                styles.justifyCenter,
                { backgroundColor: '#16a34a' }
              ]}
            >
              <Text variant="title" color="white" size="lg">
                {user?.firstName?.[0]}
                {user?.lastName?.[0]}
              </Text>
            </View>
            <View style={styles.flex1}>
              <Text 
                variant="body" 
                color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                style={styles.mb4}
              >
                {user?.firstName} {user?.lastName}
              </Text>
              <Text 
                size="sm" 
                color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                style={styles.mb8}
              >
                {user?.email}
              </Text>
            </View>
          </View>
          <View style={[styles.row, styles.gap8, styles.mt8]}>
            {user?.emailVerified ? (
              <View 
                style={[
                  styles.px8,
                  styles.py4,
                  styles.rounded4,
                  { backgroundColor: '#dcfce7' }
                ]}
              >
                <Text size="xs" color="#166534">
                  ✓ {t('profile.emailVerified')}
                </Text>
              </View>
            ) : (
              <View 
                style={[
                  styles.px8,
                  styles.py4,
                  styles.rounded4,
                  { backgroundColor: '#fef3c7' }
                ]}
              >
                <Text size="xs" color="#92400e">
                  ⚠ {t('profile.emailNotVerified')}
                </Text>
              </View>
            )}
            {user?.phoneVerified ? (
              <View 
                style={[
                  styles.px8,
                  styles.py4,
                  styles.rounded4,
                  { backgroundColor: '#dbeafe' }
                ]}
              >
                <Text size="xs" color="#1e40af">
                  ✓ {t('profile.phoneVerified')}
                </Text>
              </View>
            ) : (
              <View 
                style={[
                  styles.px8,
                  styles.py4,
                  styles.rounded4,
                  { backgroundColor: '#fef3c7' }
                ]}
              >
                <Text size="xs" color="#92400e">
                  ⚠ {t('profile.phoneNotVerified')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Verification Status Card */}
        <Card style={[styles.p24, styles.mb24]}>
          <View style={[styles.row, styles.alignCenter, styles.mb16]}>
            <Shield size={24} color="#16a34a" />
            <Text 
              variant="title" 
              color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              style={styles.ml12}
            >
              {t('profile.verificationStatus')}
            </Text>
          </View>

          {/* Email Verification */}
          <TouchableOpacity
            onPress={!user?.emailVerified ? async () => {
              try {
                haptics.light();
                await authService.resendEmailVerification();
                toast.success(t('auth.email.verificationSent'));
              } catch (error: any) {
                haptics.error();
                toast.error(error.message || t('common.error'));
              }
            } : undefined}
            style={[
              styles.row,
              styles.alignCenter,
              styles.justifyBetween,
              styles.p12,
              styles.mb12,
              styles.rounded8,
              {
                backgroundColor: colorScheme === 'light' ? '#f8fafc' : '#1e293b',
                borderWidth: 1,
                borderColor: colorScheme === 'light' ? '#e2e8f0' : '#334155',
              }
            ]}
          >
            <View style={[styles.row, styles.alignCenter, styles.flex1]}>
              <View style={[
                styles.w12,
                styles.h12,
                styles.roundedFull,
                styles.alignCenter,
                styles.justifyCenter,
                styles.mr12
              ]}>
                {user?.emailVerified ? (
                  <CheckCircle size={20} color="#16a34a" />
                ) : (
                  <AlertCircle size={20} color="#d97706" />
                )}
              </View>
              <View>
                <Text 
                  variant="body" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  weight="medium"
                >
                  {t('profile.emailVerification')}
                </Text>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.mt4}
                >
                  {user?.email}
                </Text>
              </View>
            </View>
            
            <View style={[styles.row, styles.alignCenter, styles.gap8]}>
              {user?.emailVerified ? (
                <Badge variant="default">
                  {t('common.verified')}
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary">
                    {t('common.notVerified')}
                  </Badge>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Phone Verification */}
          <TouchableOpacity
            onPress={!user?.phoneVerified ? () => {
              haptics.light();
              onNavigate('verify-phone');
            } : undefined}
            style={[
              styles.row,
              styles.alignCenter,
              styles.justifyBetween,
              styles.p16,
              styles.mb12,
              styles.rounded8,
              {
                backgroundColor: colorScheme === 'light' ? '#f8fafc' : '#1e293b',
                borderWidth: 1,
                borderColor: colorScheme === 'light' ? '#e2e8f0' : '#334155',
              }
            ]}
          >
            <View style={[styles.row, styles.alignCenter, styles.flex1]}>
              <View style={[
                styles.w12,
                styles.h12,
                styles.roundedFull,
                styles.alignCenter,
                styles.justifyCenter,
                styles.mr12
              ]}>
                {user?.phoneVerified ? (
                  <CheckCircle size={20} color="#16a34a" />
                ) : (
                  <AlertCircle size={20} color="#d97706" />
                )}
              </View>
              <View>
                <Text 
                  variant="body" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  weight="medium"
                >
                  {t('profile.phoneVerification')}
                </Text>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.mt4}
                >
                  {user?.phone || t('profile.noPhoneNumber')}
                </Text>
              </View>
            </View>
            
            <View style={[styles.row, styles.alignCenter, styles.gap8]}>
              {user?.phoneVerified === true ? (
                <Badge variant="default" style={{ minWidth: 80 }}>
                  <Text size="sm" weight="medium" color="white">
                    {t('common.verified')}
                  </Text>
                </Badge>
              ) : (
                <Badge variant="secondary" style={{ minWidth: 80 }}>
                  <Text size="sm" weight="medium" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                    {t('common.notVerified')}
                  </Text>
                </Badge>
              )}
            </View>
          </TouchableOpacity>

          {/* Documents Validation Status */}
          {documentsStatus && !documentsStatus.allDocumentsApproved && (
            <View style={[
              styles.row,
              styles.alignCenter,
              styles.p12,
              styles.mb12,
              styles.rounded8,
              {
                backgroundColor: colorScheme === 'light' ? '#fffbeb' : '#451a03',
                borderWidth: 1,
                borderColor: colorScheme === 'light' ? '#fef3c7' : '#92400e',
              }
            ]}>
              <FileText size={20} color="#d97706" style={styles.mr12} />
              <View style={styles.flex1}>
                <Text 
                  variant="body" 
                  weight="medium"
                  style={{ color: colorScheme === 'light' ? '#92400e' : '#fef3c7' }}
                >
                  {t('profile.documentsPendingValidation')}
                </Text>
                <Text 
                  size="sm" 
                  style={[
                    styles.mt4,
                    { color: colorScheme === 'light' ? '#b45309' : '#fcd34d' }
                  ]}
                >
                  {t('profile.documentsValidationMessage')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    onNavigate('submit-documents');
                  }}
                  style={[styles.mt8, styles.row, styles.alignCenter]}
                >
                  <Text 
                    size="sm" 
                    weight="medium"
                    style={{ color: '#16a34a' }}
                  >
                    {t('profile.viewDocuments')}
                  </Text>
                  <ChevronRight size={16} color="#16a34a" style={styles.ml4} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Account Status Warning */}
          {user?.status === 'pending_verification' && (
            <View style={[
              styles.row,
              styles.alignCenter,
              styles.p12,
              styles.mb12,
              styles.rounded8,
              {
                backgroundColor: colorScheme === 'light' ? '#fffbeb' : '#451a03',
                borderWidth: 1,
                borderColor: colorScheme === 'light' ? '#fef3c7' : '#92400e',
              }
            ]}>
              <AlertCircle size={20} color="#d97706" style={styles.mr12} />
              <View style={styles.flex1}>
                <Text 
                  variant="body" 
                  weight="medium"
                  style={{ color: colorScheme === 'light' ? '#92400e' : '#fef3c7' }}
                >
                  {t('profile.accountPendingVerification')}
                </Text>
                <Text 
                  size="sm" 
                  style={[
                    styles.mt4,
                    { color: colorScheme === 'light' ? '#b45309' : '#fcd34d' }
                  ]}
                >
                  {t('profile.submitDocumentsToActivate')}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    onNavigate('submit-documents');
                  }}
                  style={[styles.mt8, styles.row, styles.alignCenter]}
                >
                  <Text 
                    size="sm" 
                    weight="medium"
                    style={{ color: '#16a34a' }}
                  >
                    {t('profile.submitDocuments')}
                  </Text>
                  <ChevronRight size={16} color="#16a34a" style={styles.ml4} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Card>

        {/* Menu Sections */}
        <View style={styles.gap24}>
          {menuSections.map((section) => (
            <View key={section.title}>
              <Text 
                size="sm" 
                color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                style={[styles.mb12, styles.px8]}
              >
                {section.title}
              </Text>
              <View style={[styles.card, styles.rounded12]}>
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.label}
                      onPress={item.onPress}
                      style={[
                        styles.row,
                        styles.alignCenter,
                        styles.gap12,
                        styles.p16,
                        index > 0 && {
                          borderTopWidth: 1,
                          borderTopColor: colorScheme === 'light' ? '#f3f4f6' : '#374151'
                        }
                      ]}
                    >
                      <View 
                        style={[
                          styles.roundedFull,
                          styles.alignCenter,
                          styles.justifyCenter
                        ]}
                      >
                        <Icon size={20} color={item.color} />
                      </View>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                        style={styles.flex1}
                      >
                        {item.label}
                      </Text>
                      {('rightElement' in item) ? item.rightElement : <ChevronRight size={20} color="#9ca3af" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        {/* Stats */}
        {userStats && (
          <View 
            style={[
              styles.card, 
              styles.p24, 
              styles.mt24,
              { 
                backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d',
              }
            ]}
          >
            <Text 
              variant="body" 
              color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              style={styles.mb16}
            >
              {t('profile.yourStats')}
            </Text>
            <View style={[styles.row, styles.gap16]}>
              <View style={[styles.flex1, styles.alignCenter]}>
                <Text 
                  variant="title" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  style={styles.mb4}
                >
                  {userStats.rides?.total || 0}
                </Text>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.textCenter}
                >
                  {t('profile.stats.rides')}
                </Text>
              </View>
              <View style={[styles.flex1, styles.alignCenter]}>
                <Text 
                  variant="title" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  style={styles.mb4}
                >
                  {(userStats.rides?.totalDistance || 0).toFixed(1)}
                </Text>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.textCenter}
                >
                  {t('profile.stats.km')}
                </Text>
              </View>
              <View style={[styles.flex1, styles.alignCenter]}>
                <Text 
                  variant="title" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  style={styles.mb4}
                >
                  {(userStats.carbonSaved || 0).toFixed(1)}
                </Text>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.textCenter}
                >
                  {t('profile.stats.carbonSaved')}
                </Text>
              </View>
            </View>
            {userStats.averageRating > 0 && (
              <View style={[styles.row, styles.alignCenter, styles.justifyCenter, styles.mt16]}>
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={styles.mr8}
                >
                  {t('profile.stats.averageRating')}:
                </Text>
                <Text 
                  variant="body" 
                  color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  weight="medium"
                >
                  {`${t('profile.stats.rating')}: ${(userStats.averageRating || 0).toFixed(1)}`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Logout Button */}
        <Button
          onPress={() => {
            haptics.light();
            setShowLogoutDialog(true);
          }}
          variant="outline"
          style={[
            styles.mt24,
            styles.mb16,
            {
              borderColor: '#fca5a5',
              backgroundColor: 'transparent',
            }
          ]}
        >
          <View style={[styles.row, styles.alignCenter, styles.justifyCenter]}>
            <LogOut size={20} color="#dc2626" style={styles.mr8} />
            <Text color="#dc2626" weight="medium">
              {t('auth.logout')}
            </Text>
          </View>
        </Button>

        {/* Version */}
        <Text 
          size="sm" 
          color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'}
          style={styles.textCenter}
        >
          {t('profile.version')} 1.0.0
        </Text>
      </ScrollView>

      {/* Logout Confirmation Dialog */}
      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('profile.logoutConfirm.title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('profile.logoutConfirm.description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onPress={() => setShowLogoutDialog(false)}
            >
              {t('common.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onPress={handleLogout}
              style={{ backgroundColor: '#dc2626' }}
            >
              {t('auth.logout')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </View>
  );
}