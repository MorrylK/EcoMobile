/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/exhaustive-deps */
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { useCustomModals } from '@/components/ui/CustomModals';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { walletService } from '@/services/walletService';
import { subscriptionService, FreePlanBeneficiary } from '@/services/subscriptionService';
import { incidentService } from '@/services/incidentService';
import { bikeRequestService } from '@/services/bikeRequestService';
import { reservationService } from '@/services/reservationService';
import { Calendar, Wallet, CreditCard, Clock, Shield, AlertTriangle, ArrowLeft, Lock, Unlock, FileText, MapPin, Trash2, Lightbulb } from 'lucide-react-native';
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, ScrollView, RefreshControl, TouchableOpacity, Image, DeviceEventEmitter } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';

interface MobileAccountManagementProps {
  onBack: () => void;
  onNavigate: (screen: string, data?: any) => void;
  initialTab?: string;
}

export function MobileAccountManagement({ onBack, onNavigate, initialTab = 'overview' }: MobileAccountManagementProps) {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);

  const {
    ConfirmModalComponent,
    showConfirmModal,
    InfoModalComponent,
    showInfoModal
  } = useCustomModals();
  
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'requests' | 'incidents' | 'reservations'>(initialTab as any);
  const [isLoading, setIsLoading] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [incidents, setIncidents] = useState<any[]>([]);
  const [unlockRequests, setUnlockRequests] = useState<any[]>([]);
  const [lockRequests, setLockRequests] = useState<any[]>([]);
  const [reservations, setReservations] = useState<any[]>([]);
  const [currentSubscription, setCurrentSubscription] = useState<any>(null);
  const [activeFreePlans, setActiveFreePlans] = useState<FreePlanBeneficiary[]>([]);
  const [depositInfo, setDepositInfo] = useState<any>(null);
  
  // Cache pour éviter de recharger les données à chaque changement d'onglet
  const [dataCache, setDataCache] = useState<{
    accountData?: { timestamp: number; data: any };
    requests?: { timestamp: number; data: any };
    reservations?: { timestamp: number; data: any };
  }>({});
  
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  // Filtres
  const [transactionFilter, setTransactionFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  // Vérifier si les données en cache sont encore valides
  const isCacheValid = (cacheKey: keyof typeof dataCache): boolean => {
    const cached = dataCache[cacheKey];
    if (!cached) return false;
    return Date.now() - cached.timestamp < CACHE_DURATION;
  };

  useFocusEffect(
    useCallback(() => {
      // Charger les données de compte uniquement si le cache est expiré
      if (!isCacheValid('accountData')) {
        loadAccountData();
      } else {
        // Utiliser les données en cache
        const cached = dataCache.accountData;
        if (cached) {
          setWalletData(cached.data.walletData);
          setDepositInfo(cached.data.depositInfo);
          setTransactions(cached.data.transactions);
          setIncidents(cached.data.incidents);
          setCurrentSubscription(cached.data.currentSubscription);
          setActiveFreePlans(cached.data.activeFreePlans || []);
        }
        // Toujours recharger les forfaits gratuits (état peut changer depuis une autre page)
        subscriptionService.getMyFreePlans().then((freePlans) => {
          const active = freePlans.filter(
            (p) => new Date(p.startDate).getFullYear() < 2099
          );
          setActiveFreePlans(active);
        }).catch(() => {});
      }
      
      // Charger les données spécifiques à l'onglet uniquement si nécessaire
      if (activeTab === 'requests' && !isCacheValid('requests')) {
        loadRequests();
      } else if (activeTab === 'requests' && isCacheValid('requests')) {
        const cached = dataCache.requests;
        if (cached) {
          setUnlockRequests(cached.data.unlockRequests);
          setLockRequests(cached.data.lockRequests);
        }
      }
      
      if (activeTab === 'reservations' && !isCacheValid('reservations')) {
        loadReservations();
      } else if (activeTab === 'reservations' && isCacheValid('reservations')) {
        const cached = dataCache.reservations;
        if (cached) {
          setReservations(cached.data.reservations);
        }
      }
      
      return () => {
        // Code de nettoyage si nécessaire
      };
    }, [activeTab, dataCache])
  );

  // Synchronisation en temps réel via SSE (DeviceEventEmitter)
  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('notification_received', (notification) => {
      console.log('[SSE Sync] Notification received:', notification.type);
      
      // Rafraîchir les données systématiquement pour tout type de notification
      loadAccountData();
      if (activeTab === 'requests') {
        loadRequests();
      }

      // Redirection automatique selon le type de notification
      switch (notification.type) {
        case 'UNLOCK_APPROVED':
          haptics.success();
          toast.success(t('status.approved') || 'Déverrouillage validé !');
          // Rediriger vers l'écran de trajet en cours avec les données du vélo
          if (notification.metadata && notification.metadata.bike) {
            onNavigate('ride-in-progress', { bikeData: notification.metadata.bike });
          } else {
            // Fallback si metadata manquante
            onNavigate('home');
          }
          break;

        case 'LOCK_APPROVED':
          haptics.success();
          toast.success(t('status.completed') || 'Trajet terminé !');
          onNavigate('home');
          break;

        case 'UNLOCK_REJECTED':
        case 'LOCK_REJECTED':
          haptics.error();
          toast.error(notification.message || 'Demande refusée');
          loadRequests();
          break;
      }
    });

    return () => {
      subscription.remove();
    };
  }, [activeTab, onNavigate]);

  const loadAccountData = async () => {
    try {
      setIsLoading(true);
      
      const [wallet, depositData, userTransactions, userIncidents] = await Promise.all([
        walletService.getBalance(),
        walletService.getDepositInfo(),
        walletService.getTransactions(1, 50),
        incidentService.getIncidents(1, 50)
      ]);

      const accountData = {
        walletData: wallet,
        depositInfo: depositData,
        transactions: userTransactions.transactions || [],
        incidents: userIncidents.incidents || [],
        currentSubscription: null as any,
        activeFreePlans: [] as FreePlanBeneficiary[],
      };

      try {
        const subscription = await walletService.getCurrentSubscription();
        accountData.currentSubscription = subscription;
      } catch (subscriptionError) {
        console.log('No active subscription found');
        accountData.currentSubscription = null;
      }

      try {
        const freePlans = await subscriptionService.getMyFreePlans();
        // Seuls les plans activés (startDate non sentinelle)
        accountData.activeFreePlans = freePlans.filter(
          (p) => new Date(p.startDate).getFullYear() < 2099
        );
      } catch {
        accountData.activeFreePlans = [];
      }

      // Mettre à jour l'état
      setWalletData(accountData.walletData);
      setDepositInfo(accountData.depositInfo);
      setTransactions(accountData.transactions);
      setIncidents(accountData.incidents);
      setCurrentSubscription(accountData.currentSubscription);
      setActiveFreePlans(accountData.activeFreePlans);

      // Mettre en cache
      setDataCache(prev => ({
        ...prev,
        accountData: {
          timestamp: Date.now(),
          data: accountData,
        },
      }));
      
    } catch (error) {
      console.error('Error loading account data:', error);
      toast.error(t('common.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const loadRequests = async () => {
    try {
      const [unlockReqs, lockReqs] = await Promise.all([
        bikeRequestService.getUserUnlockRequests(1, 50),
        bikeRequestService.getUserLockRequests(1, 50)
      ]);
      
      const requestsData = {
        unlockRequests: unlockReqs.data || [],
        lockRequests: lockReqs.data || [],
      };
      
      setUnlockRequests(requestsData.unlockRequests);
      setLockRequests(requestsData.lockRequests);

      // Mettre en cache
      setDataCache(prev => ({
        ...prev,
        requests: {
          timestamp: Date.now(),
          data: requestsData,
        },
      }));
    } catch (error) {
      console.error('Error loading requests:', error);
      toast.error(t('common.error'));
    }
  };

  const loadReservations = async () => {
    try {
      const userReservations = await reservationService.getUserReservations();
      const reservationsData = {
        reservations: userReservations || [],
      };
      
      setReservations(reservationsData.reservations);

      // Mettre en cache
      setDataCache(prev => ({
        ...prev,
        reservations: {
          timestamp: Date.now(),
          data: reservationsData,
        },
      }));
    } catch (error) {
      console.error('Error loading reservations:', error);
      toast.error('Erreur lors du chargement des réservations');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': case 'APPROVED': case 'RESOLVED': case 'CLOSED': return '#16a34a';
      case 'PENDING': case 'OPEN': return '#f59e0b';
      case 'FAILED': case 'REJECTED': return '#dc2626';
      case 'IN_PROGRESS': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      'COMPLETED': t('status.completed'),
      'PENDING': t('status.pending'),
      'FAILED': t('status.failed'),
      'APPROVED': t('status.approved'),
      'REJECTED': t('status.rejected'),
      'CANCELLED': t('status.cancelled'),
      'OPEN': t('status.open'),
      'IN_PROGRESS': t('status.in_progress'),
      'RESOLVED': t('status.resolved'),
      'CLOSED': t('status.closed')
    };
    return statusMap[status] || status;
  };

  const getTransactionTypeText = (type: string) => {
    const typeMap: { [key: string]: string } = {
      'DEPOSIT': t('transaction.deposit'),
      'RIDE_PAYMENT': t('transaction.ridePayment'),
      'REFUND': t('transaction.refund'),
      'DEPOSIT_RECHARGE': t('transaction.depositRecharge'),
      'DAMAGE_CHARGE': t('transaction.damageCharge'),
      'SUBSCRIPTION_PAYMENT': t('transaction.subscriptionPayment')
    };
    return typeMap[type] || type;
  };

  const getIncidentTypeText = (type: string) => {
    // Si c'est une charge admin, retourner un texte spécial
    if (type === 'admin_charge') {
      return t('incident.adminCharge') || 'Charge administrative';
    }
    
    const typeMap: { [key: string]: string } = {
      'brakes': t('incident.brakes'),
      'battery': t('incident.battery'),
      'tire': t('incident.tire'),
      'chain': t('incident.chain'),
      'lights': t('incident.lights'),
      'lock': t('incident.lock'),
      'electronics': t('incident.electronics'),
      'physical_damage': t('incident.physicalDamage'),
      'theft': t('incident.theft'),
      'other': t('incident.other')
    };
    return typeMap[type] || type;
  };

  const getReasonText = (reason: string) => {
    const reasonMap: { [key: string]: string } = {
      'damage': t('incident.reason.damage'),
      'theft': t('incident.reason.theft'),
      'late_return': t('incident.reason.lateReturn'),
      'cleaning': t('incident.reason.cleaning'),
      'repair': t('incident.reason.repair'),
      'accessory_loss': t('incident.reason.accessoryLoss'),
      'other': t('incident.reason.other')
    };
    return reasonMap[reason] || reason;
  };

  const formatAdminChargeDescription = (description: string) => {
    // La description contient "reason: description" pour les charges admin
    // On extrait la raison et la description
    const parts = description.split(': ');
    if (parts.length > 1) {
      const reason = parts[0];
      const desc = parts.slice(1).join(': ');
      return {
        reason: getReasonText(reason),
        description: desc
      };
    }
    return {
      reason: getReasonText(description),
      description: ''
    };
  };

  const getReservationStatusColor = (reservation: any) => {
    const now = new Date();
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    if (reservation.status === 'CANCELLED') return '#dc2626';
    if (endDate < now) return '#6b7280';
    if (startDate <= now && endDate >= now) return '#16a34a';
    if (startDate > now) return '#f59e0b';
    return '#6b7280';
  };

  const getReservationStatusText = (reservation: any) => {
    const now = new Date();
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);

    if (reservation.status === 'CANCELLED') return 'Annulée';
    if (endDate < now) return 'Terminée';
    if (startDate <= now && endDate >= now) return t('account.inProgress');
    if (startDate > now) return t('account.upcoming');
    return t('account.unknown');
  };

  const handleDeleteRequest = async (request: any, type: 'unlock' | 'lock') => {
    if (request.status !== 'PENDING') {
      showInfoModal(
        t('account.cannotDelete'),
        <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
          {t('account.cannotDeleteMessage')}
        </Text>
      );
      return;
    }

    showConfirmModal(
      'Supprimer la demande',
      `Êtes-vous sûr de vouloir supprimer cette demande de ${type === 'unlock' ? 'déverrouillage' : 'verrouillage'} ?`,
      async () => {
        try {
          await bikeRequestService.deleteRequest(type, request.id);
          toast.success('Demande supprimée avec succès');
          loadRequests();
        } catch (error: any) {
          toast.error(error.message || 'Erreur lors de la suppression');
        }
      },
      'danger'
    );
  };

  const handleDeleteReservation = async (reservationId: string, reservation: any) => {
    if (reservation.status !== 'ACTIVE') {
      showInfoModal(
        t('account.cannotCancel'),
        <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
          {t('account.cannotCancelMessage')}
        </Text>
      );
      return;
    }

    showConfirmModal(
      'Annuler la réservation',
      `Êtes-vous sûr de vouloir annuler cette réservation ?\n\nVélo: ${reservation.bike?.code}\nDate: ${new Date(reservation.startDate).toLocaleDateString()}\n\nCette action est irréversible.`,
      async () => {
        try {
          await reservationService.cancelReservation(reservationId);
          toast.success('Réservation annulée avec succès');
          loadReservations();
          loadAccountData();
        } catch (error: any) {
          toast.error(error.message || 'Erreur lors de l\'annulation');
        }
      },
      'warning'
    );
  };

  const showRequestDetails = (request: any, type: 'unlock' | 'lock') => {
    const requestContent = (
      <View style={styles.gap16}>
        {/* Informations de base */}
        <View style={styles.gap8}>
          <Text size="sm" color="#6b7280">Vélo:</Text>
          <Text variant="body">{request.bike?.code || 'N/A'}</Text>
        </View>
        
        <View style={styles.gap8}>
          <Text size="sm" color="#6b7280">Date:</Text>
          <Text variant="body">
            {new Date(request.requestedAt || request.createdAt).toLocaleString('fr-FR')}
          </Text>
        </View>

        <View style={styles.gap8}>
          <Text size="sm" color="#6b7280">Statut:</Text>
          <View style={styles.row}>
            <Text 
              size="sm" 
              color={getStatusColor(request.status)}
              style={[styles.px12, styles.py4, styles.rounded8, { backgroundColor: `${getStatusColor(request.status)}20` }]}
            >
              {getStatusText(request.status)}
            </Text>
          </View>
        </View>

        {/* Inspection data si disponible */}
        {request.metadata?.inspection && (
          <View style={styles.gap8}>
            <Text size="sm" color="#6b7280">{t('account.inspectionReport')}</Text>
            <View style={[styles.p12, styles.rounded8, { backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151' }]}>
              <Text size="sm">{t('account.condition')}: {request.metadata.inspection.condition}</Text>
              {request.metadata.inspection.issues?.length > 0 && (
                <View style={styles.mt8}>
                  <Text size="xs" color="#dc2626">{t('account.reportedIssues')}:</Text>
                  {request.metadata.inspection.issues.map((issue: string, index: number) => (
                    <Text key={index} size="xs" color="#dc2626">• {issue}</Text>
                  ))}
                </View>
              )}
              {request.metadata.inspection.notes && (
                <View style={styles.mt8}>
                  <Text size="xs" color="#6b7280">{t('account.notes')}: {request.metadata.inspection.notes}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Notes admin */}
        {request.adminNote && (
          <View style={styles.gap8}>
            <Text size="sm" color="#6b7280">{t('account.adminNote')}</Text>
            <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
              {request.adminNote}
            </Text>
          </View>
        )}

        {/* Raison du rejet */}
        {request.rejectionReason && (
          <View style={styles.gap8}>
            <Text size="sm" color="#dc2626">{t('account.rejectionReason')}:</Text>
            <Text size="sm" color="#dc2626">
              {request.rejectionReason}
            </Text>
          </View>
        )}

        {/* Actions */}
        {request.status === 'PENDING' && (
          <Button
            variant="outline"
            onPress={() => handleDeleteRequest(request, type)}
            style={[styles.mt16, { borderColor: '#dc2626' }]}
            fullWidth
          >
            <View style={[styles.row, styles.alignCenter, styles.gap8]}>
              <Trash2 size={16} color="#dc2626" />
              <Text color="#dc2626">Supprimer la demande</Text>
            </View>
          </Button>
        )}
      </View>
    );

    showInfoModal(
      `Détails de la demande - ${type === 'unlock' ? 'Déverrouillage' : 'Verrouillage'}`,
      requestContent
    );
  };

  const showReservationDetails = (reservation: any) => {
    const startDate = new Date(reservation.startDate);
    const endDate = new Date(reservation.endDate);
    const now = new Date();
    
    const isUpcoming = startDate > now;
    const isOngoing = startDate <= now && endDate >= now;
    const isPast = endDate < now;
    
    let statusText = '';
    let statusColor = '';
    
    if (reservation.status === 'CANCELLED') {
      statusText = 'Annulée';
      statusColor = '#dc2626';
    } else if (isPast) {
      statusText = 'Terminée';
      statusColor = '#6b7280';
    } else if (isOngoing) {
      statusText = t('account.inProgress');
      statusColor = '#16a34a';
    } else if (isUpcoming) {
      statusText = 'À venir';
      statusColor = '#f59e0b';
    }

    const reservationContent = (
      <View style={styles.gap16}>
        {/* Informations de base */}
        <View style={styles.gap12}>
          <View style={styles.gap4}>
            <Text size="sm" color="#6b7280">Vélo:</Text>
            <Text variant="body">{reservation.bike?.code} - {reservation.bike?.model}</Text>
          </View>
          
          <View style={styles.gap4}>
            <Text size="sm" color="#6b7280">Type de forfait:</Text>
            <Text variant="body">{reservation.packageType}</Text>
          </View>

          <View style={styles.gap4}>
            <Text size="sm" color="#6b7280">Période:</Text>
            <Text variant="body">
              Du {startDate.toLocaleDateString('fr-FR')} à {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              {'\n'}au {endDate.toLocaleDateString('fr-FR')} à {endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>

          <View style={styles.gap4}>
            <Text size="sm" color="#6b7280">Statut:</Text>
            <View style={styles.row}>
              <Text 
                size="sm" 
                color={statusColor}
                style={[styles.px12, styles.py4, styles.rounded8, { backgroundColor: `${statusColor}20` }]}
              >
                {statusText}
              </Text>
            </View>
          </View>

          {/* Localisation du vélo si disponible */}
          {reservation.bike?.latitude && reservation.bike?.longitude && (
            <View style={styles.gap4}>
              <Text size="sm" color="#6b7280">Localisation du vélo:</Text>
              <TouchableOpacity 
                onPress={async () => {
                  const url = `https://www.google.com/maps/dir/?api=1&destination=${reservation.bike.latitude},${reservation.bike.longitude}`;
                  const Linking = await import('expo-linking');
                  await Linking.default.openURL(url);
                }}
                style={[styles.row, styles.alignCenter, styles.gap4]}
              >
                <MapPin size={16} color="#16a34a" />
                <Text size="sm" color="#16a34a">Voir sur la carte</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Plan tarifaire si disponible */}
        {reservation.plan && (
          <View style={[styles.p12, styles.rounded8, { backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d' }]}>
            <Text size="sm" color="#16a34a" weight="bold">Plan: {reservation.plan.name}</Text>
            {reservation.plan.hourlyRate && (
              <Text size="xs" color="#16a34a">Tarif: {reservation.plan.hourlyRate} XOF/h</Text>
            )}
          </View>
        )}

        {/* Informations de temps restant pour les réservations actives */}
        {isUpcoming && (
          <View style={[styles.p12, styles.rounded8, { backgroundColor: '#fef3c7' }]}>
            <Text size="sm" color="#92400e" weight="bold">
              Commence dans: {Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60))} heure(s)
            </Text>
          </View>
        )}

        {isOngoing && (
          <View style={[styles.p12, styles.rounded8, { backgroundColor: '#f0fdf4' }]}>
            <Text size="sm" color="#16a34a" weight="bold">
              Se termine dans: {Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60))} heure(s)
            </Text>
          </View>
        )}

        {/* Actions */}
        <View style={styles.gap8}>
          {reservation.status === 'ACTIVE' && isUpcoming && (
            <Button
              variant="outline"
              onPress={() => handleDeleteReservation(reservation.id, reservation)}
              style={[{ borderColor: '#f59e0b' }]}
              fullWidth
            >
              <View style={[styles.row, styles.alignCenter, styles.gap8]}>
                <Trash2 size={16} color="#f59e0b" />
                <Text color="#f59e0b">Annuler la réservation</Text>
              </View>
            </Button>
          )}

          {isOngoing && (
            <Button
              variant="primary"
              onPress={() => {
                // Naviguer vers les détails du vélo pour le déverrouiller
                onNavigate('bike-details', { bikeData: reservation.bike });
              }}
              fullWidth
            >
              <View style={[styles.row, styles.alignCenter, styles.gap8]}>
                <Unlock size={16} color="white" />
                <Text color="white">Utiliser le vélo</Text>
              </View>
            </Button>
          )}

          <Button
            variant="outline"
            onPress={() => {
              // Naviguer vers les détails du vélo
              onNavigate('bike-details', { bikeData: reservation.bike });
            }}
            fullWidth
          >
            <View style={[styles.row, styles.alignCenter, styles.gap8]}>
              <MapPin size={16} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
              <Text color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>Voir le vélo</Text>
            </View>
          </Button>
        </View>
      </View>
    );

    showInfoModal(
      t('accountManagement.reservationDetails') || 'Détails de la réservation',
      reservationContent
    );
  };

  const showIncidentDetails = async (incident: any) => {
    try {
      const fullIncident = await incidentService.getIncident(incident.id);
      const isAdminCharge = fullIncident.type === 'admin_charge';
      const chargeInfo = isAdminCharge ? formatAdminChargeDescription(fullIncident.description) : null;
      
      const getStatusColor = (status: string) => {
        switch (status) {
          case 'RESOLVED': case 'CLOSED': return '#16a34a';
          case 'OPEN': return '#f59e0b';
          case 'IN_PROGRESS': return '#3b82f6';
          default: return '#6b7280';
        }
      };

      const getStatusText = (status: string) => {
        const statusMap: { [key: string]: string } = {
          'OPEN': t('incident.status.open'),
          'IN_PROGRESS': t('incident.status.in_progress'),
          'RESOLVED': t('incident.status.resolved'),
          'CLOSED': t('incident.status.closed')
        };
        return statusMap[status] || status;
      };

      const incidentContent = (
        <View style={styles.gap16}>
          <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
            <Badge variant="secondary" style={{ backgroundColor: getStatusColor(fullIncident.status) + '20' }}>
              <Text size="sm" color={getStatusColor(fullIncident.status)}>
                {getStatusText(fullIncident.status)}
              </Text>
            </Badge>
            {fullIncident.priority && (
              <Badge variant="outline">
                <Text size="xs">{fullIncident.priority}</Text>
              </Badge>
            )}
          </View>

          <View>
            <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
              {t('incident.type')}
            </Text>
            <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
              {getIncidentTypeText(fullIncident.type)}
            </Text>
          </View>

          {fullIncident.bike && (
            <View>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                {t('incident.details.relatedBike')}
              </Text>
              <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                {fullIncident.bike.code} - {fullIncident.bike.model}
              </Text>
            </View>
          )}

          <View>
            <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
              {t('incident.description')}
            </Text>
            {isAdminCharge && chargeInfo ? (
              <>
                {chargeInfo.reason && (
                  <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb4} weight="medium">
                    {chargeInfo.reason}
                  </Text>
                )}
                {chargeInfo.description && (
                  <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                    {chargeInfo.description}
                  </Text>
                )}
              </>
            ) : (
              <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                {fullIncident.description}
              </Text>
            )}
          </View>

          {fullIncident.refundAmount && fullIncident.refundAmount > 0 && (
            <View>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                {isAdminCharge ? t('accountManagement.chargeAmount', { amount: fullIncident.refundAmount.toLocaleString() }) : t('incident.details.refundAmount', { amount: fullIncident.refundAmount })}
              </Text>
              <Text variant="body" color={isAdminCharge ? '#dc2626' : '#16a34a'} weight="bold">
                {fullIncident.refundAmount.toLocaleString()} FCFA
              </Text>
            </View>
          )}

          {fullIncident.adminNote && (
            <View style={[styles.p12, styles.rounded8, { backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151' }]}>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4} weight="medium">
                {t('incident.details.adminNote')}
              </Text>
              <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                {fullIncident.adminNote}
              </Text>
            </View>
          )}

          {isAdminCharge && fullIncident.resolvedByUser && (
            <View>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                {t('accountManagement.assignedBy')}
              </Text>
              <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                {fullIncident.resolvedByUser.firstName} {fullIncident.resolvedByUser.lastName}
              </Text>
            </View>
          )}

          <View style={[styles.row, styles.spaceBetween]}>
            <View>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                {t('incident.details.creationDate')}
              </Text>
              <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                {new Date(fullIncident.createdAt).toLocaleString()}
              </Text>
            </View>
            {fullIncident.resolvedAt && (
              <View>
                <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                  {t('incident.details.resolvedDate')}
                </Text>
                <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                  {new Date(fullIncident.resolvedAt).toLocaleString()}
                </Text>
              </View>
            )}
          </View>

          {((fullIncident as any).images || (fullIncident as any).photos || []).length > 0 && (
            <View>
              <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
                {t('incident.details.photosCount', { count: ((fullIncident as any).images || (fullIncident as any).photos || []).length })}
              </Text>
              <View style={[styles.row, styles.gap8, { flexWrap: 'wrap' }]}>
                {((fullIncident as any).images || (fullIncident as any).photos || []).map((image: string, index: number) => (
                  <View key={index} style={[styles.rounded8, { overflow: 'hidden', width: 80, height: 80 }]}>
                    <Image source={{ uri: image }} style={{ width: 80, height: 80 }} resizeMode="cover" />
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>
      );

      showInfoModal(t('incident.details.title') || 'Détails du signalement', incidentContent);
    } catch (error) {
      console.error('Error loading incident details:', error);
      toast.error(t('error.loadingIncident') || 'Erreur lors du chargement des détails');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    if (transactionFilter !== 'all' && transaction.type !== transactionFilter) return false;
    
    if (dateFilter !== 'all') {
      const transactionDate = new Date(transaction.createdAt);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          return transactionDate.toDateString() === now.toDateString();
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return transactionDate >= weekAgo;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          return transactionDate >= monthAgo;
      }
    }
    
    return true;
  });

  const renderOverview = () => (
    <View style={styles.gap16}>
      {/* Current Subscription */}
      {currentSubscription ? (
        <Card style={[styles.p16, { backgroundColor: '#f0fdf4', borderColor: '#16a34a' }]}>
          <Text variant="body" color="#111827" style={styles.mb8}>
            {t('accountManagement.currentSubscription')}
          </Text>
          <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
            <View style={styles.flex1}>
              <Text variant="body" color="#16a34a" weight="bold" numberOfLines={1}>
                {currentSubscription.planName} - {currentSubscription.packageType}
              </Text>
              <Text size="sm" color="#6b7280" numberOfLines={1}>
                {t('accountManagement.expiresOn', { date: new Date(currentSubscription.endDate).toLocaleDateString() })}
              </Text>
              {currentSubscription.bikeCode && (
                <Text size="sm" color="#16a34a" style={styles.mt4} numberOfLines={1}>
                  {t('accountManagement.reservedBike', { code: currentSubscription.bikeCode })}
                </Text>
              )}
            </View>
            <View style={styles.alignEnd}>
              <Text size="sm" color="#16a34a" weight="bold">
                {currentSubscription.remainingDays}
              </Text>
              <Text size="xs" color="#6b7280">
                {t('accountManagement.daysRemaining', { days: currentSubscription.remainingDays })}
              </Text>
            </View>
          </View>
        </Card>
      ) : activeFreePlans.length === 0 ? (
        <Card style={[styles.p16, { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' }]}>
          <Text variant="body" color="#111827" style={styles.mb8}>
            {t('accountManagement.noActivePlan')}
          </Text>
          <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
            <View style={styles.flex1}>
              <Text size="sm" color="#6b7280" style={styles.mb4}>
                {t('accountManagement.subscribeDescription')}
              </Text>
            </View>
            <Button
              variant="primary"
              size="sm"
              onPress={() => onNavigate('subscription-plans')}
            >
              <Text>{t('accountManagement.subscribe')}</Text>
            </Button>
          </View>
        </Card>
      ) : null}

      {/* Active Free Plans */}
      {activeFreePlans.length > 0 && activeFreePlans.map((plan) => (
        <Card key={plan.id} style={[styles.p16, { backgroundColor: '#f0fdf4', borderColor: '#16a34a', borderWidth: 1 }]}>
          <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
            <Text variant="body" color="#111827">
              {plan.rule.name}
            </Text>
            <View style={[styles.px8, styles.py4, { borderRadius: 999, backgroundColor: '#16a34a' }]}>
              <Text size="xs" color="white" weight="bold">Gratuit · Actif</Text>
            </View>
          </View>
          <View style={[styles.row, styles.spaceBetween]}>
            <Text size="sm" color="#6b7280">Jours restants</Text>
            <Text size="sm" color="#16a34a" weight="bold">{plan.daysRemaining}</Text>
          </View>
          {plan.rule.startHour != null && plan.rule.endHour != null && (
            <View style={[styles.row, styles.spaceBetween, styles.mt4]}>
              <Text size="xs" color="#6b7280">Plage horaire</Text>
              <Text size="xs" color="#111827">{plan.rule.startHour}h – {plan.rule.endHour}h</Text>
            </View>
          )}
        </Card>
      ))}

      {/* Wallet Overview */}
      <View style={[styles.row, styles.gap12]}>
        <Card style={[styles.flex1, styles.p16, styles.alignCenter]}>
          <Wallet size={24} color="#16a34a" style={styles.mb8} />
          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
            {t('accountManagement.walletBalance')}
          </Text>
          <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} weight="bold">
            {walletData?.balance || 0} XOF
          </Text>
        </Card>
        
        <Card style={[styles.flex1, styles.p16, styles.alignCenter]}>
          <Shield size={24} color="#3b82f6" style={styles.mb8} />
          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
            {t('accountManagement.deposit')}
          </Text>
          <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} weight="bold">
            {depositInfo?.currentDeposit || 0} XOF
          </Text>
        </Card>
      </View>

      {/* Deposit Warning */}
      {depositInfo && !depositInfo.canUseService && (
        <Card style={[styles.p16, { backgroundColor: '#fef3c7', borderColor: '#f59e0b' }]}>
          <View style={[styles.row, styles.gap12]}>
            <AlertTriangle size={20} color="#f59e0b" />
            <View style={styles.flex1}>
              <Text size="sm" color="#92400e" weight="bold" numberOfLines={1}>
                {t('accountManagement.serviceBlocked')}
              </Text>
              <Text size="sm" color="#92400e" style={styles.mt4}>
                {t('accountManagement.requiredMinimum', { amount: depositInfo.requiredDeposit })}
                {'\n'}{t('accountManagement.currentAmount', { amount: depositInfo.currentDeposit })}
                {'\n'}{t('accountManagement.missingAmount', { amount: depositInfo.requiredDeposit - depositInfo.currentDeposit })}
              </Text>
              <Button
                variant="outline"
                size="sm"
                onPress={() => onNavigate('recharge-deposit')}
                style={[styles.mt8, { borderColor: '#f59e0b' }]}
              >
                <Text color="#f59e0b">{t('accountManagement.rechargeDeposit')}</Text>
              </Button>
            </View>
          </View>
        </Card>
      )}

      {/* Negative Balance Warning */}
      {depositInfo?.negativeBalance > 0 && (
        <Card style={[styles.p16, { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }]}>
          <View style={[styles.row, styles.gap12]}>
            <AlertTriangle size={20} color="#dc2626" />
            <View style={styles.flex1}>
              <Text size="sm" color="#991b1b" weight="bold" numberOfLines={1}>
                {t('accountManagement.negativeBalance', { amount: depositInfo.negativeBalance })}
              </Text>
              <Text size="xs" color="#991b1b" style={styles.mt4} numberOfLines={2}>
                {t('wallet.insufficientBalance')}
              </Text>
            </View>
          </View>
        </Card>
      )}

      {/* Quick Actions */}
      <View style={[styles.column, styles.gap12]}>
        <View style={[styles.row, styles.gap12]}>
          <Button
            variant="outline"
            onPress={() => onNavigate('wallet-topup')}
            style={[styles.flex1, styles.row]}
          >
            <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
              <CreditCard size={18} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
              <Text style={styles.ml8} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
                {t('accountManagement.rechargeWallet')}
              </Text>
            </View>
          </Button>
          <Button
            variant="outline"
            onPress={() => onNavigate('recharge-deposit')}
            style={[styles.flex1, styles.row]}
          >
            <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
              <Shield size={18} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
              <Text style={styles.ml8} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
                {t('accountManagement.deposit')}
              </Text>
            </View>
          </Button>
        </View>
        <Button
          variant="outline"
          onPress={() => onNavigate('create-incident')}
          style={[styles.row]}
        >
          <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
            <AlertTriangle size={18} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
            <Text style={styles.ml8} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
              {t('accountManagement.reportProblem')}
            </Text>
          </View>
        </Button>
      </View>
    </View>
  );

  const renderTransactions = () => (
    <View style={styles.gap16}>
      {/* Filters */}
      <Card style={styles.p16}>
        <View style={[styles.row, styles.gap12]}>
          <View style={styles.flex1}>
            <Label style={styles.mb8}>{t('accountManagement.filters.type')}</Label>
            <Select value={transactionFilter} onValueChange={setTransactionFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('accountManagement.filters.all')}</SelectItem>
                <SelectItem value="DEPOSIT">{t('accountManagement.filters.deposits')}</SelectItem>
                <SelectItem value="RIDE_PAYMENT">{t('accountManagement.filters.ridePayments')}</SelectItem>
                <SelectItem value="REFUND">{t('accountManagement.filters.refunds')}</SelectItem>
                <SelectItem value="DEPOSIT_RECHARGE">{t('accountManagement.filters.depositRecharge')}</SelectItem>
                <SelectItem value="DAMAGE_CHARGE">{t('accountManagement.filters.damageCharges')}</SelectItem>
                <SelectItem value="SUBSCRIPTION_PAYMENT">{t('accountManagement.filters.subscriptionPayments')}</SelectItem>
              </SelectContent>
            </Select>
          </View>
          <View style={styles.flex1}>
            <Label style={styles.mb8}>{t('accountManagement.filters.period')}</Label>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('accountManagement.filters.all')}</SelectItem>
                <SelectItem value="today">{t('accountManagement.filters.today')}</SelectItem>
                <SelectItem value="week">{t('accountManagement.filters.week')}</SelectItem>
                <SelectItem value="month">{t('accountManagement.filters.month')}</SelectItem>
              </SelectContent>
            </Select>
          </View>
        </View>
      </Card>

      {/* Transactions List */}
      <View style={styles.gap12}>
        {filteredTransactions.map((transaction) => (
          <Card key={transaction.id} style={styles.p16}>
            <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
              <View style={styles.flex1}>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
                  {getTransactionTypeText(transaction.type)}
                </Text>
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={1}>
                  {new Date(transaction.createdAt).toLocaleString()}
                </Text>
                {transaction.metadata?.appliedRule && (
                  <Text size="xs" color="#16a34a" style={styles.mt4} numberOfLines={1}>
                    {transaction.metadata.appliedRule}
                  </Text>
                )}
              </View>
              <View style={styles.alignEnd}>
                <Text 
                  variant="body" 
                  color={['RIDE_PAYMENT', 'DAMAGE_CHARGE', 'SUBSCRIPTION_PAYMENT'].includes(transaction.type) ? '#dc2626' : '#16a34a'}
                  weight="bold"
                >
                  {['RIDE_PAYMENT', 'DAMAGE_CHARGE', 'SUBSCRIPTION_PAYMENT'].includes(transaction.type) ? '-' : '+'}
                  {transaction.amount} XOF
                </Text>
                <Text 
                  size="xs" 
                  color={getStatusColor(transaction.status)}
                  style={{ marginTop: 4 }}
                  numberOfLines={1}
                >
                  {getStatusText(transaction.status)}
                </Text>
              </View>
            </View>
            
            {transaction.metadata?.discountApplied > 0 && (
              <Text size="xs" color="#16a34a" style={styles.mb4} numberOfLines={1}>
                💰 {t('accountManagement.savings', { amount: transaction.metadata.discountApplied })}
              </Text>
            )}
          </Card>
        ))}
        
        {filteredTransactions.length === 0 && (
          <Card style={[styles.p32, styles.alignCenter]}>
            <FileText size={32} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} style={styles.mb8} />
            <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
              {t('accountManagement.noTransactions')}
            </Text>
          </Card>
        )}
      </View>
    </View>
  );

  const renderRequests = () => (
    <View style={styles.gap16}>
      <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb8}>
        {t('accountManagement.tabs.requests')}
      </Text>
      
      {/* Unlock Requests */}
      {unlockRequests.length > 0 && (
        <View style={styles.gap12}>
          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
            {t('accountManagement.unlockRequests', { count: unlockRequests.length })}
          </Text>
          {unlockRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              onPress={() => showRequestDetails(request, 'unlock')}
            >
              <Card style={styles.p16}>
                <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
                  <View style={[styles.row, styles.alignCenter, styles.gap12, styles.flex1]}>
                    <Unlock size={20} color={getStatusColor(request.status)} />
                    <View style={styles.flex1}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {t('accountManagement.unlockRequests', { count: 1 })} - {request.bike?.code || t('common.bike')}
                      </Text>
                      <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={1}>
                        {new Date(request.requestedAt || request.createdAt).toLocaleString()}
                      </Text>
                      {request.adminNote && (
                        <Text 
                          size="xs" 
                          color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} 
                          style={styles.mt4}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('accountManagement.adminNote', { note: request.adminNote })}
                        </Text>
                      )}
                      {request.rejectionReason && (
                        <Text 
                          size="xs" 
                          color="#dc2626" 
                          style={styles.mt4}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('accountManagement.rejectionReason', { reason: request.rejectionReason })}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.alignEnd}>
                    <Text 
                      size="xs" 
                      color={getStatusColor(request.status)}
                      weight="bold"
                      style={styles.mb4}
                    >
                      {getStatusText(request.status)}
                    </Text>
                    {request.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(request, 'unlock');
                        }}
                        style={[{ borderColor: '#dc2626' }]}
                      >
                        <Text color="#dc2626" size="xs">Annuler</Text>
                      </Button>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Lock Requests */}
      {lockRequests.length > 0 && (
        <View style={styles.gap12}>
          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb4}>
            {t('accountManagement.lockRequests', { count: lockRequests.length })}
          </Text>
          {lockRequests.map((request) => (
            <TouchableOpacity
              key={request.id}
              onPress={() => showRequestDetails(request, 'lock')}
            >
              <Card style={styles.p16}>
                <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
                  <View style={[styles.row, styles.alignCenter, styles.gap12, styles.flex1]}>
                    <Lock size={20} color={getStatusColor(request.status)} />
                    <View style={styles.flex1}>
                      <Text 
                        variant="body" 
                        color={colorScheme === 'light' ? '#111827' : '#f9fafb'}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {t('accountManagement.lockRequests', { count: 1 })} - {request.bike?.code || t('common.bike')}
                      </Text>
                      <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={1}>
                        {new Date(request.requestedAt || request.createdAt).toLocaleString()}
                      </Text>
                      {request.adminNote && (
                        <Text 
                          size="xs" 
                          color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} 
                          style={styles.mt4}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('accountManagement.adminNote', { note: request.adminNote })}
                        </Text>
                      )}
                      {request.ride && (
                        <Text 
                          size="xs" 
                          color="#16a34a" 
                          style={styles.mt4}
                          numberOfLines={1}
                          ellipsizeMode="tail"
                        >
                          {t('accountManagement.rideDetails', { 
                            minutes: Math.round((request.ride.duration || 0) / 60), 
                            cost: request.ride.cost || 0 
                          })}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.alignEnd}>
                    <Text 
                      size="xs" 
                      color={getStatusColor(request.status)}
                      weight="bold"
                      style={styles.mb4}
                    >
                      {getStatusText(request.status)}
                    </Text>
                    {request.status === 'PENDING' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteRequest(request, 'lock');
                        }}
                        style={[{ borderColor: '#dc2626' }]}
                      >
                        <Text color="#dc2626" size="xs">Annuler</Text>
                      </Button>
                    )}
                  </View>
                </View>
              </Card>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {(unlockRequests.length === 0 && lockRequests.length === 0) && (
        <Card style={[styles.p32, styles.alignCenter]}>
          <Clock size={32} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} style={styles.mb8} />
          <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
            {t('accountManagement.noRequests')}
          </Text>
        </Card>
      )}
    </View>
  );

  const renderReservations = () => (
    <View style={styles.gap16}>
      <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
        <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
          Mes réservations
        </Text>
        <Button
          variant="primary"
          size="sm"
          onPress={() => onNavigate('bike-map')}
        >
          <Text color="white">Nouvelle réservation</Text>
        </Button>
      </View>

      {/* Statistiques rapides */}
      <View style={[styles.row, styles.gap8]}>
        <Card style={[styles.flex1, styles.p12, styles.alignCenter]}>
          <Text size="lg" color="#f59e0b" weight="bold">
            {reservations.filter(r => {
              const now = new Date();
              const startDate = new Date(r.startDate);
              return r.status === 'ACTIVE' && startDate > now;
            }).length}
          </Text>
          <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
            À venir
          </Text>
        </Card>
        <Card style={[styles.flex1, styles.p12, styles.alignCenter]}>
          <Text size="lg" color="#16a34a" weight="bold">
            {reservations.filter(r => {
              const now = new Date();
              const startDate = new Date(r.startDate);
              const endDate = new Date(r.endDate);
              return r.status === 'ACTIVE' && startDate <= now && endDate >= now;
            }).length}
          </Text>
          <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
            {t('account.inProgress')}
          </Text>
        </Card>
        <Card style={[styles.flex1, styles.p12, styles.alignCenter]}>
          <Text size="lg" color="#6b7280" weight="bold">
            {reservations.filter(r => {
              const now = new Date();
              const endDate = new Date(r.endDate);
              return endDate < now || r.status === 'CANCELLED';
            }).length}
          </Text>
          <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.textCenter}>
            Terminées
          </Text>
        </Card>
      </View>

      {/* Liste des réservations */}
      <View style={styles.gap12}>
        {reservations.length > 0 ? (
          reservations
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime())
            .map((reservation) => {
              const statusColor = getReservationStatusColor(reservation);
              const statusText = getReservationStatusText(reservation);
              const startDate = new Date(reservation.startDate);
              const now = new Date();
              const isUpcoming = startDate > now && reservation.status === 'ACTIVE';
              const isOngoing = startDate <= now && new Date(reservation.endDate) >= now && reservation.status === 'ACTIVE';

              return (
                <Card key={reservation.id} style={styles.p16}>
                  <TouchableOpacity
                    onPress={() => showReservationDetails(reservation)}
                    style={[styles.row, styles.spaceBetween, styles.alignCenter]}
                  >
                    <View style={[styles.row, styles.alignCenter, styles.gap12, styles.flex1]}>
                      <Calendar size={20} color={statusColor} />
                      <View style={styles.flex1}>
                        <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
                          {reservation.bike?.code} - {reservation.packageType}
                        </Text>
                        <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={1}>
                          {startDate.toLocaleDateString('fr-FR')} à {startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        
                        {/* Informations supplémentaires basées sur le statut */}
                        {isUpcoming && (
                          <Text size="xs" color="#f59e0b" style={styles.mt4} numberOfLines={1}>
                            Commence dans {Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60))}h
                          </Text>
                        )}
                        {isOngoing && (
                          <Text size="xs" color="#16a34a" style={styles.mt4} numberOfLines={1}>
                            Réservation active - Vélo disponible
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={styles.alignEnd}>
                      <Text 
                        size="xs" 
                        color={statusColor}
                        weight="bold"
                        style={[styles.px8, styles.py4, styles.rounded4, { backgroundColor: `${statusColor}20` }]}
                      >
                        {statusText}
                      </Text>
                      
                      {/* Actions rapides */}
                      <View style={[styles.row, styles.gap4, styles.mt8]}>
                        {isOngoing && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              onNavigate('bike-details', { bikeData: reservation.bike });
                            }}
                            style={[styles.px8, styles.py4, styles.rounded4, { backgroundColor: '#16a34a' }]}
                          >
                            <Unlock size={12} color="white" />
                          </TouchableOpacity>
                        )}
                        
                        {isUpcoming && (
                          <TouchableOpacity
                            onPress={(e) => {
                              e.stopPropagation();
                              handleDeleteReservation(reservation.id, reservation);
                            }}
                            style={[styles.px8, styles.py4, styles.rounded4, { backgroundColor: '#f59e0b' }]}
                          >
                            <Trash2 size={12} color="white" />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })
        ) : (
          <Card style={[styles.p32, styles.alignCenter]}>
            <Calendar size={32} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} style={styles.mb8} />
            <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb16}>
              Aucune réservation trouvée
            </Text>
            <Button
              variant="primary"
              onPress={() => onNavigate('bike-map')}
            >
              <Text color="white">Faire une réservation</Text>
            </Button>
          </Card>
        )}
      </View>

      {/* Conseil pour les réservations */}
      {reservations.some(r => {
        const now = new Date();
        const startDate = new Date(r.startDate);
        return r.status === 'ACTIVE' && startDate > now;
      }) && (
        <Card style={[styles.p16, { backgroundColor: '#eff6ff', borderColor: '#3b82f6' }]}>
          <View style={[styles.row, styles.gap12]}>
            <Lightbulb size={16} color="#1e40af" />
            <View style={styles.flex1}>
              <Text size="sm" color="#1e40af" weight="bold" numberOfLines={1}>
                Conseil
              </Text>
              <Text size="sm" color="#1e40af" style={styles.mt4} numberOfLines={2}>
                Vous pouvez annuler votre réservation jusqu'à 30 minutes avant l'heure prévue.
              </Text>
            </View>
          </View>
        </Card>
      )}
    </View>
  );

  const renderIncidents = () => (
    <View style={styles.gap16}>
      <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
        <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
          {t('accountManagement.myReports')}
        </Text>
        <Button
          variant="primary"
          size="sm"
          onPress={() => onNavigate('create-incident')}
        >
          <Text color="white">{t('accountManagement.newReport')}</Text>
        </Button>
      </View>
      
      {incidents.map((incident) => {
        const isAdminCharge = incident.type === 'admin_charge';
        const chargeInfo = isAdminCharge ? formatAdminChargeDescription(incident.description) : null;
        
        return (
          <Card key={incident.id} style={styles.p16}>
            <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb8]}>
              <View style={styles.flex1}>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} numberOfLines={1}>
                  {getIncidentTypeText(incident.type)}
                </Text>
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={1}>
                  {incident.bike?.code || t('common.bike')} - {new Date(incident.createdAt).toLocaleDateString()}
                </Text>
              </View>
              <Text 
                size="xs" 
                color={getStatusColor(incident.status)}
                weight="bold"
              >
                {getStatusText(incident.status)}
              </Text>
            </View>
            
            {isAdminCharge && chargeInfo ? (
              <>
                {chargeInfo.reason && (
                  <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb4} weight="medium">
                    {chargeInfo.reason}
                  </Text>
                )}
                {chargeInfo.description && (
                  <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb8} numberOfLines={3}>
                    {chargeInfo.description}
                  </Text>
                )}
                {incident.refundAmount && incident.refundAmount > 0 && (
                  <View style={[styles.row, styles.alignCenter, styles.gap4, styles.mb8]}>
                    <Text size="sm" color="#dc2626" weight="bold">
                      {t('accountManagement.chargeAmount', { amount: incident.refundAmount.toLocaleString() })}
                    </Text>
                  </View>
                )}
              </>
            ) : (
              <>
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb8} numberOfLines={3}>
                  {incident.description}
                </Text>
                
                {incident.refundAmount && incident.refundAmount > 0 && (
                  <View style={[styles.row, styles.alignCenter, styles.gap4, styles.mb8]}>
                    <Text size="sm" color="#16a34a" weight="bold">
                      {t('accountManagement.refundAmount', { amount: incident.refundAmount })}
                    </Text>
                  </View>
                )}
              </>
            )}
          
            {incident.adminNote && (
              <View style={[styles.p12, styles.rounded8, { backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151' }]}>
                <Text size="xs" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} numberOfLines={2}>
                  {t('accountManagement.adminNote', { note: incident.adminNote }) || `Note admin: ${incident.adminNote}`}
                </Text>
              </View>
            )}

          <View style={[styles.row, styles.gap8, styles.mt12]}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => showIncidentDetails(incident)}
              style={styles.flex1}
            >
              <Text>{t('accountManagement.details')}</Text>
            </Button>
            {incident.status === 'OPEN' && !isAdminCharge && (
              <Button
                variant="outline"
                size="sm"
                onPress={() => onNavigate('edit-incident', { incidentId: incident.id })}
                style={styles.flex1}
              >
                <Text>{t('accountManagement.edit')}</Text>
              </Button>
            )}
          </View>
        </Card>
        );
      })}
      
      {incidents.length === 0 && (
        <Card style={[styles.p32, styles.alignCenter]}>
          <AlertTriangle size={32} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} style={styles.mb8} />
          <Text color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={styles.mb16}>
            {t('accountManagement.noReports')}
          </Text>
          <Button
            variant="primary"
            onPress={() => onNavigate('create-incident')}
          >
            <Text color="white">{t('accountManagement.createFirstReport')}</Text>
          </Button>
        </Card>
      )}
    </View>
  );

  const tabs = [
    { key: 'overview', label: t('accountManagement.tabs.overview'), icon: Wallet },
    { key: 'transactions', label: t('accountManagement.tabs.transactions'), icon: CreditCard },
    { key: 'requests', label: t('accountManagement.tabs.requests'), icon: Clock },
    { key: 'reservations', label: 'Réservations', icon: Calendar },
    { key: 'incidents', label: t('accountManagement.tabs.incidents'), icon: AlertTriangle }
  ];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View 
        style={[
          styles.px16, 
          styles.py16, 
          styles.row, 
          styles.alignCenter,
          styles.gap16,
          { 
            backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
            borderBottomWidth: 1,
            borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151'
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => {
            haptics.light();
            onBack();
          }}
          style={[styles.p8, styles.rounded8]}
        >
          <ArrowLeft size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
        </TouchableOpacity>
        <Text variant="subtitle" color="#16a34a" numberOfLines={1}>
          {t('accountManagement.title')}
        </Text>
      </View>

      {/* Tabs */}
      <ScrollView 
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.px16,
          styles.py8,
          { 
            backgroundColor: colorScheme === 'light' ? 'white' : '#1f2937',
            borderBottomWidth: 1,
            borderBottomColor: colorScheme === 'light' ? '#e5e7eb' : '#374151',
            maxHeight: 70,
          }
        ]}
        contentContainerStyle={styles.gap8}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key as any);
                haptics.light();
              }}
              style={[
                styles.alignCenter,
                styles.py8,
                styles.px12,
                styles.rounded8,
                {
                  backgroundColor: activeTab === tab.key ? '#16a34a20' : 'transparent',
                  borderWidth: activeTab === tab.key ? 1 : 0,
                  borderColor: '#16a34a',
                  marginRight: 10,
                }
              ]}
            >
              <Icon 
                size={16} 
                color={activeTab === tab.key ? '#16a34a' : (colorScheme === 'light' ? '#6b7280' : '#9ca3af')} 
              />
              <Text 
                size="xs" 
                color={activeTab === tab.key ? '#16a34a' : (colorScheme === 'light' ? '#6b7280' : '#9ca3af')}
                style={styles.mt4}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.p16]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadAccountData}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      >
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'transactions' && renderTransactions()}
        {activeTab === 'requests' && renderRequests()}
        {activeTab === 'reservations' && renderReservations()}
        {activeTab === 'incidents' && renderIncidents()}
      </ScrollView>
      <ConfirmModalComponent />
      <InfoModalComponent />
    </View>
  );
}