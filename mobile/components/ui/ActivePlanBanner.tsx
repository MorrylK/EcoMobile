import React, { useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscriptionService, ActiveSubscription, FreePlanBeneficiary } from '@/services/subscriptionService';
import { rideService } from '@/services/rideService';
import { Ride } from '@/lib/mobile-types';
import { useFocusEffect, router } from 'expo-router';
import { useMobileI18n } from '@/lib/mobile-i18n';

/**
 * Bandeau persistant affiché sur les écrans principaux montrant :
 * - Un trajet en cours (rouge/orange) + durée en temps réel
 * - Le forfait payant ou gratuit actif + jours restants
 */
export function ActivePlanBanner() {
  const { t, language } = useMobileI18n();
  const dateLocale = language === 'en' ? 'en-US' : 'fr-FR';
  const colorScheme = useColorScheme();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [freePlan, setFreePlan] = useState<FreePlanBeneficiary | null>(null);
  const [activeRide, setActiveRide] = useState<Ride | null>(null);
  const [rideDuration, setRideDuration] = useState('');

  const computeDuration = (startTime: string) => {
    const diff = Date.now() - new Date(startTime).getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m}min`;
  };

  const loadActivePlan = useCallback(async () => {
    try {
      const [sub, freePlans, ride] = await Promise.all([
        subscriptionService.getCurrentSubscription().catch(() => null),
        subscriptionService.getMyFreePlans().catch(() => [] as FreePlanBeneficiary[]),
        rideService.getActiveRide().catch(() => null),
      ]);

      setSubscription(sub);
      setActiveRide(ride);
      if (ride) setRideDuration(computeDuration(ride.startTime));

      const now = new Date();
      const activeFree = freePlans.find(
        (p) =>
          new Date(p.startDate).getFullYear() < 2099 &&
          new Date(p.expiresAt) > now &&
          p.daysRemaining > 0,
      ) ?? null;
      setFreePlan(sub ? null : activeFree);
    } catch {
      // silencieux
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivePlan();
      // Mettre à jour la durée toutes les 30 secondes si trajet actif
      const interval = setInterval(() => {
        setActiveRide((r) => {
          if (r) setRideDuration(computeDuration(r.startTime));
          return r;
        });
      }, 30000);
      return () => clearInterval(interval);
    }, [loadActivePlan]),
  );

  const hasAnything = activeRide || subscription || freePlan;
  if (!hasAnything) return null;

  const isDark = colorScheme === 'dark';

  return (
    <View>
      {/* Bandeau trajet en cours */}
      {activeRide && (
        <TouchableOpacity
          onPress={() => router.push({
            pathname: '/(modals)/ride-in-progress' as any,
            params: { bikeData: JSON.stringify(activeRide.bike) },
          })}
          style={[styles.banner, {
            backgroundColor: isDark ? '#431407' : '#fff7ed',
            borderLeftColor: '#f97316',
          }]}
          activeOpacity={0.8}
        >
          <View style={getDotStyle('#f97316')} />
          <View style={styles.content}>
            <Text style={[styles.name, { color: isDark ? '#fdba74' : '#c2410c' }]} numberOfLines={1}>
              {t('ride.inProgress')}{activeRide.bike?.code ? ` · ${activeRide.bike.code}` : ''}
            </Text>
            <Text style={[styles.sub, { color: isDark ? '#fb923c' : '#ea580c' }]}>
              {rideDuration} · {t('banner.tapToView')}
            </Text>
          </View>
          <Text style={{ color: isDark ? '#fb923c' : '#ea580c', fontSize: 16 }}>›</Text>
        </TouchableOpacity>
      )}

      {/* Bandeau forfait payant */}
      {subscription && (() => {
        const sub = subscription as any;
        const expiresAt = new Date(subscription.endDate);
        const diffDays = Math.ceil((expiresAt.getTime() - Date.now()) / 86400000);
        const dateLabel = expiresAt.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });

        let subLabel: string;
        if (sub.formulaType === 'DURATION' && sub.remainingRideMinutes !== null) {
          const h = Math.floor(sub.remainingRideMinutes / 60);
          const m = sub.remainingRideMinutes % 60;
          const timeStr = h > 0 ? `${h}h${m > 0 ? m + 'min' : ''}` : `${m}min`;
          subLabel = t('banner.durationRemaining', { duration: timeStr, date: dateLabel });
        } else if (diffDays <= 0) {
          subLabel = `${t('banner.expired')} · ${dateLabel}`;
        } else if (diffDays === 1) {
          subLabel = `${t('banner.expiresTomorrow')} · ${dateLabel}`;
        } else {
          subLabel = t('banner.daysRemaining', { days: diffDays, date: dateLabel });
        }

        return (
          <View style={[styles.banner, {
            backgroundColor: isDark ? '#1e3a5f' : '#dbeafe',
            borderLeftColor: '#3b82f6',
          }]}>
            <View style={getDotStyle('#3b82f6')} />
            <View style={styles.content}>
              <Text style={[styles.name, { color: isDark ? '#93c5fd' : '#1d4ed8' }]} numberOfLines={1}>
                {subscription.packageName} — {subscription.formulaName}
              </Text>
              <Text style={[styles.sub, { color: isDark ? '#60a5fa' : '#3b82f6' }]}>
                {subLabel}
              </Text>
            </View>
          </View>
        );
      })()}

      {/* Bandeau forfait gratuit */}
      {freePlan && (() => {
        const expiresAt = new Date(freePlan.expiresAt);
        const dateLabel = expiresAt.toLocaleDateString(dateLocale, { day: '2-digit', month: '2-digit', year: 'numeric' });
        const days = freePlan.daysRemaining;
        const freeDaySubLabel = days === 1
          ? t('banner.freeDayRemaining', { days, date: dateLabel })
          : t('banner.freeDaysRemaining', { days, date: dateLabel });
        return (
          <View style={[styles.banner, {
            backgroundColor: isDark ? '#14532d' : '#dcfce7',
            borderLeftColor: '#16a34a',
          }]}>
            <View style={getDotStyle('#16a34a')} />
            <View style={styles.content}>
              <Text style={[styles.name, { color: isDark ? '#86efac' : '#15803d' }]} numberOfLines={1}>
                {t('banner.freeDay')} · {freePlan.rule.name}
              </Text>
              <Text style={[styles.sub, { color: isDark ? '#4ade80' : '#16a34a' }]}>
                {freeDaySubLabel}
              </Text>
            </View>
          </View>
        );
      })()}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: 3,
    gap: 8,
  },
  content: {
    flex: 1,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
  },
  sub: {
    fontSize: 11,
    marginTop: 1,
  },
});

const getDotStyle = (color: string) => ({
  width: 7,
  height: 7,
  borderRadius: 4,
  backgroundColor: color,
  flexShrink: 0,
});
