/* eslint-disable react-hooks/exhaustive-deps */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { Textarea } from '@/components/ui/Textarea';
import { toast } from '@/components/ui/Toast';
import { VerticalSlider } from '@/components/ui/VerticalSlider';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { subscriptionService } from '@/services/subscriptionService';
import { bikeRequestService } from '@/services/bikeRequestService';
import { InternetStatusBar } from '@/components/ui/InternetStatusBar';
import * as ImagePicker from 'expo-image-picker';
import { AlertTriangle, ArrowLeft, CheckCheck, XCircle } from 'lucide-react-native';
import React, { useState, useEffect } from 'react';
import { ScrollView, TouchableOpacity, View, Alert, Image, Platform, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';

interface MobileBikeInspectionProps {
  bikeId: string;
  bikeName: string;
  inspectionType: 'pickup' | 'return';
  bikeEquipment?: string[];
  onNavigate?: (route: string, params?: any) => void;
  onComplete: (data: InspectionData | { type: string; data: InspectionData }) => void;
  onBack: () => void;
}

interface InspectionData {
  condition: string;
  issues: string[];
  notes: string;
  photos: string[];
  metadata?: {
    inspection: {
      type: 'pickup' | 'return';
      condition: string;
      issues: string[];
      notes: string;
      photos: string[];
      inspectedAt: string;
      hasIssues: boolean;
    };
    paymentMethod: string;
  };
}

interface InspectionItem {
  id: string;
  label: { fr: string; en: string };
  value: number | null;   // 0-100 % ; null = non évalué
  required: false;        // rien n'est obligatoire
}

export function MobileBikeInspection({ bikeId, bikeName, inspectionType, bikeEquipment, onComplete, onBack }: MobileBikeInspectionProps) {
  const { t, language } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);

  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [inspectionItems, setInspectionItems] = useState<InspectionItem[]>([]);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    loadCurrentSubscription();
    initializeInspectionItems();
    
    // Écouteurs pour le clavier
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const loadCurrentSubscription = async () => {
    try {
      setIsLoading(true);
      const subscription = await subscriptionService.getCurrentSubscription();
      setCurrentSubscription(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
      setCurrentSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  const initializeInspectionItems = () => {
    const equipmentLabels: Record<string, { fr: string; en: string }> = {
      headlight: { fr: 'Phares avant', en: 'Headlight' },
      taillight: { fr: 'Feu arrière', en: 'Taillight' },
      basket: { fr: 'Panier', en: 'Basket' },
      rack: { fr: 'Porte-bagages', en: 'Rack' },
      bell: { fr: 'Sonnette', en: 'Bell' },
      mudguards: { fr: 'Garde-boue', en: 'Mudguards' },
      lock: { fr: 'Antivol', en: 'Lock' },
      reflectors: { fr: 'Réflecteurs', en: 'Reflectors' },
      display: { fr: 'Écran de contrôle', en: 'Control Display' },
      accelerator: { fr: 'Accélérateur', en: 'Accelerator' },
      pedalSensor: { fr: 'Capteur de pédale', en: 'Pedal Sensor' },
      kickstand: { fr: 'Béquille', en: 'Kickstand' },
      frontWheel: { fr: 'Roue avant', en: 'Front Wheel' },
      rearWheel: { fr: 'Roue arrière', en: 'Rear Wheel' },
      motor: { fr: 'Moteur', en: 'Motor' },
      controllerBox: { fr: 'Boîte contrôleur', en: 'Controller Box' },
      pedal: { fr: 'Pédale', en: 'Pedal' },
      brakeLever: { fr: 'Levier de frein', en: 'Brake Lever' },
    };

    const makeItem = (id: string, label: { fr: string; en: string }): InspectionItem =>
      ({ id, label, value: null, required: false });

    const requiredItems: InspectionItem[] = [
      makeItem('brakes',        { fr: 'Freins', en: 'Brakes' }),
      makeItem('tires',         { fr: 'Pneus', en: 'Tires' }),
      makeItem('battery',       { fr: 'Batterie', en: 'Battery' }),
      makeItem('chain',         { fr: 'Chaîne', en: 'Chain' }),
      makeItem('frontWheel',    equipmentLabels.frontWheel),
      makeItem('rearWheel',     equipmentLabels.rearWheel),
      makeItem('motor',         equipmentLabels.motor),
      makeItem('controllerBox', equipmentLabels.controllerBox),
      makeItem('pedal',         equipmentLabels.pedal),
    ];

    const optionalItems: InspectionItem[] = [
      makeItem('seat',        { fr: 'Selle', en: 'Seat' }),
      makeItem('handlebars',  { fr: 'Guidon', en: 'Handlebars' }),
      makeItem('frame',       { fr: 'Cadre', en: 'Frame' }),
      makeItem('headlight',   equipmentLabels.headlight),
      makeItem('display',     equipmentLabels.display),
      makeItem('accelerator', equipmentLabels.accelerator),
      makeItem('brakeLever',  equipmentLabels.brakeLever),
      makeItem('pedalSensor', equipmentLabels.pedalSensor),
      makeItem('kickstand',   equipmentLabels.kickstand),
      makeItem('basket',      equipmentLabels.basket),
    ];

    const equipmentItems: InspectionItem[] = (bikeEquipment || []).map(equipId =>
      makeItem(equipId, equipmentLabels[equipId] || { fr: equipId, en: equipId })
    );

    setInspectionItems([...requiredItems, ...optionalItems, ...equipmentItems]);
  };

  const updateInspectionItem = (id: string, value: number) => {
    setInspectionItems(items =>
      items.map(item => item.id === id ? { ...item, value } : item)
    );
  };

  const setAllItems = (value: number) => {
    haptics.medium();
    setInspectionItems(items => items.map(item => ({ ...item, value })));
  };

  const showPhotoOptions = () => {
    const isWeb = Platform.OS === 'web';
      
    if (isWeb) {
      handleAddPhoto('library');
    } else {
      Alert.alert(
        t('inspection.addPhoto'),
        t('inspection.photoSource'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('inspection.camera'), onPress: () => handleAddPhoto('camera') },
          { text: t('inspection.gallery'), onPress: () => handleAddPhoto('library') }
        ]
      );
    }
  };

  const handleAddPhoto = async (source: 'camera' | 'library') => {
    if (photos.length >= 5) {
      haptics.error();
      toast.error('inspection.maxPhotos');
      return;
    }

    try {
      haptics.light();

      const isWeb = Platform.OS === 'web';

      if (isWeb && source === 'library') {
        if (typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).window.document !== 'undefined') {
          const window = (globalThis as any).window;
          const input = window.document.createElement('input') as any;
          input.type = 'file';
          input.accept = 'image/*';
          input.multiple = false;
          input.onchange = (event: Event) => {
            const target = event.target as any;
            const files = target.files;
            if (files && files[0]) {
              const file = files[0] as File;
              
              const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
              if (!validImageTypes.includes(file.type)) {
                toast.error('inspection.invalidImageFormat');
                return;
              }
              
              const maxSize = 5 * 1024 * 1024;
              if (file.size > maxSize) {
                toast.error('inspection.imageTooLarge');
                return;
              }
              
              const reader = new FileReader();
              reader.onload = (e) => {
                const base64 = e.target?.result as string;
                const newPhotos = [...photos, base64];
                setPhotos(newPhotos);
              };
              reader.readAsDataURL(file);
            }
          };
          input.click();
        } else {
          toast.error('inspection.webFileUploadNotSupported');
        }
        return;
      }
      
      if (source === 'camera') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          toast.error('inspection.cameraPermissionDenied');
          return;
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          toast.error('inspection.galleryPermissionDenied');
          return;
        }
      }

      const options = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3] as [number, number],
        quality: 0.8,
        base64: true,
      };

      let result;
      if (source === 'camera') {
        result = await ImagePicker.launchCameraAsync(options);
      } else {
        result = await ImagePicker.launchImageLibraryAsync(options);
      }

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        
        if (asset.fileSize) {
          const maxSize = 5 * 1024 * 1024;
          if (asset.fileSize > maxSize) {
            toast.error('inspection.imageTooLarge');
            return;
          }
        }
        
        let photoData;
        if (asset.base64) {
          photoData = `data:image/jpeg;base64,${asset.base64}`;
        } else {
          photoData = asset.uri;
        }
        
        const newPhotos = [...photos, photoData];
        setPhotos(newPhotos);
      }
      
    } catch (error) {
      console.error('Erreur lors de la capture de photo:', error);
      toast.error('inspection.photoError');
    }
  };

  const handleRemovePhoto = (index: number) => {
    haptics.light();
    const newPhotos = photos.filter((_, i) => i !== index);
    setPhotos(newPhotos);
  };

  const handleComplete = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Éléments évalués
      const evaluated = inspectionItems.filter(item => item.value !== null);
      // Éléments en mauvais état (≤ 30%)
      const badItems = evaluated.filter(item => (item.value ?? 100) <= 30);
      // Éléments dégradés (31-69%)
      const degradedItems = evaluated.filter(item => {
        const v = item.value ?? 100;
        return v > 30 && v <= 69;
      });

      const hasIssues = badItems.length > 0 || degradedItems.length > 0;
      const hasCriticalIssues = badItems.length > 0;
      const overallCondition = hasCriticalIssues ? 'damaged' : hasIssues ? 'acceptable' : 'good';

      // Construire la liste des éléments avec leur score pour l'admin
      const itemScores = inspectionItems
        .filter(item => item.value !== null)
        .map(item => ({
          id: item.id,
          label: item.label[language],
          value: item.value,
          state: (item.value ?? 100) <= 30 ? 'bad' : (item.value ?? 100) <= 69 ? 'degraded' : 'good',
        }));

      const allIssues = [...badItems, ...degradedItems].map(item => item.label[language]);

      const inspectionData = {
        condition: overallCondition,
        issues: allIssues,
        notes,
        photos,
        metadata: {
          inspection: {
            type: inspectionType,
            condition: overallCondition,
            issues: allIssues,
            itemScores,            // ← envoyé à l'admin
            notes,
            photos,
            inspectedAt: new Date().toISOString(),
            hasIssues,
            hasCriticalIssues,
          },
          paymentMethod: currentSubscription ? 'SUBSCRIPTION' : 'WALLET',
        },
      };

      if (inspectionType === 'pickup') {
        await bikeRequestService.createUnlockRequest(bikeId, inspectionData.metadata);
        
        haptics.success();
        toast.success(t('unlock.requestSent'));
        onComplete({type: 'unlock_request_sent', data: inspectionData});
      } else {
        onComplete(inspectionData);
      }
      
    } catch (error: any) {
      haptics.error();
      toast.error(error.message || 'common.error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const requiredItems = inspectionItems.slice(0, 9);  // les 9 éléments principaux
  const optionalItems = inspectionItems.slice(9);

  const evaluatedCount = inspectionItems.filter(item => item.value !== null).length;
  const totalCount = inspectionItems.length;
  const allInspected = evaluatedCount === totalCount;
  
  const badItems = inspectionItems.filter(item => item.value !== null && item.value <= 30);
  const hasAnyIssues = badItems.length > 0 || inspectionItems.some(item => item.value !== null && item.value <= 69 && item.value > 30);

  // Fonction pour cacher le clavier
  const dismissKeyboard = () => {
    if (isKeyboardVisible) {
      Keyboard.dismiss();
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.flex1} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
    >
      <View style={styles.container}>
        {/* Header */}
        <View 
          style={[
            styles.p16,
            styles.shadowLg,
            { 
              backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
              borderBottomWidth: 1,
              borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151'
            }
          ]}
        >
          <View style={[styles.row, styles.alignCenter, styles.gap16]}>
            <TouchableOpacity 
              onPress={() => {
                haptics.light();
                onBack();
              }}
              style={[styles.p8, styles.rounded8]}
              accessibilityLabel={t('common.back')}
            >
              <ArrowLeft size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
            </TouchableOpacity>
            <View style={styles.flex1}>
              <Text variant="subtitle" color="#16a34a">
                {t(`inspection.title.${inspectionType}`)}
              </Text>
              <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                {bikeName}
              </Text>
              {currentSubscription && (
                <Text size="xs" color="#3b82f6" style={styles.mt4}>
                  {t('subscription.activePlan')}: {currentSubscription.planName}
                </Text>
              )}
            </View>
          </View>
        </View>
        
        {/* Barre de connexion Internet */}
        <InternetStatusBar position="top" />

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContentPadded, styles.gap16]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          onScrollBeginDrag={dismissKeyboard}
          onTouchStart={dismissKeyboard}
          scrollEventThrottle={16}
        >
          {/* Info Alert */}
          <Card style={[styles.p16, { backgroundColor: colorScheme === 'light' ? '#1e40af' : '#1e3a8a', borderColor: '#3b82f6' }]}>
            <View style={[styles.row, styles.gap12]}>
              <AlertTriangle size={20} color="#fbbf24" style={{ marginTop: 2 }} />
              <View style={styles.flex1}>
                <Text size="sm" color="#fbbf24" style={{ fontWeight: 'bold' }}>
                  {t(`inspection.description.${inspectionType}`)}
                </Text>
                <Text size="xs" color="#fef3c7" style={styles.mt4}>
                  {inspectionType === 'pickup' 
                    ? t('inspection.description.pickupDetail')
                    : t('inspection.description.returnDetail')
                  }
                </Text>
              </View>
            </View>
          </Card>

          {/* Inspection Items — sliders verticaux */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <Card style={styles.p16}>
              <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb12]}>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                  {t('inspection.checkItems')}
                </Text>
                {/* Boutons Tout OK / Tout NOK */}
                <View style={[styles.row, styles.gap8]}>
                  <TouchableOpacity
                    onPress={() => setAllItems(100)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 8, paddingVertical: 4,
                      backgroundColor: '#dcfce7', borderRadius: 6,
                    }}
                  >
                    <CheckCheck size={12} color="#16a34a" />
                    <Text size="xs" style={{ color: '#15803d', fontWeight: '600' }}>Tout OK</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setAllItems(0)}
                    style={{
                      flexDirection: 'row', alignItems: 'center', gap: 4,
                      paddingHorizontal: 8, paddingVertical: 4,
                      backgroundColor: '#fee2e2', borderRadius: 6,
                    }}
                  >
                    <XCircle size={12} color="#ef4444" />
                    <Text size="xs" style={{ color: '#dc2626', fontWeight: '600' }}>Tout NOK</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb12}>
                Glissez chaque barre pour indiquer l'état (0 % = hors service, 100 % = parfait)
              </Text>

              {/* Grille de sliders */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                {inspectionItems.map((item) => (
                  <VerticalSlider
                    key={item.id}
                    label={item.label[language]}
                    value={item.value}
                    onChange={(v) => updateInspectionItem(item.id, v)}
                    height={110}
                    colorScheme={colorScheme}
                  />
                ))}
              </View>
            </Card>
          </TouchableWithoutFeedback>

          {/* Progress */}
          <Card style={styles.p16}>
            <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
              <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                {t('inspection.progress')}
              </Text>
              <Text size="sm" color={colorScheme === 'light' ? '#4b5563' : '#9ca3af'}>
                {evaluatedCount}/{totalCount} {allInspected ? '✓' : ''}
              </Text>
            </View>
            <View style={[styles.wT100, { height: 6 }, styles.rounded4, { backgroundColor: colorScheme === 'light' ? '#e5e7eb' : '#4b5563' }]}>
              <View style={[{ height: 6 }, styles.rounded4, { backgroundColor: '#16a34a', width: `${(evaluatedCount / Math.max(totalCount, 1)) * 100}%` }]} />
            </View>
            {hasAnyIssues && (
              <View style={[styles.row, styles.gap8, { marginTop: 8 }]}>
                <AlertTriangle size={14} color="#f59e0b" />
                <Text size="xs" color="#f59e0b">
                  {badItems.length} élément(s) en mauvais état
                </Text>
              </View>
            )}
          </Card>

          {/* Notes (toujours visibles) */}
          <TouchableWithoutFeedback onPress={dismissKeyboard}>
            <Card style={styles.p16}>
              <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb8}>
                Commentaires (optionnel)
              </Text>
              <Textarea
                value={notes}
                onChangeText={setNotes}
                placeholder="Décrivez les problèmes observés ou toute remarque utile…"
                style={styles.mt8}
                multiline
                numberOfLines={3}
                onFocus={() => setIsKeyboardVisible(true)}
                onBlur={() => setIsKeyboardVisible(false)}
              />
                )}
                {!hasRequiredIssues && hasAnyIssues && notes.trim() && (
                  <Text size="xs" color="#16a34a" style={styles.mt4}>
                    {t('inspection.thanksForFeedback')}
                  </Text>
                )}
              </Card>
            </TouchableWithoutFeedback>
          )}

          {/* Photos */}
          {allInspected && (
            <Card style={styles.p16}>
              <Label>{t('inspection.photos')} {hasAnyIssues && `(${t('inspection.recommended')})`}</Label>
              <Text size="xs" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={[styles.mt4, styles.mb12]}>
                {hasRequiredIssues 
                  ? t('inspection.photosRequiredCritical')
                  : (hasAnyIssues 
                      ? t('inspection.photosRecommended')
                      : t('inspection.photosOptional')
                    )}
              </Text>
              
              {/* Photo Grid */}
              <View style={[styles.row, { flexWrap: 'wrap' }, styles.gap8, styles.mb12]}>
                {photos.map((photo, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.relative,
                      { width: 100, height: 100 },
                      styles.rounded8,
                      styles.alignCenter,
                      styles.justifyCenter,
                      { backgroundColor: colorScheme === 'light' ? '#f3f4f6' : '#374151' }
                    ]}
                  >
                    {photo ? (
                      <Image
                        source={{ uri: photo }}
                        style={[
                          styles.wT100,
                          styles.hT100,
                          styles.rounded8,
                          { resizeMode: 'cover' }
                        ]}
                      />
                    ) : (
                      <View style={[styles.alignCenter, styles.justifyCenter, styles.wT100, styles.hT100]}>
                        <Text size="xs" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                          {t('common.photo', { number: index + 1 })}
                        </Text>
                      </View>
                    )}

                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(index)}
                      style={[
                        styles.absolute,
                        { top: 4, right: 4 },
                        styles.w24,
                        styles.h24,
                        styles.rounded12,
                        styles.alignCenter,
                        styles.justifyCenter,
                        { backgroundColor: '#ef4444' }
                      ]}
                    >
                      <X size={16} color="white" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>

              {photos.length < 5 && (
                <>
                  <Button 
                    variant="secondary" 
                    onPress={showPhotoOptions}
                    style={styles.mb8}
                    fullWidth
                  >
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <Camera size={16} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
                      <Text style={styles.ml8} color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                        {t('inspection.addPhoto')}
                      </Text>
                    </View>
                  </Button>
                  <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
                    {t('inspection.supportedFormats')} • {t('inspection.maxSize')}
                  </Text>
                </>
              )}
            </Card>
          )}

          {/* Complete Button */}
          <Button
            onPress={handleComplete}
            variant="primary"
            fullWidth
            disabled={isLoading || isSubmitting}
          >
            <View style={[styles.row, styles.gap4, styles.alignCenter]}>
              <CheckCheck size={16} color="white" />
              <Text style={styles.ml8} color="white">
                {isSubmitting
                  ? t('common.sending')
                  : t(`inspection.${inspectionType === 'pickup' ? 'sendUnlockRequest' : 'returnBike'}`)}
              </Text>
            </View>
          </Button>

          <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
            {inspectionType === 'pickup' ? 
              t('inspection.unlockRequestDisclaimer') :
              t('inspection.returnDisclaimer')
            }
          </Text>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

