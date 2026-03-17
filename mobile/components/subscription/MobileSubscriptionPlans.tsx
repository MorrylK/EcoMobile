/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscriptionService, SubscriptionPackage, SubscriptionFormula, ActiveSubscription, FreePlanBeneficiary } from '@/services/subscriptionService';
import { walletService } from '@/services/walletService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { Check, CreditCard, Star, X, Wallet } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { ScrollView, TouchableOpacity, View, Alert, Modal } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { useMobileAuth } from '@/lib/mobile-auth';
import { MobileHeader } from '@/components/layout/MobileHeader';

interface MobileSubscriptionPlansProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
}

export function MobileSubscriptionPlans({ onBack, onNavigate }: MobileSubscriptionPlansProps) {
  const { t } = useMobileI18n();
  const { user } = useMobileAuth();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const isDark = colorScheme === 'dark';

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<string>('');
  const [selectedFormula, setSelectedFormula] = useState<SubscriptionFormula | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<SubscriptionPackage | null>(null);
  const [walletData, setWalletData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<ActiveSubscription | null>(null);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const [freePlans, setFreePlans] = useState<FreePlanBeneficiary[]>([]);

  useEffect(() => {
    loadPackages();
    loadWalletData();
    loadCurrentSubscription();
    loadFreePlans();
  }, []);

  const loadPackages = async () => {
    try {
      setIsLoading(true);
      const availablePackages = await subscriptionService.getAvailablePackages();
      setPackages(availablePackages);
      if (availablePackages.length > 0) {
        setSelectedPackageId(availablePackages[0].id);
        setSelectedPackage(availablePackages[0]);
      }
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error(t('subscription.error.loading'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadWalletData = async () => {
    try {
      const wallet = await walletService.getBalance();
      setWalletData(wallet);
    } catch (error) {
      console.error('Error loading wallet data:', error);
    }
  };

  const loadCurrentSubscription = async () => {
    try {
      const subscription = await subscriptionService.getCurrentSubscription();
      setCurrentSubscription(subscription);
    } catch (error) {
      console.error('Error loading subscription:', error);
    }
  };

  const loadFreePlans = async () => {
    try {
      const plans = await subscriptionService.getMyFreePlans();
      setFreePlans(plans);
    } catch (error) {
      console.error('Error loading free plans:', error);
    }
  };

  const getFormulasForPackage = (packageId: string) => {
    const pkg = packages.find(p => p.id === packageId);
    return pkg?.formulas || [];
  };

  const formulas = selectedPackageId ? getFormulasForPackage(selectedPackageId) : [];

  const handleSubscribe = async () => {
    if (!selectedFormula || !user) {
      toast.error(t('subscription.error.selectFormula'));
      return;
    }
    const currentBalance = walletData?.balance || 0;
    if (currentBalance < selectedFormula.price) {
      haptics.error();
      Alert.alert(
        t('subscription.insufficientBalance.title'),
        t('subscription.insufficientBalance.message'),
        [
          { text: t('subscription.insufficientBalance.cancel'), style: 'cancel' },
          { text: t('subscription.insufficientBalance.topUp'), onPress: () => onNavigate('wallet') }
        ]
      );
      return;
    }
    try {
      setIsSubmitting(true);
      await subscriptionService.subscribe({ formulaId: selectedFormula.id, startDate: new Date() });
      haptics.success();
      toast.success(t('subscription.success.title'));
      await loadCurrentSubscription();
      await loadWalletData();
      Alert.alert(
        t('subscription.success.title'),
        `${t('subscription.success.message')} ${selectedPackage?.name} - ${selectedFormula.name}`,
        [{ text: t('subscription.success.ok'), onPress: () => onBack() }]
      );
    } catch (error: any) {
      haptics.error();
      toast.error(error.message || t('subscription.error.subscribing'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!currentSubscription) return;
    Alert.alert(
      t('subscription.cancel.title'),
      t('subscription.cancel.confirm'),
      [
        { text: t('subscription.cancel.no'), style: 'cancel' },
        {
          text: t('subscription.cancel.yes'),
          style: 'destructive',
          onPress: async () => {
            try {
              await subscriptionService.cancelSubscription(currentSubscription.id);
              haptics.success();
              toast.success(t('subscription.cancel.success'));
              await loadCurrentSubscription();
              await loadWalletData();
            } catch (error: any) {
              haptics.error();
              toast.error(error.message);
            }
          }
        }
      ]
    );
  };

  const handleChangeSubscription = async (newFormulaId: string) => {
    if (!currentSubscription) return;
    try {
      setIsSubmitting(true);
      await subscriptionService.changeSubscription(currentSubscription.id, newFormulaId);
      haptics.success();
      toast.success(t('subscription.change.success'));
      await loadCurrentSubscription();
      await loadWalletData();
      setIsChangeModalOpen(false);
    } catch (error: any) {
      haptics.error();
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasTimeWindow = (formula: SubscriptionFormula) =>
    formula.dayStartHour != null && formula.dayEndHour != null;

  const isDurationFormula = (formula: SubscriptionFormula) =>
    (formula as any).formulaType === 'DURATION';

  const textColor = isDark ? '#f9fafb' : '#111827';
  const subColor = isDark ? '#9ca3af' : '#6b7280';
  const cardBg = isDark ? '#1f2937' : 'white';
  const borderColor = isDark ? '#374151' : '#e5e7eb';

  return (
    <View style={styles.container}>
      <MobileHeader title={t('subscription.plans.title')} showBack onBack={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.p16, { gap: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Wallet balance chip */}
        {walletData && (
          <View style={[styles.row, styles.alignCenter, styles.gap8, {
            alignSelf: 'flex-end',
            backgroundColor: isDark ? '#374151' : '#f3f4f6',
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 6
          }]}>
            <Wallet size={14} color={isDark ? '#9ca3af' : '#6b7280'} />
            <Text size="sm" color={subColor}>
              {(walletData.balance || 0).toLocaleString('fr-FR')} FCFA
            </Text>
          </View>
        )}

        {/* Current Subscription */}
        {currentSubscription && (() => {
          const startDate = new Date(currentSubscription.startDate);
          const endDate = new Date(currentSubscription.endDate);
          const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
          const progressPercent = totalDays > 0 ? Math.min((currentSubscription.remainingDays / totalDays) * 100, 100) : 0;
          return (
            <Card style={[styles.p16, { backgroundColor: '#dbeafe', borderColor: '#0284c7', borderWidth: 1 }]}>
              <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
                <Text variant="body" color="#0c4a6e" weight="bold">
                  {t('subscription.current.active')}
                </Text>
                <Star size={18} color="#0284c7" fill="#0284c7" />
              </View>

              <Text size="sm" color="#0c4a6e" style={styles.mb12}>
                <Text weight="bold">{currentSubscription.packageName}</Text>
                {' — '}
                <Text weight="bold">{currentSubscription.formulaName}</Text>
              </Text>

              {/* Progress bar */}
              <View style={{ marginBottom: 12 }}>
                <View style={[styles.row, styles.spaceBetween, styles.mb4]}>
                  <Text size="xs" color="#0c4a6e">{t('subscription.current.daysRemaining')}</Text>
                  <Text size="xs" color="#0c4a6e" weight="bold">{currentSubscription.remainingDays} j</Text>
                </View>
                <View style={{ height: 6, backgroundColor: '#bfdbfe', borderRadius: 3 }}>
                  <View style={{ height: 6, width: `${progressPercent}%`, backgroundColor: '#0284c7', borderRadius: 3 }} />
                </View>
              </View>

              <View style={[styles.column, styles.gap4, styles.mb12]}>
                <View style={[styles.row, styles.spaceBetween]}>
                  <Text size="xs" color="#0c4a6e">{t('subscription.current.expiresAt')}</Text>
                  <Text size="xs" color="#0c4a6e">{new Date(currentSubscription.endDate).toLocaleDateString('fr-FR')}</Text>
                </View>
                {currentSubscription.dayStartHour != null && currentSubscription.dayEndHour != null && (
                  <View style={[styles.row, styles.spaceBetween]}>
                    <Text size="xs" color="#0c4a6e">{t('subscription.current.hours')}</Text>
                    <Text size="xs" color="#0c4a6e">{currentSubscription.dayStartHour}h - {currentSubscription.dayEndHour}h</Text>
                  </View>
                )}
              </View>

              <View style={[styles.row, styles.gap8]}>
                <Button onPress={() => setIsChangeModalOpen(true)} style={{ flex: 1, backgroundColor: '#0284c7' }}>
                  <Text color="white">{t('subscription.change.title')}</Text>
                </Button>
                <Button onPress={handleCancelSubscription} style={{ flex: 1, backgroundColor: '#dc2626' }}>
                  <Text color="white">{t('subscription.cancel.title')}</Text>
                </Button>
              </View>
            </Card>
          );
        })()}

        {/* Free Plans */}
        {freePlans.length > 0 && (
          <View style={{ gap: 8 }}>
            <Text variant="body" color={textColor} weight="bold">
              {t('subscription.freePlans.title')}
            </Text>
            {freePlans.map((plan) => {
              const isActivated = new Date(plan.startDate).getFullYear() < 2099;
              return (
                <Card
                  key={plan.id}
                  style={[styles.p16, {
                    backgroundColor: isActivated ? (isDark ? '#14532d' : '#f0fdf4') : cardBg,
                    borderColor: isActivated ? '#16a34a' : borderColor,
                    borderWidth: 1
                  }]}
                >
                  <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
                    <Text variant="body" color={textColor} weight="bold">{plan.rule.name}</Text>
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <View style={[{ borderRadius: 999, backgroundColor: '#16a34a', paddingHorizontal: 8, paddingVertical: 4 }]}>
                        <Text size="xs" color="white" weight="bold">{t('subscription.freePlans.free')}</Text>
                      </View>
                      {isActivated && (
                        <View style={[{ borderRadius: 999, backgroundColor: '#0ea5e9', paddingHorizontal: 8, paddingVertical: 4 }]}>
                          <Text size="xs" color="white" weight="bold">{t('subscription.freePlans.active')}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={[styles.column, styles.gap4]}>
                    <View style={[styles.row, styles.spaceBetween]}>
                      <Text size="xs" color={subColor}>{t('subscription.freePlans.daysRemaining')}</Text>
                      <Text size="xs" color={textColor} weight="bold">{plan.daysRemaining} / {plan.daysGranted}</Text>
                    </View>
                    <View style={[styles.row, styles.spaceBetween]}>
                      <Text size="xs" color={subColor}>{t('subscription.freePlans.expiresAt')}</Text>
                      <Text size="xs" color={textColor}>{new Date(plan.expiresAt).toLocaleDateString('fr-FR')}</Text>
                    </View>
                    {plan.rule.startHour != null && plan.rule.endHour != null && (
                      <View style={[styles.row, styles.spaceBetween]}>
                        <Text size="xs" color={subColor}>{t('subscription.freePlans.timeRange')}</Text>
                        <Text size="xs" color={textColor}>{plan.rule.startHour}h – {plan.rule.endHour}h</Text>
                      </View>
                    )}
                    {plan.rule.validUntil && (
                      <View style={[styles.row, styles.spaceBetween]}>
                        <Text size="xs" color="#dc2626">{t('subscription.freePlans.validUntil')}</Text>
                        <Text size="xs" color="#dc2626" weight="bold">{new Date(plan.rule.validUntil).toLocaleDateString('fr-FR')}</Text>
                      </View>
                    )}
                    {!isActivated && (
                      <TouchableOpacity
                        style={[styles.mt8, { paddingVertical: 10, borderRadius: 10, backgroundColor: '#16a34a', alignItems: 'center' }]}
                        onPress={async () => {
                          haptics.medium();
                          try {
                            await subscriptionService.activateFreePlan(plan.id);
                            haptics.success();
                            toast.success(t('subscription.freePlans.activateSuccess'));
                            await loadFreePlans();
                          } catch (e: any) {
                            haptics.error();
                            toast.error(e.message || t('subscription.freePlans.activateError'));
                          }
                        }}
                      >
                        <Text color="white" style={{ fontWeight: '700', fontSize: 14 }}>
                          {t('subscription.freePlans.activateBtn')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isActivated && (
                      <Text size="xs" color="#16a34a" style={[styles.mt4, { fontStyle: 'italic' }]}>
                        {t('subscription.freePlans.activeDesc')}
                      </Text>
                    )}
                  </View>
                </Card>
              );
            })}
          </View>
        )}

        {/* Subscribe section (no active subscription) */}
        {!currentSubscription && (
          <>
            {/* Package selection */}
            <View style={{ gap: 12 }}>
              <Text variant="body" color={textColor} weight="bold">
                {t('subscription.plans.selectPackage')}
              </Text>
              {packages.map((pkg) => (
                <TouchableOpacity
                  key={pkg.id}
                  onPress={() => {
                    setSelectedPackageId(pkg.id);
                    setSelectedPackage(pkg);
                    setSelectedFormula(null);
                    haptics.light();
                  }}
                  style={[
                    styles.card, styles.p16,
                    {
                      borderWidth: selectedPackageId === pkg.id ? 2 : 1,
                      borderColor: selectedPackageId === pkg.id ? '#16a34a' : borderColor,
                      backgroundColor: selectedPackageId === pkg.id ? (isDark ? '#14532d' : '#f0fdf4') : cardBg
                    }
                  ]}
                >
                  <Text
                    variant="body"
                    color={selectedPackageId === pkg.id ? '#16a34a' : textColor}
                    weight="bold"
                  >
                    {pkg.name}
                  </Text>
                  {pkg.description && (
                    <Text size="sm" color={subColor} style={styles.mt4}>{pkg.description}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Formula selection */}
            {formulas.length > 0 && (
              <View style={{ gap: 12 }}>
                <Text variant="body" color={textColor} weight="bold">
                  {t('subscription.plans.selectFormula')}
                </Text>
                {formulas.map((formula) => {
                  const isSelected = selectedFormula?.id === formula.id;
                  const hasTW = hasTimeWindow(formula);
                  const isDuration = isDurationFormula(formula);
                  return (
                    <TouchableOpacity
                      key={formula.id}
                      onPress={() => { setSelectedFormula(formula); haptics.light(); }}
                      style={[
                        styles.card, styles.p16,
                        {
                          borderWidth: isSelected ? 2 : 1,
                          borderColor: isSelected ? '#16a34a' : borderColor,
                          backgroundColor: isSelected ? (isDark ? '#14532d' : '#f0fdf4') : cardBg
                        }
                      ]}
                    >
                      <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
                        <View style={styles.flex1}>
                          <View style={[styles.row, styles.alignCenter, styles.gap8]}>
                            <Text variant="body" color={isSelected ? '#16a34a' : textColor} weight="bold">
                              {formula.name}
                            </Text>
                            {isDuration ? (
                              <View style={{ backgroundColor: isDark ? '#4c1d95' : '#ede9fe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text size="xs" color={isDark ? '#c4b5fd' : '#7c3aed'}>Durée</Text>
                              </View>
                            ) : (
                              <View style={{ backgroundColor: isDark ? '#1e3a5f' : '#dbeafe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                                <Text size="xs" color={isDark ? '#93c5fd' : '#1d4ed8'}>Plage horaire</Text>
                              </View>
                            )}
                          </View>
                          {formula.description && (
                            <Text size="sm" color={subColor}>{formula.description}</Text>
                          )}
                        </View>
                        <View style={styles.alignEnd}>
                          <Text variant="body" color="#16a34a" weight="bold">
                            {formula.price.toLocaleString('fr-FR')}
                          </Text>
                          <Text size="xs" color={subColor}>{t('subscription.currency')}</Text>
                        </View>
                      </View>

                      <View style={[styles.column, styles.gap4, { borderTopWidth: 1, borderTopColor: borderColor, paddingTop: 8 }]}>
                        <View style={[styles.row, styles.spaceBetween]}>
                          <Text size="xs" color={subColor}>{t('subscription.duration')}</Text>
                          <Text size="xs" color={textColor} weight="bold">
                            {formula.numberOfDays} {formula.numberOfDays === 1 ? 'jour' : 'jours'}
                          </Text>
                        </View>
                        {isDuration && (formula as any).maxRideDurationHours != null && (
                          <View style={[styles.row, styles.spaceBetween]}>
                            <Text size="xs" color={subColor}>Durée de trajet</Text>
                            <Text size="xs" color={textColor} weight="bold">{(formula as any).maxRideDurationHours}h</Text>
                          </View>
                        )}
                        {!isDuration && hasTW && (
                          <View style={[styles.row, styles.spaceBetween]}>
                            <Text size="xs" color={subColor}>{t('subscription.hours')}</Text>
                            <Text size="xs" color={textColor} weight="bold">
                              {formula.dayStartHour}h – {formula.dayEndHour}h
                            </Text>
                          </View>
                        )}
                        {formula.chargeAfterHours && formula.afterHoursPrice && (
                          <View style={[styles.row, styles.spaceBetween]}>
                            <Text size="xs" color="#dc2626">{t('subscription.afterHours')}</Text>
                            <Text size="xs" color="#dc2626" weight="bold">
                              {formula.afterHoursPrice.toLocaleString('fr-FR')} {t('subscription.currency')}
                            </Text>
                          </View>
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Summary + Subscribe */}
            {selectedFormula && selectedPackage && (
              <>
                <Card style={[styles.p16, { backgroundColor: isDark ? '#14532d' : '#f0fdf4', borderColor: '#16a34a', borderWidth: 1 }]}>
                  <Text variant="body" color={textColor} style={styles.mb12}>
                    {t('subscription.summary.title')}
                  </Text>
                  <View style={[styles.row, styles.spaceBetween, styles.mb4]}>
                    <Text size="sm" color={subColor}>{t('subscription.summary.package')}</Text>
                    <Text size="sm" color={textColor}>{selectedPackage.name}</Text>
                  </View>
                  <View style={[styles.row, styles.spaceBetween, styles.mb4]}>
                    <Text size="sm" color={subColor}>{t('subscription.summary.formula')}</Text>
                    <Text size="sm" color={textColor}>{selectedFormula.name}</Text>
                  </View>
                  <View style={[styles.row, styles.spaceBetween, styles.mb4]}>
                    <Text size="sm" color={subColor}>{t('subscription.summary.currentBalance')}</Text>
                    <Text size="sm" color={(walletData?.balance || 0) >= selectedFormula.price ? '#16a34a' : '#dc2626'} weight="bold">
                      {(walletData?.balance || 0).toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                  <View style={[styles.row, styles.spaceBetween, { paddingTop: 8, borderTopWidth: 1, borderTopColor: isDark ? '#166534' : '#d1fae5' }]}>
                    <Text variant="body" color={textColor}>{t('subscription.summary.totalPrice')}</Text>
                    <Text variant="body" color="#16a34a" weight="bold">
                      {selectedFormula.price.toLocaleString('fr-FR')} FCFA
                    </Text>
                  </View>
                </Card>

                <Button
                  onPress={handleSubscribe}
                  disabled={isSubmitting}
                  fullWidth
                  style={{ backgroundColor: '#16a34a', opacity: isSubmitting ? 0.6 : 1 }}
                >
                  <View style={[styles.row, styles.alignCenter, styles.gap8]}>
                    <CreditCard size={16} color="white" />
                    <Text color="white">
                      {isSubmitting ? t('subscription.subscribing') : t('subscription.subscribe')}
                    </Text>
                  </View>
                </Button>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Change Subscription Modal */}
      <Modal
        visible={isChangeModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsChangeModalOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={[{ marginTop: 60, flex: 1, backgroundColor: isDark ? '#111827' : 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20 }]}>
            <View style={[styles.px16, styles.py16, styles.row, styles.spaceBetween, styles.alignCenter, { borderBottomWidth: 1, borderBottomColor: borderColor }]}>
              <Text variant="body" color={textColor} weight="bold">
                {t('subscription.change.selectNew')}
              </Text>
              <TouchableOpacity onPress={() => setIsChangeModalOpen(false)}>
                <X size={22} color={textColor} />
              </TouchableOpacity>
            </View>

            {/* Wallet balance in modal */}
            {walletData && (
              <View style={[styles.row, styles.alignCenter, styles.gap8, styles.px16, { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: borderColor }]}>
                <Wallet size={14} color={subColor} />
                <Text size="sm" color={subColor}>Solde : </Text>
                <Text size="sm" color={textColor} weight="bold">{(walletData.balance || 0).toLocaleString('fr-FR')} FCFA</Text>
              </View>
            )}

            <ScrollView style={[{ flex: 1, padding: 16 }]} contentContainerStyle={{ gap: 12 }}>
              {packages.map(pkg => (
                <View key={pkg.id}>
                  <Text variant="body" color="#16a34a" weight="bold" style={styles.mb8}>{pkg.name}</Text>
                  {pkg.formulas.map(formula => (
                    <TouchableOpacity
                      key={formula.id}
                      onPress={() => handleChangeSubscription(formula.id)}
                      disabled={isSubmitting}
                      style={[styles.card, styles.p12, styles.mb8, { opacity: isSubmitting ? 0.6 : 1 }]}
                    >
                      <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
                        <View style={styles.flex1}>
                          <Text size="sm" color={textColor} weight="bold">{formula.name}</Text>
                          <Text size="xs" color={subColor}>
                            {formula.numberOfDays} j — {formula.price.toLocaleString('fr-FR')} FCFA
                          </Text>
                        </View>
                        <Check size={18} color="#16a34a" />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
