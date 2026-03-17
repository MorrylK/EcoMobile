/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, ChevronRight, Edit, FileText, Mail, Save, User, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { useMobileAuth } from '@/lib/mobile-auth';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { useRouter } from 'expo-router';

interface MobileEditProfileProps {
  onNavigate: (screen: string) => void;
}

export default function MobileEditProfile({ onNavigate }: MobileEditProfileProps) {
  const { user, updateProfile, refreshUser } = useMobileAuth();
  const { t } = useMobileI18n();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBase64, setSelectedImageBase64] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const [originalData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  const handleSubmit = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      toast.error(t('profile.edit.fillRequiredFields'));
      return;
    }

    setIsLoading(true);

    try {
      await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
      });
      
      await refreshUser();
      
      haptics.success();
      toast.success(t('profile.edit.updateSuccess'));
      setIsEditing(false);
    } catch (error: any) {
      haptics.error();
      
      let errorMessage = t('profile.edit.updateError');
      
      switch (error.message) {
        case 'invalid_data':
          errorMessage = t('error.invalidData');
          break;
        case 'user_already_exists':
          errorMessage = t('error.userAlreadyExists');
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

  const handleCancel = () => {
    setFormData(originalData);
    setIsEditing(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getInitials = () => {
    return `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase();
  };

  const openImagePicker = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        toast.error(t('profile.edit.galleryPermissionDenied'));
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.uri) {
          setSelectedImage(asset.uri);
          setSelectedImageBase64(asset.base64 || null);
          setShowImageModal(true);
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      toast.error(t('profile.edit.photoSelectionError'));
    }
  };

  const confirmImageChange = async () => {
    if (!selectedImageBase64 || !selectedImage) return;

    setIsUploadingImage(true);
    try {
      const { authService } = await import('@/services/authService');
      const { API_CONFIG } = await import('@/lib/api/config');
      const token = await authService.getToken();

      // Determine mime type from URI
      const ext = selectedImage.split('.').pop()?.toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
      const dataUri = `data:${mime};base64,${selectedImageBase64}`;

      // Upload image via chat attachments endpoint
      const uploadResponse = await fetch(`${API_CONFIG.BASE_URL}/chat/attachments`, {
        method: 'POST',
        headers: { ...API_CONFIG.HEADERS, Authorization: `Bearer ${token}` },
        body: JSON.stringify({ base64: dataUri }),
      });

      const uploadResult = await uploadResponse.json() as { success: boolean; data: { url: string } };
      if (!uploadResult.success) throw new Error('upload_failed');

      const avatarUrl: string = uploadResult.data.url;

      // Save avatar URL to user profile
      await updateProfile({ avatar: avatarUrl } as any);
      await refreshUser();

      haptics.success();
      toast.success(t('profile.edit.photoUpdated'));
      setShowImageModal(false);
      setSelectedImage(null);
      setSelectedImageBase64(null);
    } catch (error) {
      haptics.error();
      toast.error(t('profile.edit.photoUploadError'));
    } finally {
      setIsUploadingImage(false);
    }
  };

  const cancelImageChange = () => {
    setSelectedImage(null);
    setSelectedImageBase64(null);
    setShowImageModal(false);
  };

  const showImageSourceOptions = () => {
    haptics.light();
    openImagePicker();
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View 
        style={[
          styles.px16, 
          styles.py16, 
          styles.row, 
          styles.alignCenter,
          styles.spaceBetween,
          { 
            backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
            borderBottomWidth: 1,
            borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151'
          }
        ]}
      >
        <View style={[styles.row, styles.alignCenter, styles.gap12]}>
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
          <Text 
            variant="subtitle" 
            color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
          >
            {t('profile.edit.title')}
          </Text>
        </View>
        
        {!isEditing && (
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setIsEditing(true);
            }}
            style={[
              styles.p8,
              styles.roundedFull,
              { backgroundColor: '#16a34a' }
            ]}
          >
            <Edit size={20} color="white" />
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContentPadded, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.gap24}>
          {/* Profile Picture */}
          <View style={[styles.alignCenter, styles.gap8]}>
            <View style={{ position: 'relative' }}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage }}
                  style={[
                    styles.w96,
                    styles.h96,
                    styles.rounded32
                  ]}
                  resizeMode="cover"
                />
              ) : (
                <View 
                  style={[
                    styles.w96,
                    styles.h96,
                    styles.rounded32,
                    styles.alignCenter,
                    styles.justifyCenter,
                    { backgroundColor: '#16a34a' }
                  ]}
                >
                  <Text variant="title" color="white" size="xl">
                    {getInitials()}
                  </Text>
                </View>
              )}
              <TouchableOpacity
                onPress={showImageSourceOptions}
                style={[
                  styles.absolute,
                  styles.w32,
                  styles.h32,
                  styles.rounded16,
                  styles.alignCenter,
                  styles.justifyCenter,
                  { 
                    backgroundColor: '#16a34a',
                    bottom: 0,
                    right: 0,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.25,
                    shadowRadius: 4,
                    elevation: 5
                  }
                ]}
              >
                <Camera size={16} color="white" />
              </TouchableOpacity>
            </View>
            <Text 
              size="sm" 
              color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
            >
              {t('profile.edit.changePhoto')}
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.gap16}>
            {/* First Name & Last Name Row */}
            <View style={[styles.row, styles.gap12]}>
              <View style={styles.flex1}>
                <View style={styles.gap8}>
                  <Text 
                    variant="body" 
                    color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  >
                    {t('profile.edit.firstName')}
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <User 
                      size={20} 
                      color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} 
                      style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
                    />
                    <Input
                      value={formData.firstName}
                      onChangeText={(value) => handleChange('firstName', value)}
                      style={{ paddingLeft: 40 }}
                      editable={isEditing}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.flex1}>
                <View style={styles.gap8}>
                  <Text 
                    variant="body" 
                    color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  >
                    {t('profile.edit.lastName')}
                  </Text>
                  <View style={{ position: 'relative' }}>
                    <User 
                      size={20} 
                      color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} 
                      style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
                    />
                    <Input
                      value={formData.lastName}
                      onChangeText={(value) => handleChange('lastName', value)}
                      style={{ paddingLeft: 40 }}
                      editable={isEditing}
                    />
                  </View>
                </View>
              </View>
            </View>

            {/* Email */}
            <View style={styles.gap8}>
              <Text 
                variant="body" 
                color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              >
                {t('profile.edit.email')}
              </Text>
              <View style={{ position: 'relative' }}>
                <Mail 
                  size={20} 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} 
                  style={{ position: 'absolute', left: 12, top: 14, zIndex: 1 }}
                />
                <Input
                  value={formData.email}
                  onChangeText={(value) => handleChange('email', value)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ paddingLeft: 40 }}
                  editable={isEditing}
                />
              </View>
              {user?.verificationStatus?.email && (
                <View style={[styles.row, styles.alignCenter, styles.gap4]}>
                  <Text size="xs" color="#16a34a">✓</Text>
                  <Text size="xs" color="#16a34a">
                    {t('profile.edit.emailVerified')}
                  </Text>
                </View>
              )}
            </View>

            {/* Phone */}
            <View style={styles.gap8}>
              <Text 
                variant="body" 
                color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              >
                {t('profile.edit.phone')}
              </Text>
              <View style={{ position: 'relative' }}>
                <PhoneInput
                  value={formData.phone}
                  onChangeText={(value) => handleChange('phone', value)}
                  placeholder={t('placeholder.phone')}
                  defaultCountry="CM"
                  disabled={!isEditing}
                />
              </View>
              {user?.verificationStatus?.phone && (
                <View style={[styles.row, styles.alignCenter, styles.gap4]}>
                  <Text size="xs" color="#16a34a">✓</Text>
                  <Text size="xs" color="#16a34a">
                    {t('profile.edit.phoneVerified')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          {isEditing && (
            <View style={[styles.column, styles.gap12, styles.pt16]}>
              <Button
                variant="outline"
                onPress={() => {
                  haptics.light();
                  handleCancel();
                }}
                fullWidth
                style={{ height: 48 }}
              >
                {t('profile.edit.cancel')}
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={isLoading}
                fullWidth
                style={{
                  backgroundColor: '#16a34a',
                  height: 48
                }}
              >
                <View style={[styles.row, styles.alignCenter, styles.gap8]}>
                  <Save size={20} color="white" />
                  <Text color="white">
                    {isLoading
                      ? t('profile.edit.saving')
                      : t('profile.edit.save')}
                  </Text>
                </View>
              </Button>
            </View>
          )}

          {/* Documents personnels */}
          <View
            style={[
              styles.pt16,
              {
                borderTopWidth: 1,
                borderTopColor: colorScheme === 'light' ? '#e5e7eb' : '#374151',
                marginTop: 8
              }
            ]}
          >
            <Text
              variant="body"
              color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              style={styles.mb12}
            >
              {t('profile.edit.documents') || 'Documents personnels'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                haptics.light();
                router.push('/(auth)/submit-documents');
              }}
              style={[
                styles.row,
                styles.alignCenter,
                styles.spaceBetween,
                styles.p16,
                styles.rounded12,
                {
                  backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#1f2937',
                  borderWidth: 1,
                  borderColor: colorScheme === 'light' ? '#e5e7eb' : '#374151'
                }
              ]}
            >
              <View style={[styles.row, styles.alignCenter, styles.gap12]}>
                <View
                  style={[
                    styles.w40,
                    styles.h40,
                    styles.rounded20,
                    styles.alignCenter,
                    styles.justifyCenter,
                    { backgroundColor: '#eff6ff' }
                  ]}
                >
                  <FileText size={20} color="#3b82f6" />
                </View>
                <View>
                  <Text
                    variant="body"
                    color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                  >
                    {t('profile.edit.updateDocuments') || 'Mettre à jour mes documents'}
                  </Text>
                  <Text
                    size="xs"
                    color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  >
                    {t('profile.edit.documentsHint') || 'Pièce d\'identité, justificatif de domicile...'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Image Preview Modal */}
      <Modal
        visible={showImageModal}
        animationType="slide"
        transparent={true}
        onRequestClose={cancelImageChange}
      >
        <View style={[
          styles.flex1,
          styles.justifyCenter,
          styles.alignCenter,
          { backgroundColor: 'rgba(0, 0, 0, 0.8)' },
          styles.p24
        ]}>
          <View style={[
            styles.card,
            styles.rounded16,
            styles.p24,
            { width: '100%', maxWidth: 400 }
          ]}>
            <View style={[styles.row, styles.alignCenter, styles.spaceBetween, styles.mb16]}>
              <Text 
                variant="subtitle" 
                color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
              >
                {t('profile.edit.preview')}
              </Text>
              <TouchableOpacity
                onPress={cancelImageChange}
                style={[
                  styles.p8,
                  styles.roundedFull,
                  { backgroundColor: colorScheme === 'light' ? '#f3f4f6' : '#374151' }
                ]}
              >
                <X size={20} color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} />
              </TouchableOpacity>
            </View>

            {selectedImage && (
              <View style={[styles.alignCenter, styles.mb24]}>
                <Image
                  source={{ uri: selectedImage }}
                  style={[
                    styles.w64,
                    styles.h64,
                    styles.rounded16
                  ]}
                  resizeMode="cover"
                />
                <Text 
                  size="sm" 
                  color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                  style={[styles.textCenter, styles.mt12]}
                >
                  {t('profile.edit.previewDescription')}
                </Text>
              </View>
            )}

            <Text 
              size="sm" 
              color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
              style={[styles.textCenter, styles.mb24]}
            >
              {t('profile.edit.confirmImage')}
            </Text>

            <View style={[styles.row, styles.gap12]}>
              <TouchableOpacity
                style={[
                  styles.flex1,
                  styles.p12,
                  styles.rounded8,
                  { borderWidth: 1, borderColor: '#d1d5db' }
                ]}
                onPress={cancelImageChange}
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
                  { backgroundColor: isUploadingImage ? '#6b7280' : '#16a34a' }
                ]}
                onPress={confirmImageChange}
                disabled={isUploadingImage}
              >
                <Text
                  style={styles.textCenter}
                  color="white"
                  weight="medium"
                >
                  {isUploadingImage ? t('common.loading') : t('profile.edit.confirm')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}