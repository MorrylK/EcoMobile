import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { userService } from '@/services/userService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Lock, Shield, Smartphone } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { ActivityIndicator, Modal, ScrollView, TouchableOpacity, View, Switch, Platform } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { useMobileAuth } from '@/lib/mobile-auth';
import * as LocalAuthentication from 'expo-local-authentication';
import { storageUtils, STORAGE_KEYS } from '@/utils/storage';

interface MobileSecurityProps {
  onNavigate: (screen: string) => void;
}

export function MobileSecurity({ onNavigate }: MobileSecurityProps) {
  const { t } = useMobileI18n();
  const { logout } = useMobileAuth();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [biometricAuth, setBiometricAuth] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isBiometricAvailable, setIsBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<string | null>(null);

  // Charge l'état persisté + vérifie la disponibilité biométrique
  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  useEffect(() => {
    if (isBiometricAvailable) {
      storageUtils.getBoolean(STORAGE_KEYS.BIOMETRIC_AUTH).then((val) => {
        setBiometricAuth(val ?? false);
      });
    }
  }, [isBiometricAvailable]);

  const checkBiometricAvailability = async () => {
    // Sur web, on désactive complètement la biométrie
    if (Platform.OS === 'web') {
      setIsBiometricAvailable(false);
      setBiometricAuth(false);
      return;
    }

    try {
      const isAvailable = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      setIsBiometricAvailable(isAvailable && isEnrolled);
      
      if (isAvailable && isEnrolled) {
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
        
        // Détermine le type de biométrie disponible
        if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('Facial Recognition');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('Fingerprint');
        } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('Iris');
        }
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la biométrie:', error);
      setIsBiometricAvailable(false);
    }
  };

  const handleBiometricToggle = async (value: boolean) => {
    // Sur web, on empêche l'activation
    if (Platform.OS === 'web') {
      toast.error(t('security.biometricNotAvailableWeb'));
      return;
    }

    if (!isBiometricAvailable) {
      toast.error(t('security.biometricNotAvailable'));
      return;
    }

    if (value) {
      // Demander l'authentification biométrique pour activer
      try {
        const authResult = await LocalAuthentication.authenticateAsync({
          promptMessage: t('security.authenticateToEnable'),
          fallbackLabel: t('security.usePasscode'),
          disableDeviceFallback: false, // IMPORTANT: permet le fallback vers le code/PIN système
        });

        if (authResult.success) {
          haptics.success();
          await storageUtils.setBoolean(STORAGE_KEYS.BIOMETRIC_AUTH, true);
          setBiometricAuth(true);
          toast.success(t('security.biometricEnabled'));
        } else {
          haptics.error();
          toast.error(t('security.biometricAuthFailed'));
        }
      } catch (error) {
        haptics.error();
        toast.error(t('security.biometricError'));
        console.error('Erreur d\'authentification biométrique:', error);
      }
    } else {
      // Désactiver la biométrie
      haptics.light();
      await storageUtils.setBoolean(STORAGE_KEYS.BIOMETRIC_AUTH, false);
      setBiometricAuth(false);
      toast.info(t('security.biometricDisabled'));
    }
  };

  // Fonction pour tester l'authentification biométrique
  const testBiometricAuth = async () => {
    if (Platform.OS === 'web') {
      toast.error(t('security.biometricNotAvailableWeb'));
      return;
    }

    if (!isBiometricAvailable) {
      toast.error(t('security.biometricNotAvailable'));
      return;
    }

    try {
      const authResult = await LocalAuthentication.authenticateAsync({
        promptMessage: t('security.authenticateToTest'),
        fallbackLabel: t('security.usePasscode'),
        disableDeviceFallback: false, // Permet le fallback automatique
      });

      if (authResult.success) {
        haptics.success();
        toast.success(t('security.biometricTestSuccess'));
      } else {
        haptics.error();
        
        if (authResult.error === 'user_cancel') {
          toast.info(t('security.authenticationCancelled'));
        } else if (authResult.error === 'not_available') {
          toast.error(t('security.biometricNotAvailable'));
        } else {
          toast.error(t('security.biometricAuthFailed'));
        }
      }
    } catch (error) {
      haptics.error();
      toast.error(t('security.biometricError'));
      console.error('Erreur lors du test biométrique:', error);
    }
  };

  const handlePasswordChange = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error(t('security.fillAllFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('security.passwordsNoMatch'));
      return;
    }

    if (newPassword.length < 8) {
      toast.error(t('security.passwordMinLength'));
      return;
    }

    setIsLoading(true);

    try {
      await userService.updatePassword(currentPassword, newPassword);
      
      haptics.success();
      toast.success(t('security.passwordChangeSuccess'));
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      haptics.error();
      
      let errorMessage = t('security.passwordChangeError');
      
      switch (error.message) {
        case 'invalid_credentials':
          errorMessage = t('security.incorrectPassword');
          break;
        case 'same_password':
          errorMessage = t('security.samePassword');
          break;
        case 'network_error':
          errorMessage = t('error.networkError');
          break;
        case 'server_error':
          errorMessage = t('error.serverError');
          break;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setIsLoading(true);

    try {
      await userService.deleteAccount();
      
      haptics.success();
      toast.success(t('security.deleteSuccess'));
      setShowDeleteDialog(false);
      
      // Déconnecter l'utilisateur et rediriger vers le login
      // userService.deleteAccount() appelle déjà authService.logout() qui nettoie le localStorage
      // Mais on doit aussi nettoyer l'état React et rediriger
      setTimeout(() => {
        logout();
      }, 500);
    } catch (error: any) {
      haptics.error();
      
      // Si erreur d'autorisation, déconnecter quand même
      if (error.message === 'unauthorized' || error.message === 'not_authenticated') {
        logout();
        return;
      }
      
      let errorMessage = t('security.deleteError');
      
      switch (error.message) {
        case 'unauthorized':
          errorMessage = t('error.invalidCredentials');
          break;
        case 'network_error':
          errorMessage = t('error.networkError');
          break;
        case 'server_error':
          errorMessage = t('error.serverError');
          break;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[
        styles.px16, 
        styles.py16, 
        styles.row, 
        styles.alignCenter,
        styles.gap12,
        { 
          backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
          borderBottomWidth: 1,
          borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151'
        }
      ]}>
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            onNavigate('profile');
          }}
          style={[
            styles.p8,
            styles.roundedFull,
            { backgroundColor: colorScheme === 'light' ? 'transparent' : '#374151' }
          ]}
        >
          <ArrowLeft size={24} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
        </TouchableOpacity>
        <Text variant="subtitle" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
          {t('security.title')}
        </Text>
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.p24, styles.pb32]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gap24}>
          {/* Password Section */}
          <View style={styles.gap12}>
            <Text 
              size="sm" 
              color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
              style={styles.px8}
            >
              {t('security.password')}
            </Text>
            <View style={[styles.card, styles.rounded12]}>
              {!showPasswordForm ? (
                <View style={[styles.p12, styles.gap12]}>
                  <View style={[styles.row, styles.alignCenter, styles.gap12]}>
                    <View 
                      style={[
                        styles.roundedFull,
                        styles.alignCenter,
                        styles.justifyCenter
                      ]}
                    >
                      <Lock size={20} color="#2563eb" />
                    </View>
                    <View>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.changePassword')}
                      </Text>
                      <Text 
                        size="sm" 
                        color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                      >
                        {t('security.lastChanged')}
                      </Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      haptics.light();
                      setShowPasswordForm(true);
                    }}
                    style={[
                      styles.px12,
                      styles.py12,
                      styles.rounded8,
                      { borderWidth: 1, borderColor: '#d1d5db' }
                    ]}
                  >
                    <Text 
                      variant="body" 
                      color={colorScheme === 'light' ? '#374151' : '#f9fafb'}
                      style={styles.textCenter}
                    >
                      {t('common.change')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.p12}>
                  <View style={styles.gap16}>
                    <View style={styles.gap8}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.currentPassword')}
                      </Text>
                      <View style={{ position: 'relative' }}>
                        <Input
                          value={currentPassword}
                          onChangeText={setCurrentPassword}
                          secureTextEntry={!showCurrentPassword}
                          placeholder={t('security.currentPassword')}
                          style={{ paddingRight: 48 }}
                        />
                        <TouchableOpacity
                          onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                          style={[styles.absolute, { right: 12, top: 14 }]}
                        >
                          {showCurrentPassword ? 
                            <EyeOff size={20} color="#6b7280" /> : 
                            <Eye size={20} color="#6b7280" />
                          }
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.gap8}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.newPassword')}
                      </Text>
                      <View style={{ position: 'relative' }}>
                        <Input
                          value={newPassword}
                          onChangeText={setNewPassword}
                          secureTextEntry={!showNewPassword}
                          placeholder={t('security.newPassword')}
                          style={{ paddingRight: 48 }}
                        />
                        <TouchableOpacity
                          onPress={() => setShowNewPassword(!showNewPassword)}
                          style={[styles.absolute, { right: 12, top: 14 }]}
                        >
                          {showNewPassword ? 
                            <EyeOff size={20} color="#6b7280" /> : 
                            <Eye size={20} color="#6b7280" />
                          }
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={styles.gap8}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.confirmPassword')}
                      </Text>
                      <View style={{ position: 'relative' }}>
                        <Input
                          value={confirmPassword}
                          onChangeText={setConfirmPassword}
                          secureTextEntry={!showConfirmPassword}
                          placeholder={t('security.confirmPassword')}
                          style={{ paddingRight: 48 }}
                        />
                        <TouchableOpacity
                          onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                          style={[styles.absolute, { right: 12, top: 14 }]}
                        >
                          {showConfirmPassword ? 
                            <EyeOff size={20} color="#6b7280" /> : 
                            <Eye size={20} color="#6b7280" />
                          }
                        </TouchableOpacity>
                      </View>
                    </View>

                    <View style={[styles.row, styles.gap8]}>
                      <TouchableOpacity
                        style={[
                          styles.flex1,
                          styles.p12,
                          styles.rounded8,
                          { borderWidth: 1, borderColor: '#d1d5db' }
                        ]}
                        onPress={() => {
                          setShowPasswordForm(false);
                          setCurrentPassword('');
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                      >
                        <Text 
                          style={styles.textCenter}
                          color={colorScheme === 'light' ? '#374151' : '#f9fafb'}
                          weight="medium"
                        >
                          {t('profile.edit.cancel')}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.flex1,
                          styles.p12,
                          styles.rounded8,
                          { backgroundColor: '#16a34a' },
                          isLoading && { opacity: 0.6 }
                        ]}
                        onPress={handlePasswordChange}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="white" />
                        ) : (
                          <Text 
                            style={styles.textCenter}
                            color="white"
                            weight="medium"
                          >
                            {t('profile.edit.save')}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>

          {/* Authentication Methods - SEULEMENT SUR MOBILE */}
          {Platform.OS !== 'web' && (
            <View style={styles.gap12}>
              <Text 
                size="sm" 
                color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                style={styles.px8}
              >
                {t('security.authenticationMethods')}
              </Text>
              <View style={[styles.card, styles.rounded12]}>
                <View style={[
                  styles.row, 
                  styles.alignCenter, 
                  styles.spaceBetween, 
                  styles.p12
                ]}>
                  <View style={[styles.row, styles.alignCenter, styles.gap12]}>
                    <View 
                      style={[
                        styles.roundedFull,
                        styles.alignCenter,
                        styles.justifyCenter
                      ]}
                    >
                      <Shield size={20} color="#4f46e5" />
                    </View>
                    <View>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.twoFactorAuth')}
                      </Text>
                      <Text 
                        size="sm" 
                        color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                      >
                        {t('security.twoFactorDescription')}
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={twoFactorAuth}
                    onValueChange={(value) => {
                      haptics.light();
                      setTwoFactorAuth(value);
                    }}
                    trackColor={{ false: colorScheme === 'light' ? '#d1d5db' : '#4b5563', true: '#16a34a' }}
                    thumbColor="white"
                    ios_backgroundColor={colorScheme === 'light' ? '#d1d5db' : '#4b5563'}
                  />
                </View>

                <View style={{ 
                  height: 1, 
                  backgroundColor: colorScheme === 'light' ? '#f3f4f6' : '#374151',
                  marginHorizontal: 16 
                }} />

                <View style={[
                  styles.row, 
                  styles.alignCenter, 
                  styles.spaceBetween, 
                  styles.p12
                ]}>
                  <View style={[styles.row, styles.alignCenter, styles.gap12]}>
                    <View 
                      style={[
                        styles.roundedFull,
                        styles.alignCenter,
                        styles.justifyCenter
                      ]}
                    >
                      <Smartphone size={20} color="#2563eb" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                      >
                        {t('security.biometricAuth')}
                      </Text>
                      <Text 
                        size="sm" 
                        color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                      >
                        {isBiometricAvailable 
                          ? (biometricType 
                              ? `${t('security.biometricDescription')} (${biometricType})`
                              : t('security.biometricDescription'))
                          : t('security.biometricNotAvailableDescription')}
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Switch
                      value={biometricAuth}
                      onValueChange={handleBiometricToggle}
                      disabled={!isBiometricAvailable}
                      trackColor={{ 
                        false: !isBiometricAvailable 
                          ? '#9ca3af' 
                          : colorScheme === 'light' ? '#d1d5db' : '#4b5563', 
                        true: '#16a34a' 
                      }}
                      thumbColor="white"
                      ios_backgroundColor={colorScheme === 'light' ? '#d1d5db' : '#4b5563'}
                    />
                    {biometricAuth && isBiometricAvailable && (
                      <TouchableOpacity
                        onPress={testBiometricAuth}
                        style={[
                          styles.mt8,
                          styles.px8,
                          styles.py4,
                          styles.rounded4,
                          { backgroundColor: '#2563eb', alignSelf: 'center' }
                        ]}
                      >
                        <Text 
                          size="xs" 
                          color="white"
                          style={styles.textCenter}
                        >
                          {t('security.testBiometric')}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Danger Zone */}
          <View style={styles.gap12}>
            <Text 
              size="sm" 
              color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
              style={styles.px8}
            >
              {t('security.dangerZone')}
            </Text>
            <View style={[
              styles.card, 
              styles.rounded12,
              { borderWidth: 1, borderColor: '#fecaca' }
            ]}>
              <View style={[styles.p12, styles.gap16]}>
                <View style={[styles.row, styles.alignCenter, styles.gap12]}>
                  <View 
                    style={[
                      styles.roundedFull,
                      styles.alignCenter,
                      styles.justifyCenter
                    ]}
                  >
                    <AlertTriangle size={20} color="#dc2626" />
                  </View>
                  <View style={styles.flex1}>
                    <Text 
                      variant="body" 
                      color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                    >
                      {t('security.deleteAccount')}
                    </Text>
                    <Text 
                      size="sm" 
                      color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                    >
                      {t('security.deleteWarning')}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    haptics.light();
                    setShowDeleteDialog(true);
                  }}
                  style={[
                    styles.p12,
                    styles.rounded8,
                    { borderWidth: 1, borderColor: '#dc2626' }
                  ]}
                >
                  <Text 
                    style={styles.textCenter}
                    color="#dc2626"
                    weight="medium"
                  >
                    {t('security.deleteAccount')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Delete Account Dialog */}
      <Modal
        visible={showDeleteDialog}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDeleteDialog(false)}
      >
        <View style={[
          styles.flex1,
          styles.justifyCenter,
          styles.alignCenter,
          { backgroundColor: 'rgba(0, 0, 0, 0.5)' },
          styles.p24
        ]}>
          <View style={[
            styles.card,
            styles.rounded16,
            styles.p24,
            { width: '100%', maxWidth: 400 }
          ]}>
            <Text 
              variant="subtitle" 
              color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              style={styles.mb8}
            >
              {t('security.deleteConfirmTitle')}
            </Text>
            <Text 
              size="sm" 
              color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
              style={styles.mb24}
            >
              {t('security.deleteConfirmDescription')}
            </Text>
            <View style={[styles.row, styles.gap12]}>
              <TouchableOpacity
                style={[
                  styles.flex1,
                  styles.p12,
                  styles.rounded8,
                  styles.alignCenter, 
                  styles.justifyCenter,
                  { borderWidth: 1, borderColor: '#d1d5db' }
                ]}
                onPress={() => setShowDeleteDialog(false)}
              >
                <Text 
                  style={styles.textCenter}
                  color={colorScheme === 'light' ? '#374151' : '#f9fafb'}
                  weight="medium"
                >
                  {t('profile.edit.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.flex1,
                  styles.p12,
                  styles.rounded8,
                  styles.alignCenter, 
                  styles.justifyCenter,
                  { backgroundColor: '#dc2626' }
                ]}
                onPress={handleDeleteAccount}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text 
                    style={styles.textCenter}
                    color="white"
                    weight="medium"
                  >
                    {t('security.deletePermanently')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}