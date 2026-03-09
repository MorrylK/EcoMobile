import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Text } from '@/components/ui/Text';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { subscriptionService, ActiveSubscription, FreePlanBeneficiary } from '@/services/subscriptionService';
import { useFocusEffect } from 'expo-router';

/**
 * Bandeau persistant affiché sur les écrans principaux montrant :
 * - Le forfait payant actif + jours restants
 * - OU le forfait gratuit actif + jours restants
 * - Rien si aucun forfait actif
 */
export function ActivePlanBanner() {
  const colorScheme = useColorScheme();
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [freePlan, setFreePlan] = useState<FreePlanBeneficiary | null>(null);

  const loadActivePlan = useCallback(async () => {
    try {
      const [sub, freePlans] = await Promise.all([
        subscriptionService.getCurrentSubscription().catch(() => null),
        subscriptionService.getMyFreePlans().catch(() => [] as FreePlanBeneficiary[]),
      ]);

      setSubscription(sub);

      // Premier forfait gratuit activé avec des jours restants
      const now = new Date();
      const activeFree = freePlans.find(
        (p) =>
          new Date(p.startDate).getFullYear() < 2099 &&
          new Date(p.expiresAt) > now &&
          p.daysRemaining > 0,
      ) ?? null;
      setFreePlan(sub ? null : activeFree); // forfait payant prioritaire
    } catch {
      // silencieux
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadActivePlan();
    }, [loadActivePlan]),
  );

  if (!subscription && !freePlan) return null;

  const isPaid = !!subscription;
  const bgColor = isPaid
    ? colorScheme === 'dark' ? '#1e3a5f' : '#dbeafe'
    : colorScheme === 'dark' ? '#14532d' : '#dcfce7';
  const borderColor = isPaid ? '#3b82f6' : '#16a34a';
  const textColor = isPaid
    ? colorScheme === 'dark' ? '#93c5fd' : '#1d4ed8'
    : colorScheme === 'dark' ? '#86efac' : '#15803d';
  const subTextColor = isPaid
    ? colorScheme === 'dark' ? '#60a5fa' : '#3b82f6'
    : colorScheme === 'dark' ? '#4ade80' : '#16a34a';

  if (isPaid && subscription) {
    const sub = subscription as any;
    const expiresAt = new Date(subscription.endDate);
    const diffMs = expiresAt.getTime() - Date.now();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const dateLabel = expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let subLabel: string;
    if (sub.formulaType === 'DURATION' && sub.remainingRideMinutes !== null) {
      const remainingH = Math.floor(sub.remainingRideMinutes / 60);
      const remainingM = sub.remainingRideMinutes % 60;
      const timeStr = remainingH > 0
        ? `${remainingH}h${remainingM > 0 ? remainingM + 'min' : ''}`
        : `${remainingM}min`;
      subLabel = `${timeStr} restantes · exp. ${dateLabel}`;
    } else {
      const expiryLabel =
        diffDays <= 0 ? 'Expiré' : diffDays === 1 ? 'Expire demain' : `${diffDays} jours restants`;
      subLabel = `${expiryLabel} · ${dateLabel}`;
    }

    return (
      <View style={[styles.banner, { backgroundColor: bgColor, borderLeftColor: borderColor }]}>
        <View style={styles.dot(borderColor)} />
        <View style={styles.content}>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            {subscription.packageName} — {subscription.formulaName}
          </Text>
          <Text style={[styles.sub, { color: subTextColor }]}>
            {subLabel}
          </Text>
        </View>
      </View>
    );
  }

  if (freePlan) {
    const expiresAt = new Date(freePlan.expiresAt);
    const dateLabel = expiresAt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const days = freePlan.daysRemaining;

    return (
      <View style={[styles.banner, { backgroundColor: bgColor, borderLeftColor: borderColor }]}>
        <View style={[styles.dot(borderColor)]} />
        <View style={styles.content}>
          <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
            Jour gratuit · {freePlan.rule.name}
          </Text>
          <Text style={[styles.sub, { color: subTextColor }]}>
            {days} jour{days > 1 ? 's' : ''} restant{days > 1 ? 's' : ''} · exp. {dateLabel}
          </Text>
        </View>
      </View>
    );
  }

  return null;
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
  dot: (color: string) => ({
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: color,
    flexShrink: 0,
  }),
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
