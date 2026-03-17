import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, DollarSign, Activity, Calendar, ArrowLeft, Ban, 
  CheckCircle, AlertCircle, Shield, MapPin, Bike, CreditCard,
  TrendingUp, AlertTriangle, Lock, Unlock, History, FileText, MapPin as MapPinIcon, Download, X, Check, Edit, Trash2 } from 'lucide-react';
import { AdminChargeModal } from './AdminChargeModal';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Card } from '../../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../../ui/dialog';
import { useTranslation } from '../../../lib/i18n';
import { usePermissions } from '../../../hooks/usePermissions';
import { ProtectedAccess } from '../../shared/ProtectedAccess';
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/tabs';
import { userService, type User as UserType } from '../../../services/api/user.service';
import { type Ride } from '../../../services/api/ride.service';
import { type Transaction } from '../../../services/api/wallet.service';
import { incidentService, type Incident } from '../../../services/api/incident.service';
import { documentService, type DocumentsStatus, type IdentityDocument, type ResidenceProof, type ActivityLocationProof } from '../../../services/api/document.service';

export function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const userId = id || null;
  
  const [user, setUser] = useState<UserType & {
    _incidents?: Incident[];
    _rides?: Ride[];
    _transactions?: Transaction[];
    _requests?: any[];
    stats?: any;
    depositExemptionUntil?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [chargeModalOpen, setChargeModalOpen] = useState(false);
  const [chargeEditModalOpen, setChargeEditModalOpen] = useState(false);
  const [selectedChargeId, setSelectedChargeId] = useState<string | null>(null);
  const [depositExemptionModalOpen, setDepositExemptionModalOpen] = useState(false);
  const [depositExemptionDays, setDepositExemptionDays] = useState<number>(0);
  const [documentsStatus, setDocumentsStatus] = useState<DocumentsStatus | null>(null);
  const [documentActionLoading, setDocumentActionLoading] = useState<string | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean;
    type: 'identity' | 'residence' | 'activity' | null;
    documentId: string | null;
    reason: string;
  }>({
    open: false,
    type: null,
    documentId: null,
    reason: ''
  });

  const handleBack = () => {
    navigate('/admin/users');
  };

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    type: 'block' | 'unblock' | null;
    loading: boolean;
  }>({
    open: false,
    type: null,
    loading: false
  });

  const canViewUser = hasPermission('users', 'read');
  const canUpdateUser = hasPermission('users', 'update');
  const canViewWallet = hasPermission('wallet', 'read');
  const canViewRides = hasPermission('rides', 'read');
  const canViewIncidents = hasPermission('incidents', 'read');
  const canManageIncidents = hasPermission('incidents', 'update') || hasPermission('incidents', 'delete');
  const { user: currentUser } = usePermissions();
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (userId && canViewUser) {
      loadUserData();
    } else if (!canViewUser) {
      toast.error('Vous n\'avez pas les permissions pour voir les détails de cet utilisateur');
    }
  }, [userId, canViewUser]);

  const loadUserData = async () => {
    if (!userId || !canViewUser) return;

    try {
      setLoading(true);
      const userData = await userService.getUserById(userId);

      let depositInfo = { currentDeposit: 0, requiredDeposit: 0, canUseService: false };
      let walletBalance = { balance: 0, deposit: 0, negativeBalance: 0 };

      const updatedUserData = {
        ...userData,
        depositBalance: depositInfo.currentDeposit || walletBalance.deposit || 0,
        accountBalance: walletBalance.balance || 0,
        negativeBalance: walletBalance.negativeBalance || 0
      };

      setUser(updatedUserData);
      
      const stats = userData.stats || {};
      
      setIncidents(userData.incidents || []);
      setRides(userData.rides || []);
      setTransactions(userData.transactions || []);
      setRequests(userData.requests || []);
      
      // Load documents status
      try {
        const docsStatus = await documentService.getUserDocumentsStatus(userId);
        setDocumentsStatus(docsStatus);
      } catch (error) {
        console.error('Error loading documents:', error);
      }
      
    } catch (error) {
      console.error('Erreur lors du chargement des données:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const openConfirmDialog = (type: 'block' | 'unblock') => {
    if (!canUpdateUser) {
      toast.error(`Vous n'avez pas les permissions pour ${type === 'block' ? 'bloquer' : 'débloquer'} cet utilisateur`);
      return;
    }

    setConfirmDialog({
      open: true,
      type,
      loading: false
    });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({
      open: false,
      type: null,
      loading: false
    });
  };

  const handleConfirmAction = async () => {
    if (!user || !confirmDialog.type || !canUpdateUser) return;

    try {
      setConfirmDialog(prev => ({ ...prev, loading: true }));

      if (confirmDialog.type === 'block') {
        await userService.blockUser(user.id);
        toast.success(`Utilisateur ${[user.firstName, user.lastName].filter(Boolean).join(' ') || 'inconnu'} bloqué avec succès`);
        setUser({ ...user, status: 'blocked' });
      } else {
        await userService.unblockUser(user.id);
        toast.success(`Utilisateur ${[user.firstName, user.lastName].filter(Boolean).join(' ') || 'inconnu'} débloqué avec succès`);
        setUser({ ...user, status: 'active' });
      }

      closeConfirmDialog();
    } catch (error) {
      console.error('Erreur lors de l\'action:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'opération');
      setConfirmDialog(prev => ({ ...prev, loading: false }));
    }
  };

  const handleVerifyPhone = async () => {
    if (!user || !canUpdateUser) return;

    try {
      setActionLoading(true);
      await userService.verifyPhoneManually(user.id);
      toast.success('Téléphone validé avec succès');
      await loadUserData(); // Recharger les données pour mettre à jour le statut
    } catch (error) {
      console.error('Erreur lors de la validation du téléphone:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de la validation du téléphone');
    } finally {
      setActionLoading(false);
    }
  };

  const getUserInitial = (userName: string | null | undefined): string => {
    if (!userName || typeof userName !== 'string' || userName.length === 0) {
      return '?';
    }
    return userName.charAt(0).toUpperCase();
  };

  const formatDate = (date: string | null | undefined): string => {
    if (!date) return 'Date inconnue';
    try {
      return new Date(date).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      return 'Date inconnue';
    }
  };

  const formatCurrency = (amount: number): string => {
    return `${amount.toLocaleString('fr-FR')} FCFA`;
  };

  const getStatusColor = (status: string | undefined) => {
    if (!status) return 'bg-gray-100 text-gray-800';
    
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'blocked':
      case 'suspended':
      case 'banned':
        return 'bg-red-100 text-red-800';
      case 'pending_verification':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
      case 'inactive':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!canViewUser) {
    return (
      <div className="p-4 md:p-8">
        <Button onClick={handleBack} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <Card className="p-12">
          <div className="text-center text-red-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-3" />
            <h3 className="text-lg font-semibold mb-2">Accès refusé</h3>
            <p>Vous n'avez pas les permissions nécessaires pour voir les détails de cet utilisateur.</p>
          </div>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 md:p-8">
        <Button onClick={handleBack} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
            <p className="text-gray-600">{t('users.loadingDetails') || 'Chargement des détails de l\'utilisateur...'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-4 md:p-8">
        <Button onClick={handleBack} variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          {t('common.back')}
        </Button>
        <Card className="p-12">
          <div className="text-center text-gray-500">
            <User className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Utilisateur non trouvé</p>
          </div>
        </Card>
      </div>
    );
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const stats = user?.stats || {};
  const totalIncidents = incidents.length;
  const openIncidents = incidents.filter(i => i.status === 'OPEN').length;
  const totalRequests = requests.length;
  const pendingRequests = requests.filter(r => r.status === 'PENDING').length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={handleBack} variant="ghost" size="icon" aria-label={t('aria.back')} title={t('aria.back')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white text-2xl font-semibold">{getUserInitial(fullName)}</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-green-600">{fullName}</h1>
              <p className="text-gray-600">{user.email || 'Email non disponible'}</p>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={getStatusColor(user.status)}>
                  {user.status === 'active' ? (t('users.status.active') || 'Actif') : user.status === 'blocked' ? (t('users.status.blocked') || 'Bloqué') : (t('users.status.pending') || 'En attente')}
                </Badge>
                <Badge variant="outline">
                  {user.role || 'Utilisateur'}
                </Badge>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProtectedAccess mode="component" resource="users" action="update" fallback={null}>
            <Button
              variant={user.status === 'active' ? 'destructive' : 'default'}
              onClick={() => openConfirmDialog(user.status === 'active' ? 'block' : 'unblock')}
              disabled={actionLoading}
              aria-label={user.status === 'active' ? (t('aria.blockUser') || 'Bloquer l\'utilisateur') : (t('aria.unblockUser') || 'Débloquer l\'utilisateur')}
              title={user.status === 'active' ? (t('users.block') || 'Bloquer') : (t('users.unblock') || 'Débloquer')}
            >
              {actionLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : user.status === 'active' ? (
                <Ban className="w-4 h-4 mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {user.status === 'active' ? (t('users.block') || 'Bloquer') : (t('users.unblock') || 'Débloquer')}
            </Button>
          </ProtectedAccess>
          <ProtectedAccess mode="component" resource="wallet" action="manage" fallback={null}>
            <Button
              variant="outline"
              onClick={() => setChargeModalOpen(true)}
              className="border-orange-500 text-orange-600 hover:bg-orange-50"
              aria-label={t('charges.assign') || 'Affecter une charge'}
              title={t('charges.assign') || 'Affecter une charge'}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              {t('charges.assign') || 'Affecter une charge'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setDepositExemptionModalOpen(true)}
              className="border-blue-500 text-blue-600 hover:bg-blue-50"
              aria-label={t('users.depositExemption') || 'Déblocage sans caution'}
              title={t('users.depositExemption') || 'Déblocage sans caution'}
            >
              <Unlock className="w-4 h-4 mr-2" />
              {t('users.depositExemption') || 'Déblocage sans caution'}
            </Button>
          </ProtectedAccess>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <ProtectedAccess mode="component" resource="wallet" action="read">
          <Card className="p-4 border-l-4 border-green-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Solde Wallet</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency( user?.stats?.wallet?.balance || user?.accountBalance || 0)}</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </Card>
        </ProtectedAccess>

        <ProtectedAccess mode="component" resource="wallet" action="read">
          <Card className="p-4 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Caution</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(user.depositBalance || 0)}</p>
                {user?.stats?.wallet?.requiredDeposit && (
                  <p className="text-xs text-gray-500">
                    Requis: {formatCurrency(user.stats.wallet.requiredDeposit)}
                  </p>
                )}
                {user?.stats?.wallet?.canUseService !== undefined && (
                  <Badge className={`mt-1 ${
                    user.stats.wallet.canUseService 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {user.stats.wallet.canUseService 
                      ? 'Caution suffisante' 
                      : 'Caution insuffisante'}
                  </Badge>
                )}
                {user.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date() && (
                  <Badge className="mt-1 bg-blue-100 text-blue-800">
                    Déblocage actif jusqu'au {formatDate(user.depositExemptionUntil)}
                  </Badge>
                )}
              </div>
              <Shield className="w-8 h-8 text-blue-600" />
            </div>
          </Card>
        </ProtectedAccess>

        <Card className="p-4 border-l-4 border-purple-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Trajets</p>
              <p className="text-2xl font-bold text-gray-900">{user.totalTrips || 0}</p>
              <p className="text-sm text-gray-500">{formatCurrency(user.totalSpent || 0)} dépensés</p>
            </div>
            <Activity className="w-8 h-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-yellow-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Incidents</p>
              <p className="text-2xl font-bold text-gray-900">{totalIncidents}</p>
              <p className="text-sm text-gray-500">{openIncidents} ouverts</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-4 border-l-4 border-orange-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Demandes</p>
              <p className="text-2xl font-bold text-gray-900">{totalRequests}</p>
              <p className="text-sm text-gray-500">{pendingRequests} en attente</p>
            </div>
            <History className="w-8 h-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informations Personnelles
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Nom complet</p>
                <p className="text-gray-900 font-medium">{fullName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Email</p>
                <p className="text-gray-900">{user.email || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Téléphone</p>
                <p className="text-gray-900">{user.phone || 'N/A'}</p>
              </div>
            </div>
            {user.address && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Adresse</p>
                  <p className="text-gray-900">{user.address}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div className="flex-1">
                <p className="text-sm text-gray-600">Membre depuis</p>
                <p className="text-gray-900">{formatDate(user.createdAt)}</p>
              </div>
            </div>
            {user.subscription && (
              <div className="flex items-center gap-3 mt-4 pt-4 border-t">
                <TrendingUp className="w-5 h-5 text-green-500" />
                <div className="flex-1">
                  <p className="text-sm text-gray-600">Abonnement actif</p>
                  <p className="text-gray-900 font-medium">{user.subscription.planName} - {user.subscription.packageType}</p>
                  <p className="text-sm text-gray-500">Expire le {formatDate(user.subscription.endDate)}</p>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Statistiques et Scores
          </h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Score de fiabilité</span>
                <span className="text-gray-900 font-medium">{(user.reliabilityScore || 0).toFixed(1)}/5</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${((user.reliabilityScore || 0) / 5) * 100}%` }}
                ></div>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Nombre de trajets</span>
                <span className="text-gray-900 font-medium">{user.totalTrips || 0}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${Math.min(((user.totalTrips || 0) / 50) * 100, 100)}%` }}
                ></div>
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="text-sm text-gray-600 mb-2">Statut du compte</p>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${user.status === 'active' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <p className="text-gray-900 font-medium">
                  {user.status === 'active' ? 'Compte actif' : user.status === 'blocked' ? 'Compte bloqué' : 'En attente de validation'}
                </p>
              </div>
              {user.isActive !== undefined && (
                <p className="text-sm text-gray-500 mt-1">
                  {user.isActive ? 'Compte activé' : 'Compte désactivé'}
                </p>
              )}
            </div>

            {user.negativeBalance && user.negativeBalance > 0 && (
              <div className="pt-3 border-t">
                <p className="text-sm text-gray-600 mb-2">Solde négatif</p>
                <p className="text-red-600 font-medium">{formatCurrency(user.negativeBalance)}</p>
                <p className="text-xs text-red-500 mt-1">Ce montant doit être remboursé</p>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="trips" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="trips">
            <Bike className="w-4 h-4 mr-2" />
            Historique des Trajets ({rides.length})
          </TabsTrigger>
          
          <ProtectedAccess mode="component" resource="wallet" action="read">
            <TabsTrigger value="transactions">
              <CreditCard className="w-4 h-4 mr-2" />
              Transactions ({transactions.length})
            </TabsTrigger>
          </ProtectedAccess>
          
          <TabsTrigger value="incidents">
            <AlertTriangle className="w-4 h-4 mr-2" />
            Incidents ({incidents.length})
          </TabsTrigger>
          
          <TabsTrigger value="requests">
            <History className="w-4 h-4 mr-2" />
            Demandes ({requests.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="w-4 h-4 mr-2" />
            Documents
          </TabsTrigger>
        </TabsList>

        {/* Historique des Trajets */}
        <TabsContent value="trips">
          <Card>
            {rides.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Vélo</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Durée</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Distance</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Coût</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rides.map((ride) => (
                      <tr key={ride.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-900">
                          {formatDate(ride.startTime)}
                        </td>
                        <td className="p-4 text-sm text-gray-900 font-medium">
                          {ride.bikeName || 'N/A'}
                        </td>
                        <td className="p-4 text-sm text-gray-900">
                          {ride.duration ? `${Math.floor(ride.duration / 60)}min ${ride.duration % 60}s` : '-'}
                        </td>
                        <td className="p-4 text-sm text-gray-900">
                          {ride.distance ? `${(ride.distance / 1000).toFixed(1)}km` : '-'}
                        </td>
                        <td className="p-4 text-sm text-gray-900 font-medium">
                          {ride.cost ? formatCurrency(ride.cost) : '-'}
                        </td>
                        <td className="p-4">
                          <Badge 
                            className={
                              ride.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                              ride.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                              'bg-red-100 text-red-800'
                            }
                          >
                            {ride.status === 'COMPLETED' ? 'Terminé' :
                             ride.status === 'IN_PROGRESS' ? 'En cours' : 'Annulé'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Bike className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">Aucun trajet trouvé</p>
                <p className="text-sm">Cet utilisateur n'a encore effectué aucun trajet</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Transactions */}
        <ProtectedAccess 
          mode="component" 
          resource="wallet" 
          action="read"
          fallback={
            <Card className="p-12">
              <div className="text-center text-gray-500">
                <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                <p>Vous n'avez pas les permissions pour voir les transactions</p>
              </div>
            </Card>
          }
        >
          <TabsContent value="transactions">
            <Card>
              {transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Type</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Description</th>
                        <th className="text-right p-4 text-sm font-medium text-gray-600">Montant</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Statut</th>
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Validateur</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((transaction) => (
                        <tr key={transaction.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-sm text-gray-900">
                            {formatDate(transaction.createdAt)}
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            <Badge variant="outline">
                              {transaction.type === 'DEPOSIT' ? 'Dépôt' :
                               transaction.type === 'WITHDRAWAL' ? 'Retrait' :
                               transaction.type === 'RIDE_PAYMENT' ? 'Trajet' :
                               transaction.type === 'REFUND' ? 'Remboursement' :
                               transaction.type === 'DEPOSIT_RECHARGE' ? 'Recharge caution' :
                               transaction.type === 'DAMAGE_CHARGE' ? 'Frais dégâts' :
                               transaction.type === 'SUBSCRIPTION_PAYMENT' ? 'Abonnement' : 'Autre'}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {transaction.metadata?.description || 
                             (transaction.type === 'RIDE_PAYMENT' ? 'Paiement trajet' :
                              transaction.type === 'DEPOSIT' ? 'Recharge wallet' : 'Transaction')}
                          </td>
                          <td className={`p-4 text-sm text-right font-medium ${
                            transaction.type === 'DEPOSIT' || transaction.type === 'REFUND' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'DEPOSIT' || transaction.type === 'REFUND' ? '+' : '-'}
                            {formatCurrency(transaction.amount)}
                          </td>
                          <td className="p-4">
                            <Badge 
                              className={
                                transaction.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                                transaction.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                                transaction.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }
                            >
                              {transaction.status === 'COMPLETED' ? 'Complété' :
                               transaction.status === 'PENDING' ? 'En attente' :
                               transaction.status === 'FAILED' ? 'Échoué' : 'Annulé'}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {transaction.validatedBy || '-'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">Aucune transaction trouvée</p>
                <p className="text-sm">Cet utilisateur n'a encore effectué aucune transaction</p>
              </div>
            )}
          </Card>
        </TabsContent>
        </ProtectedAccess>

        {/* Incidents */}
        <TabsContent value="incidents">
          <Card>
            {incidents.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Description</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Vélo</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Statut</th>
                      <th className="text-right p-4 text-sm font-medium text-gray-600">Remboursement</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Admin</th>
                      {canManageIncidents && (
                        <th className="text-left p-4 text-sm font-medium text-gray-600">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {incidents.map((incident) => {
                      const isAdminCharge = incident.type === 'admin_charge';
                      const canEditCharge = isAdminCharge && canManageIncidents && (isSuperAdmin || incident.resolvedBy === currentUser?.id);
                      const canDeleteCharge = isAdminCharge && canManageIncidents && (isSuperAdmin || incident.resolvedBy === currentUser?.id);
                      
                      return (
                        <tr key={incident.id} className="border-b hover:bg-gray-50 transition-colors">
                          <td className="p-4 text-sm text-gray-900">
                            {formatDate(incident.createdAt)}
                          </td>
                          <td className="p-4">
                            <Badge variant="outline">
                              {incident.type === 'admin_charge' ? 'Charge admin' :
                               incident.type === 'technical' ? 'Technique' :
                               incident.type === 'accident' ? 'Accident' :
                               incident.type === 'damaged' ? 'Endommagé' :
                               incident.type === 'payment' ? 'Paiement' :
                               incident.type === 'theft' ? 'Vol' : incident.type}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {incident.description}
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {incident.bikeName || incident.bike?.code || 'N/A'}
                          </td>
                          <td className="p-4">
                            <Badge 
                              className={
                                incident.status === 'RESOLVED' ? 'bg-green-100 text-green-800' :
                                incident.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                                incident.status === 'CLOSED' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }
                            >
                              {incident.status === 'OPEN' ? 'En attente' :
                               incident.status === 'IN_PROGRESS' ? 'En traitement' :
                               incident.status === 'RESOLVED' ? 'Résolu' : 'Fermé'}
                            </Badge>
                          </td>
                          <td className="p-4 text-sm text-gray-900 text-right font-medium">
                            {incident.refundAmount ? formatCurrency(incident.refundAmount) : '-'}
                          </td>
                          <td className="p-4 text-sm text-gray-900">
                            {incident.resolvedBy || incident.adminNote ? 'Oui' : 'Non'}
                          </td>
                          {canManageIncidents && (
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {canEditCharge && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedChargeId(incident.id);
                                      setChargeEditModalOpen(true);
                                    }}
                                    className="h-8 w-8 p-0"
                                    aria-label="Modifier la charge"
                                  >
                                    <Edit className="w-4 h-4 text-blue-600" />
                                  </Button>
                                )}
                                {canDeleteCharge && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={async () => {
                                      if (window.confirm('Êtes-vous sûr de vouloir supprimer cette charge ? Le montant sera remboursé à l\'utilisateur.')) {
                                        try {
                                          await incidentService.deleteAdminCharge(incident.id);
                                          toast.success('Charge supprimée avec succès');
                                          loadUserData();
                                        } catch (error: any) {
                                          toast.error(error.message || 'Erreur lors de la suppression de la charge');
                                        }
                                      }
                                    }}
                                    className="h-8 w-8 p-0"
                                    aria-label="Supprimer la charge"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">Aucun incident trouvé</p>
                <p className="text-sm">Cet utilisateur n'a signalé aucun incident</p>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Demandes */}
        <TabsContent value="requests">
          <Card>
            {requests.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Date</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Type</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Vélo</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Statut</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Validateur</th>
                      <th className="text-left p-4 text-sm font-medium text-gray-600">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((request) => (
                      <tr key={request.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-sm text-gray-900">
                          {formatDate(request.createdAt || request.requestedAt)}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {request.type === 'unlock' ? (
                              <Unlock className="w-4 h-4 text-blue-500" />
                            ) : (
                              <Lock className="w-4 h-4 text-green-500" />
                            )}
                            <Badge variant="outline">
                              {request.type === 'unlock' ? 'Déverrouillage' : 'Verrouillage'}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-4 text-sm text-gray-900 font-medium">
                          {request.bike?.code || request.bikeName || 'N/A'}
                        </td>
                        <td className="p-4">
                          <Badge 
                            className={
                              request.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                              request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }
                          >
                            {request.status === 'PENDING' ? 'En attente' :
                             request.status === 'APPROVED' ? 'Approuvé' : 'Rejeté'}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-gray-900">
                          {request.validatedBy || '-'}
                        </td>
                        <td className="p-4 text-sm text-gray-900">
                          {request.adminNote || request.rejectionReason || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg">Aucune demande trouvée</p>
                <p className="text-sm">Cet utilisateur n'a fait aucune demande</p>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Documents d'identité et preuve de résidence
                </h3>
                {documentsStatus?.allDocumentsApproved && user?.status === 'pending_verification' && (
                  <Button
                    onClick={async () => {
                      if (!userId) return;
                      try {
                        setDocumentActionLoading('verify');
                        await documentService.verifyUserAccount(userId);
                        toast.success('Compte utilisateur validé avec succès');
                        await loadUserData();
                      } catch (error: any) {
                        toast.error(error.message || 'Erreur lors de la validation');
                      } finally {
                        setDocumentActionLoading(null);
                      }
                    }}
                    disabled={documentActionLoading === 'verify'}
                  >
                    {documentActionLoading === 'verify' ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    ) : (
                      <CheckCircle className="w-4 h-4 mr-2" />
                    )}
                    Valider le compte
                  </Button>
                )}
              </div>

              {/* Verification Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="w-5 h-5" color={user?.emailVerified ? '#16a34a' : '#d97706'} />
                    <span className="font-semibold">Email</span>
                  </div>
                  <Badge variant={user?.emailVerified ? 'default' : 'secondary'}>
                    {user?.emailVerified ? 'Vérifié' : 'Non vérifié'}
                  </Badge>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-5 h-5" color={user?.phoneVerified ? '#16a34a' : '#d97706'} />
                    <span className="font-semibold">Téléphone</span>
                  </div>
                  <Badge variant={user?.phoneVerified ? 'default' : 'secondary'} className="mb-2">
                    {user?.phoneVerified ? 'Vérifié' : 'Non vérifié'}
                  </Badge>
                  {!user?.phoneVerified && canUpdateUser && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleVerifyPhone}
                      disabled={actionLoading}
                      className="mt-2 w-full"
                    >
                      {actionLoading ? 'Validation...' : 'Valider manuellement'}
                    </Button>
                  )}
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5" color={user?.accountVerified ? '#16a34a' : '#d97706'} />
                    <span className="font-semibold">Compte</span>
                  </div>
                  <Badge variant={user?.accountVerified ? 'default' : 'secondary'}>
                    {user?.accountVerified ? 'Validé' : 'En attente'}
                  </Badge>
                </Card>
              </div>

              {/* Identity Documents */}
              <div className="space-y-4">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documents d'identité
                </h4>
                {documentsStatus?.identityDocuments && documentsStatus.identityDocuments.length > 0 ? (
                  documentsStatus.identityDocuments.map((doc) => (
                    <Card key={doc.id} className="p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold">
                              {doc.documentType === 'CNI' ? 'CNI' : 'Récépissé'}
                            </span>
                            <Badge variant={
                              doc.status === 'APPROVED' ? 'default' :
                              doc.status === 'REJECTED' ? 'destructive' : 'secondary'
                            }>
                              {doc.status === 'APPROVED' ? 'Approuvé' :
                               doc.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500">
                            Soumis le {new Date(doc.submittedAt).toLocaleDateString('fr-FR')}
                          </p>
                          {doc.rejectionReason && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                              <p className="text-sm text-red-800">
                                <strong>Raison du rejet:</strong> {doc.rejectionReason}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const baseUrl = ((import.meta as any).env.VITE_API_URL).replace('/api/v1', '');
                              window.open(`${baseUrl}${doc.frontImage}`, '_blank');
                            }}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Recto
                          </Button>
                          {doc.backImage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const baseUrl = ((import.meta as any).env.VITE_API_URL).replace('/api/v1', '');
                                window.open(`${baseUrl}${doc.backImage}`, '_blank');
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Verso
                            </Button>
                          )}
                          {doc.selfieImage && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const baseUrl = ((import.meta as any).env.VITE_API_URL).replace('/api/v1', '');
                                window.open(`${baseUrl}${doc.selfieImage}`, '_blank');
                              }}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Selfie
                            </Button>
                          )}
                        </div>
                      </div>
                      {doc.status === 'PENDING' && (
                        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={async () => {
                              try {
                                setDocumentActionLoading(`approve-${doc.id}`);
                                await documentService.approveIdentityDocument(doc.id);
                                toast.success('Document approuvé');
                                await loadUserData();
                              } catch (error: any) {
                                toast.error(error.message || 'Erreur');
                              } finally {
                                setDocumentActionLoading(null);
                              }
                            }}
                            disabled={documentActionLoading === `approve-${doc.id}`}
                          >
                            <Check className="w-4 h-4 mr-2" />
                            Approuver
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setRejectDialog({
                              open: true,
                              type: 'identity',
                              documentId: doc.id,
                              reason: ''
                            })}
                            disabled={documentActionLoading === `reject-${doc.id}`}
                          >
                            <X className="w-4 h-4 mr-2" />
                            Rejeter
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))
                ) : (
                  <Card className="p-6 text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-400" />
                    <p className="text-gray-500">Aucun document d'identité soumis</p>
                  </Card>
                )}
              </div>

              {/* Residence Proof */}
              <div className="space-y-4 mt-6">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4" />
                  Preuve de résidence
                </h4>
                {documentsStatus?.residenceProof ? (
                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">
                            {documentsStatus.residenceProof.proofType === 'DOCUMENT' 
                              ? 'Document' 
                              : 'Coordonnées GPS'}
                          </span>
                          <Badge variant={
                            documentsStatus.residenceProof.status === 'APPROVED' ? 'default' :
                            documentsStatus.residenceProof.status === 'REJECTED' ? 'destructive' : 'secondary'
                          }>
                            {documentsStatus.residenceProof.status === 'APPROVED' ? 'Approuvé' :
                             documentsStatus.residenceProof.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          Soumis le {new Date(documentsStatus.residenceProof.submittedAt).toLocaleDateString('fr-FR')}
                        </p>
                        {documentsStatus.residenceProof.address && (
                          <p className="text-sm text-gray-600">
                            <strong>Adresse:</strong> {documentsStatus.residenceProof.address}
                          </p>
                        )}
                        {documentsStatus.residenceProof.latitude && documentsStatus.residenceProof.longitude && (
                          <p className="text-sm text-gray-600">
                            <strong>Coordonnées:</strong> {documentsStatus.residenceProof.latitude.toFixed(6)}, {documentsStatus.residenceProof.longitude.toFixed(6)}
                          </p>
                        )}
                        {documentsStatus.residenceProof.details && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Détails:</strong> {documentsStatus.residenceProof.details}
                          </p>
                        )}
                        {documentsStatus.residenceProof.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">
                              <strong>Raison du rejet:</strong> {documentsStatus.residenceProof.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                      {documentsStatus.residenceProof.documentFile && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const baseUrl = (((import.meta as any).env.VITE_API_URL)).replace('/api/v1', '');
                            window.open(`${baseUrl}${documentsStatus.residenceProof?.documentFile}`, '_blank');
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                      )}
                    </div>
                    {documentsStatus.residenceProof.status === 'PENDING' && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            if (!documentsStatus.residenceProof) return;
                            try {
                              setDocumentActionLoading(`approve-res-${documentsStatus.residenceProof.id}`);
                              await documentService.approveResidenceProof(documentsStatus.residenceProof.id);
                              toast.success('Preuve de résidence approuvée');
                              await loadUserData();
                            } catch (error: any) {
                              toast.error(error.message || 'Erreur');
                            } finally {
                              setDocumentActionLoading(null);
                            }
                          }}
                          disabled={documentActionLoading === `approve-res-${documentsStatus.residenceProof.id}`}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approuver
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectDialog({
                            open: true,
                            type: 'residence',
                            documentId: documentsStatus.residenceProof!.id,
                            reason: ''
                          })}
                          disabled={documentActionLoading === `reject-res-${documentsStatus.residenceProof.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Rejeter
                        </Button>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card className="p-6 text-center">
                    <MapPinIcon className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-400" />
                    <p className="text-gray-500">Aucune preuve de résidence soumise</p>
                  </Card>
                )}
              </div>

              {/* Activity Location Proof */}
              <div className="space-y-4 mt-6">
                <h4 className="text-md font-semibold flex items-center gap-2">
                  <MapPinIcon className="w-4 h-4" />
                  Preuve de localisation d'activité
                </h4>
                {documentsStatus?.activityLocationProof ? (
                  <Card className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold">
                            {documentsStatus.activityLocationProof.proofType === 'DOCUMENT' 
                              ? 'Document' 
                              : 'Coordonnées GPS'}
                          </span>
                          <Badge variant={
                            documentsStatus.activityLocationProof.status === 'APPROVED' ? 'default' :
                            documentsStatus.activityLocationProof.status === 'REJECTED' ? 'destructive' : 'secondary'
                          }>
                            {documentsStatus.activityLocationProof.status === 'APPROVED' ? 'Approuvé' :
                             documentsStatus.activityLocationProof.status === 'REJECTED' ? 'Rejeté' : 'En attente'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-500 mb-2">
                          Soumis le {new Date(documentsStatus.activityLocationProof.submittedAt).toLocaleDateString('fr-FR')}
                        </p>
                        {documentsStatus.activityLocationProof.address && (
                          <p className="text-sm text-gray-600">
                            <strong>Adresse:</strong> {documentsStatus.activityLocationProof.address}
                          </p>
                        )}
                        {documentsStatus.activityLocationProof.latitude && documentsStatus.activityLocationProof.longitude && (
                          <p className="text-sm text-gray-600">
                            <strong>Coordonnées:</strong> {documentsStatus.activityLocationProof.latitude.toFixed(6)}, {documentsStatus.activityLocationProof.longitude.toFixed(6)}
                          </p>
                        )}
                        {documentsStatus.activityLocationProof.details && (
                          <p className="text-sm text-gray-600 mt-2">
                            <strong>Détails:</strong> {documentsStatus.activityLocationProof.details}
                          </p>
                        )}
                        {documentsStatus.activityLocationProof.rejectionReason && (
                          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                            <p className="text-sm text-red-800">
                              <strong>Raison du rejet:</strong> {documentsStatus.activityLocationProof.rejectionReason}
                            </p>
                          </div>
                        )}
                      </div>
                      {documentsStatus.activityLocationProof.documentFile && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const baseUrl = (((import.meta as any).env.VITE_API_URL)).replace('/api/v1', '');
                            window.open(`${baseUrl}${documentsStatus.activityLocationProof?.documentFile}`, '_blank');
                          }}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Télécharger
                        </Button>
                      )}
                    </div>
                    {documentsStatus.activityLocationProof.status === 'PENDING' && (
                      <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                        <Button
                          variant="default"
                          size="sm"
                          onClick={async () => {
                            if (!documentsStatus.activityLocationProof) return;
                            try {
                              setDocumentActionLoading(`approve-act-${documentsStatus.activityLocationProof.id}`);
                              await documentService.approveActivityLocationProof(documentsStatus.activityLocationProof.id);
                              toast.success('Preuve de localisation d\'activité approuvée');
                              await loadUserData();
                            } catch (error: any) {
                              toast.error(error.message || 'Erreur');
                            } finally {
                              setDocumentActionLoading(null);
                            }
                          }}
                          disabled={documentActionLoading === `approve-act-${documentsStatus.activityLocationProof.id}`}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approuver
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setRejectDialog({
                            open: true,
                            type: 'activity',
                            documentId: documentsStatus.activityLocationProof!.id,
                            reason: ''
                          })}
                          disabled={documentActionLoading === `reject-act-${documentsStatus.activityLocationProof.id}`}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Rejeter
                        </Button>
                      </div>
                    )}
                  </Card>
                ) : (
                  <Card className="p-6 text-center">
                    <MapPinIcon className="w-12 h-12 mx-auto mb-3 opacity-50 text-gray-400" />
                    <p className="text-gray-500">Aucune preuve de localisation d'activité soumise</p>
                  </Card>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ ...rejectDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeter le document</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du rejet. Cette raison sera visible par l'utilisateur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Raison du rejet *</label>
              <textarea
                className="w-full mt-1 p-2 border rounded-md"
                rows={4}
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog({ ...rejectDialog, reason: e.target.value })}
                placeholder="Ex: Photo floue, document expiré, coordonnées incorrectes..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialog({ open: false, type: null, documentId: null, reason: '' })}
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!rejectDialog.documentId || !rejectDialog.reason.trim()) {
                  toast.error('Veuillez indiquer une raison');
                  return;
                }
                try {
                  setDocumentActionLoading(`reject-${rejectDialog.documentId}`);
                  if (rejectDialog.type === 'identity') {
                    await documentService.rejectIdentityDocument(rejectDialog.documentId, rejectDialog.reason);
                  } else if (rejectDialog.type === 'residence') {
                    await documentService.rejectResidenceProof(rejectDialog.documentId, rejectDialog.reason);
                  } else if (rejectDialog.type === 'activity') {
                    await documentService.rejectActivityLocationProof(rejectDialog.documentId, rejectDialog.reason);
                  }
                  toast.success('Document rejeté');
                  setRejectDialog({ open: false, type: null, documentId: null, reason: '' });
                  await loadUserData();
                } catch (error: any) {
                  toast.error(error.message || 'Erreur');
                } finally {
                  setDocumentActionLoading(null);
                }
              }}
              disabled={!rejectDialog.reason.trim() || documentActionLoading !== null}
            >
              Rejeter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation */}
      <Dialog open={confirmDialog.open} onOpenChange={closeConfirmDialog}>
        <DialogContent aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog.type === 'block' ? 'Bloquer l\'utilisateur' : 'Débloquer l\'utilisateur'}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog.type === 'block' 
                ? `Êtes-vous sûr de vouloir bloquer l'utilisateur "${fullName}" ? Cette action empêchera l'utilisateur d'accéder au service et d'effectuer des trajets.`
                : `Êtes-vous sûr de vouloir débloquer l'utilisateur "${fullName}" ? Cette action permettra à l'utilisateur d'accéder à nouveau au service et d'effectuer des trajets.`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={closeConfirmDialog}
              disabled={confirmDialog.loading}
            >
              Annuler
            </Button>
            <Button 
              variant={confirmDialog.type === 'block' ? 'destructive' : 'default'}
              onClick={handleConfirmAction}
              disabled={confirmDialog.loading}
            >
              {confirmDialog.loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : confirmDialog.type === 'block' ? (
                <Ban className="w-4 h-4 mr-2" />
              ) : (
                <CheckCircle className="w-4 h-4 mr-2" />
              )}
              {confirmDialog.type === 'block' ? 'Bloquer' : 'Débloquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AdminChargeModal
        open={chargeModalOpen}
        onClose={() => setChargeModalOpen(false)}
        onSuccess={loadUserData}
        preselectedUserId={userId || undefined}
      />

      <AdminChargeModal
        open={chargeEditModalOpen}
        onClose={() => {
          setChargeEditModalOpen(false);
          setSelectedChargeId(null);
        }}
        onSuccess={loadUserData}
        chargeId={selectedChargeId || undefined}
        isEditMode={true}
      />

      {/* Deposit Exemption Dialog */}
      <Dialog open={depositExemptionModalOpen} onOpenChange={setDepositExemptionModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gérer l'exemption de caution</DialogTitle>
            <DialogDescription>
              Permet de débloquer le compte utilisateur sans caution pour une période donnée.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date() ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                <p>
                  Exemption active jusqu'au: {new Date(user.depositExemptionUntil).toLocaleDateString('fr-FR')}
                </p>
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium">Nombre de jours *</label>
                <input
                  type="number"
                  id="exemption-days"
                  min="1"
                  max="365"
                  className="w-full mt-1 p-2 border rounded-md"
                  placeholder="Ex: 30"
                  onChange={(e) => {
                    const days = parseInt(e.target.value);
                    if (days >= 1 && days <= 365) {
                      setDepositExemptionDays(days);
                    }
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Entre 1 et 365 jours
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositExemptionModalOpen(false)}>
              Annuler
            </Button>
            {user?.depositExemptionUntil && new Date(user.depositExemptionUntil) > new Date() ? (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!userId) return;
                  try {
                    setActionLoading(true);
                    await userService.revokeDepositExemption(userId);
                    toast.success('Exemption de caution retirée avec succès');
                    await loadUserData();
                    setDepositExemptionModalOpen(false);
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors du retrait de l\'exemption');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <X className="w-4 h-4 mr-2" />
                )}
                Retirer l'exemption
              </Button>
            ) : (
              <Button
                onClick={async () => {
                  if (!userId || !depositExemptionDays) {
                    toast.error('Veuillez entrer un nombre de jours');
                    return;
                  }
                  try {
                    setActionLoading(true);
                    await userService.grantDepositExemption(userId, depositExemptionDays);
                    toast.success(`Exemption de caution accordée pour ${depositExemptionDays} jour(s)`);
                    await loadUserData();
                    setDepositExemptionModalOpen(false);
                    setDepositExemptionDays(0);
                  } catch (error: any) {
                    toast.error(error.message || 'Erreur lors de l\'octroi de l\'exemption');
                  } finally {
                    setActionLoading(false);
                  }
                }}
                disabled={actionLoading || !depositExemptionDays}
              >
                {actionLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Accorder l'exemption
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}