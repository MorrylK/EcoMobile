/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bikeService } from '@/services/bikeService';
import type { Bike } from '@/services/bikeService';
import { rideService } from '@/services/rideService';
import { walletService } from '@/services/walletService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { Battery, Calendar, MapPin, Navigation2, Unlock, Zap, Shield, AlertTriangle, CreditCard, Check } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, TouchableOpacity, View } from 'react-native';
import { useMobileAuth } from '@/lib/mobile-auth';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { MobileHeader } from '@/components/layout/MobileHeader';

interface MobileBikeDetailsProps {
  bike: Bike;
  onBack: () => void;
  onStartRide: (bike: Bike) => void;
  onNavigate?: (screen: string, data?: any) => void;
}

export function MobileBikeDetails({ bike: initialBike, onBack, onNavigate }: MobileBikeDetailsProps) {
  const { t } = useMobileI18n();
  const { user } = useMobileAuth();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  
  const [bike, setBike] = useState<Bike>(initialBike);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [isCheckingRide, setIsCheckingRide] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [depositInfo, setDepositInfo] = useState<any>(null);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [priceInfo, setPriceInfo] = useState<{
    amount: number;
    willBeCharged: boolean;
    message: string;
  } | null>(null);

  useEffect(() => {
    loadBikeDetails();
    checkUserEligibility();
    checkActiveRide();
  }, [initialBike.id]);

  const loadBikeDetails = async () => {
    try {
      setIsLoading(true);
      const detailedBike = await bikeService.getBikeById(initialBike.id);
      setBike(detailedBike);
    } catch (error) {
      console.error('Error loading bike details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const checkActiveRide = async () => {
    try {
      setIsCheckingRide(true);
      const activeRide = await rideService.getActiveRide();
      setHasActiveRide(!!activeRide);
    } catch (error) {
      console.error('Error checking active ride:', error);
      setHasActiveRide(false);
    } finally {
      setIsCheckingRide(false);
    }
  };

  const checkUserEligibility = async () => {
    if (!user) return;

    try {
      // Vérifier la caution
      const depositData = await walletService.getDepositInfo();
      setDepositInfo(depositData);

      // Vérifier l'abonnement actif
      const subscription = await walletService.getCurrentSubscription();
      setCurrentSubscription(subscription);

      // Calculer le prix et la logique de facturation
      const displayPrice = initialBike.currentPricing?.displayPrice ?? null;
      const durationHours = initialBike.currentPricing?.durationHours ?? 1;
      const estimatedCost = displayPrice != null ? displayPrice : null;

      if (subscription) {
        setPriceInfo({
          amount: estimatedCost,
          willBeCharged: false,
          message: t('subscription.included', { plan: subscription.planName })
        });
      } else {
        setPriceInfo({
          amount: estimatedCost,
          willBeCharged: true,
          message: t('subscription.normalRate')
        });
      }
    } catch (error) {
      console.error('Error checking user eligibility:', error);
    }
  };

  const handleUnlock = async () => {
    if (!user) {
      toast.error(t('auth.mustBeLoggedIn'));
      return;
    }

    // Vérifier si l'utilisateur a un trajet en cours
    if (hasActiveRide) {
      haptics.error();
      toast.error(t('bike.details.activeRideError'));
      return;
    }

    // Vérifications de sécurité
    if (!depositInfo?.canUseService && !depositInfo?.hasDepositExemption) {
      haptics.error();
      toast.error(`${t('wallet.insufficientDeposit')} ${ depositInfo?.requiredDeposit || 20000 }`);
      onNavigate?.('recharge-deposit');
      return;
    }

    try {
      const walletBalance = await walletService.getBalance();
      
      if (priceInfo?.willBeCharged && walletBalance.balance < priceInfo.amount) {
        haptics.error();
        toast.error(t('wallet.insufficientBalance'));
        onNavigate?.('wallet');
        return;
      }
      
      haptics.light();
      
      onNavigate?.('bike-inspection', {
        bikeId: bike.id,
        bikeName: `${bike.code} - ${bike.model}`,
        inspectionType: 'pickup',
        onInspectionComplete: async (result: any) => {
          if (result.type === 'unlock_request_sent') {
            onNavigate?.('account-management', { activeTab: 'requests' });
          }
        }
      });
      
    } catch (error: any) {
      haptics.error();
      toast.error(error.message || t('unlock.error'));
    }
  };

  const getDirections = () => {
    haptics.light();
    if (bike.latitude && bike.longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${bike.latitude},${bike.longitude}`;
      Linking.openURL(url);
    }
  };

  const currentPricing = bike.currentPricing;

  return (
    <View style={styles.container}>
      <MobileHeader title={t('bike.details')} showBack onBack={onBack} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentPadded}
        showsVerticalScrollIndicator={false}
      >
        {/* Service Eligibility Status */}
        {depositInfo && !depositInfo.canUseService && (
          <Card style={[styles.p16, styles.mb24, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
            <View style={[styles.row, styles.gap12]}>
              <Shield size={20} color="#dc2626" />
              <View style={styles.flex1}>
                <Text size="sm" color="#991b1b" weight="bold">
                  {t('bike.details.serviceBlocked')}
                </Text>
                <Text size="sm" color="#991b1b" style={styles.mt4}>
                  {t('bike.details.insufficientDeposit')}
                </Text>
              </View>
            </View>
          </Card>
        )}

        {/* Bike Image */}
        <View style={[styles.relative, styles.wT100, { height: 256 }, { backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d' }, styles.rounded12, styles.mb24]}>
          <View style={[styles.absolute, { top: 0, left: 0, right: 0, bottom: 0 }, styles.alignCenter, styles.justifyCenter]}>
            <Zap size={96} color="#16a34a" />
          </View>
          {/**
          <View style={[styles.absolute, { top: 16, right: 16 }]}>
            <Badge
              variant={bike.batteryLevel > 50 ? 'default' : 'secondary'}
              style={{ backgroundColor: bike.batteryLevel > 50 ? '#16a34a' : '#f59e0b' }}
            >
              <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
                <Battery size={16} color="white" />
                <Text style={styles.ml4} color="white">
                  {bike.batteryLevel}%
                </Text>
              </View>
            </Badge>
          </View>
          */}
          {bike.status !== 'AVAILABLE' && (
            <View style={[styles.absolute, { top: 16, left: 16 }]}>
              <Badge variant="destructive">
                {t('bike.unavailable')}
              </Badge>
            </View>
          )}
        </View>

        <View style={styles.gap24}>
          {/* Bike Info */}
          <View>
            <Text variant="title" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb4}>
              {bike.code}
            </Text>
            <Text variant="body" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
              {bike.model}
            </Text>
          </View>

          {/* Pricing & Subscription Info */}
          {currentPricing && (
            <Card style={[styles.p16, { backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d', borderColor: '#16a34a' }]}>
              <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
                <View>
                  <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                    {t('bike.price')}
                    {currentPricing.isNight ? ' (nuit)' : ''}
                  </Text>
                  <View style={[styles.row, styles.alignCenter, styles.gap4]}>
                    <Text size="2xl" color="#16a34a" weight="bold">
                      {currentPricing.displayPrice} XOF
                    </Text>
                    <Text size="sm" color="#16a34a">
                      /{currentPricing.durationHours}h
                    </Text>
                  </View>
                  {currentPricing.isFallback && (
                    <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mt4}>
                      Tarif horaire de base
                    </Text>
                  )}
                  
                  {/* Subscription Status */}
                  {priceInfo && (
                    <View style={styles.mt8}>
                      <View style={[styles.row, styles.alignCenter, styles.gap4]}>
                        {priceInfo.willBeCharged ? 
                          <CreditCard size={12} color="#f59e0b" /> : 
                          <Check size={12} color="#16a34a" />
                        }
                        <Text size="xs" color={priceInfo.willBeCharged ? '#f59e0b' : '#16a34a'}>
                          {priceInfo.message}
                        </Text>
                      </View>
                      {priceInfo.willBeCharged && priceInfo.amount != null && (
                        <Text size="xs" color="#6b7280" style={styles.mt4}>
                          {t('bike.details.estimatedCost', { amount: priceInfo.amount })}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
                <Zap size={32} color="#16a34a" />
              </View>
            </Card>
          )}

          {/* Subscription Info Card */}
          {currentSubscription && (
            <Card style={[styles.p16, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}>
              <View style={[styles.row, styles.gap12]}>
                <Calendar size={20} color="#3b82f6" />
                <View style={styles.flex1}>
                  <Text variant="body" color="#1e40af" weight="bold">
                    {t('bike.details.activePlan', { plan: currentSubscription.planName })}
                  </Text>
                  <Text size="sm" color="#1e40af">
                    {t('bike.details.planType', { 
                      type: currentSubscription.packageType, 
                      date: new Date(currentSubscription.endDate).toLocaleDateString() 
                    })}
                  </Text>
                  {currentSubscription.bikeCode && (
                    <Text size="sm" color="#3b82f6" style={styles.mt4}>
                      {t('bike.details.reservedBike', { code: currentSubscription.bikeCode })}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          )}

          {/* Stats */}
          <View style={[styles.row, styles.gap16]}>
            <View style={styles.flex1}>
              <Card style={[styles.p16, styles.alignCenter]}>
                <Battery size={24} color="#16a34a" style={styles.mb8} />
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={[styles.mb4, styles.textCenter]}>
                  {t('bike.battery')}
                </Text>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.textCenter}>
                  {bike.batteryLevel}%
                </Text>
              </Card>
            </View>
            <View style={styles.flex1}>
              <Card style={[styles.p16, styles.alignCenter]}>
                <Zap size={24} color="#3b82f6" style={styles.mb8} />
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={[styles.mb4, styles.textCenter]}>
                  {t('bike.range')}
                </Text>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.textCenter}>
                  {Math.round((bike.batteryLevel / 100) * 50)} km
                </Text>
              </Card>
            </View>
          </View>

          {/* Location */}
          {(bike.latitude && bike.longitude) && (
            <Card style={styles.p16}>
              <View style={[styles.row, styles.gap12]}>
                <MapPin size={20} color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={{ marginTop: 2 }} />
                <View style={styles.flex1}>
                  <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb4}>
                    {t('bike.location')}
                  </Text>
                  <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                    {bike.locationName || `${bike.latitude}, ${bike.longitude}`}
                  </Text>
                  <TouchableOpacity
                    onPress={getDirections}
                    style={[styles.row, styles.alignCenter, styles.gap4, styles.mt8]}
                  >
                    <Navigation2 size={16} color="#16a34a" />
                    <Text size="sm" color="#16a34a">
                      {t('bike.getDirections')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Card>
          )}

          {/* Equipment */}
          {bike.equipment && bike.equipment.length > 0 && (
            <View>
              <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb12}>
                {t('bike.features')}
              </Text>
              <View style={[styles.row, { flexWrap: 'wrap' }, styles.gap8]}>
                {bike.equipment.map((feature) => (
                  <Badge key={feature} variant="secondary">
                    {feature}
                  </Badge>
                ))}
              </View>
            </View>
          )}

          {/* Action Buttons */}
          {bike.status === 'AVAILABLE' ? (
            <View style={styles.gap12}>
              {/* Unlock Button with conditional styling */}
              <Button
                onPress={handleUnlock}
                variant="primary"
                fullWidth
                style={{ 
                  height: 56,
                  backgroundColor: hasActiveRide || isCheckingRide || !depositInfo?.canUseService ? '#9ca3af' : '#16a34a',
                }}
                disabled={hasActiveRide || isCheckingRide || !depositInfo?.canUseService}
              >
                <View style={[styles.row, styles.gap8]}>
                  <Unlock size={20} color="white" />
                  <Text style={styles.ml8} color="white" size="lg">
                    {isCheckingRide ? t('common.checking') : hasActiveRide ? t('bike.details.hasActiveRide') : depositInfo?.canUseService ? t('map.unlock') : t('bike.details.unlockBlocked')}
                  </Text>
                </View>
              </Button>

              {/* Reserve Button */}
              <Button
                onPress={() => {
                  if (!depositInfo?.canUseService) {
                    toast.error(`${t('wallet.insufficientDeposit')} ${ depositInfo?.requiredDeposit || 20000 }`);
                    return;
                  }
                  haptics.light();
                  onNavigate?.('bike-reservation', bike);
                }}
                variant="outline"
                fullWidth
                style={{ 
                  height: 56,
                  opacity: depositInfo?.canUseService ? 1 : 0.6
                }}
                disabled={!depositInfo?.canUseService}
              >
                <View style={[styles.row, styles.gap8]}>
                  <Calendar size={20} color={depositInfo?.canUseService ? "#16a34a" : "#9ca3af"} />
                  <Text style={styles.ml8} color={depositInfo?.canUseService ? "#16a34a" : "#9ca3af"} size="lg">
                    {depositInfo?.canUseService ? t('reservation.reserveBike') : t('bike.details.reservationBlocked')}
                  </Text>
                </View>
              </Button>

              {/* Warning for active ride */}
              {hasActiveRide && (
                <Card style={[styles.p12, { backgroundColor: '#fef3c7' }]}>
                  <View style={[styles.row, styles.gap8]}>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <Text size="xs" color="#92400e">
                      {t('bike.details.activeRideWarning')}
                    </Text>
                  </View>
                </Card>
              )}

              {/* Warning for blocked actions */}
              {!depositInfo?.canUseService && (
                <Card style={[styles.p12, { backgroundColor: '#fef3c7' }]}>
                  <View style={[styles.row, styles.gap8]}>
                    <AlertTriangle size={16} color="#f59e0b" />
                    <Text size="xs" color="#92400e">
                      {t('bike.details.depositWarning', { amount: depositInfo?.requiredDeposit || 20000 })}
                    </Text>
                  </View>
                </Card>
              )}
            </View>
          ) : (
            <Card style={[styles.p16, styles.alignCenter, { backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151' }]}>
              <Text variant="body" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
                {bike.status === 'MAINTENANCE' ? '🔧 ' : ''}
                {t('bike.unavailable')}
              </Text>
              {bike.status === 'MAINTENANCE' && (
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={[styles.textCenter, styles.mt4]}>
                  {t('bike.details.maintenanceMessage')}
                </Text>
              )}
            </Card>
          )}
        </View>
      </ScrollView>
    </View>
  );
}