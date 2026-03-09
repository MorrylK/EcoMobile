import React, { useState, useEffect, useRef } from 'react';
import { Unlock, Lock, Eye, Check, X, Clock, Download, ZoomIn, ZoomOut, X as XIcon } from 'lucide-react';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../ui/dialog';
import { Textarea } from '../../ui/textarea';
import { bikeActionService, type UnlockRequest, type LockRequest } from '../../../services/api/bikeAction.service';
import { toast } from 'sonner';
import { useTranslation } from '../../../lib/i18n';

declare global {
  interface ImportMeta {
    readonly env: Record<string, string>;
  }
}

type BikeRequest = UnlockRequest | LockRequest;

function ImageGallery({ images, title }: { images: string[], title: string }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  
  const handleDownload = async (imageUrl: string, index: number, title: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `inspection-${title}-${index + 1}${getFileExtension(imageUrl)}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      window.URL.revokeObjectURL(url);
      toast.success('Image téléchargée');
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      toast.error('Erreur lors du téléchargement');
    }
  };

  const getFileExtension = (url: string): string => {
    const match = url.match(/\.(jpeg|jpg|png|gif|webp|svg)(\?.*)?$/i);
    return match ? `.${match[1]}` : '.jpg';
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const resetZoom = () => {
    setZoom(1);
  };

  if (images.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        <p>Aucune image disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium">{t('bikeActions.inspectionPhotos', { count: images.length }) || `Photos d'inspection (${images.length})`}</h4>
        {selectedImage && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={resetZoom}>
              {Math.round(zoom * 100)}%
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleDownload(selectedImage, images.indexOf(selectedImage), String(Date.now()))}>
              <Download className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
      
      {/* Image sélectionnée en grand */}
      {selectedImage && (
        <div className="relative border rounded-lg overflow-hidden bg-gray-50">
          <div className="absolute top-2 right-2 z-10">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setSelectedImage(null)}
              className="h-8 w-8 p-0"
            >
              <XIcon className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center justify-center p-4">
            <img
              src={selectedImage}
              alt={`Inspection ${title}`}
              className="rounded-lg shadow-lg max-h-[500px] object-contain transition-transform duration-200"
              style={{ transform: `scale(${zoom})` }}
              onClick={() => window.open(selectedImage, '_blank')}
              onError={(e) => {
                console.error('Erreur de chargement d\'image:', selectedImage);
                toast.error('Impossible de charger l\'image');
              }}
            />
          </div>
          <div className="p-2 bg-gray-100 text-center text-sm text-gray-600">
            Cliquez sur l'image pour l'ouvrir dans un nouvel onglet
          </div>
        </div>
      )}

      {/* Galerie miniature */}
      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
        {images.map((image, index) => (
          <div
            key={index}
            className={`relative cursor-pointer border rounded-lg overflow-hidden hover:shadow-md transition-shadow ${
              selectedImage === image ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedImage(image)}
          >
            <img
              src={image}
              alt={`Photo ${index + 1}`}
              className="w-full h-24 object-cover"
              onError={(e) => {
                console.error('Erreur de chargement d\'image:', image);
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
            <div className="absolute bottom-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1">
              {index + 1}
            </div>
            <div className="absolute top-1 right-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-white bg-opacity-80 hover:bg-white"
                onClick={(e: { stopPropagation: () => void; }) => {
                  e.stopPropagation();
                  handleDownload(image, index, String(Date.now()));
                }}
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function BikeActionManagement() {
  const { t } = useTranslation();
  const [requests, setRequests] = useState<{
    unlock: BikeRequest[];
    lock: BikeRequest[];
  }>({
    unlock: [],
    lock: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'unlock' | 'lock'>('unlock');
  const [selectedRequest, setSelectedRequest] = useState<BikeRequest | null>(null);
  const [validationAction, setValidationAction] = useState<'approve' | 'reject' | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [inspectionModal, setInspectionModal] = useState<{open: boolean; request: BikeRequest | null; type: 'unlock' | 'lock' | null;}>({open: false, request: null, type: null});
  
  // Référence pour éviter les appels multiples simultanés
  const isLoadingRef = useRef(false);

  const openInspectionModal = (request: BikeRequest, type: 'unlock' | 'lock') => {
    setInspectionModal({
      open: true,
      request,
      type
    });
  };

  const loadRequests = async () => {
    // Éviter les appels multiples simultanés
    if (isLoadingRef.current) return;
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      if (activeTab === 'unlock') {
        const data = await bikeActionService.getUnlockRequests();
        setRequests(prev => ({ ...prev, unlock: data }));
      } else {
        const data = await bikeActionService.getLockRequests();
        setRequests(prev => ({ ...prev, lock: data }));
      }
    } catch (error) {
      toast.error('Erreur lors du chargement des demandes');
      console.error(error);
    } finally {
      setIsLoading(false);
      isLoadingRef.current = false;
    }
  };

  // Charger les données uniquement au montage et lors du changement d'onglet
  useEffect(() => {
    loadRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // activeTab est la seule dépendance nécessaire

  const handleValidateRequest = async () => {
    if (!selectedRequest || !validationAction) return;

    try {
      if (activeTab === 'unlock') {
        await bikeActionService.validateUnlockRequest(selectedRequest.id, {
          approved: validationAction === 'approve',
          adminNote
        });
      } else {
        await bikeActionService.validateLockRequest(selectedRequest.id, {
          approved: validationAction === 'approve',
          adminNote
        });
      }

      toast.success(`Demande ${validationAction === 'approve' ? 'approuvée' : 'rejetée'} avec succès`);
      setSelectedRequest(null);
      setValidationAction(null);
      setAdminNote('');
      loadRequests();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la validation');
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'PENDING': { label: t('bikeActions.status.pending') || 'En attente', variant: 'outline' },
      'APPROVED': { label: t('bikeActions.status.approved') || 'Approuvée', variant: 'default' },
      'REJECTED': { label: t('bikeActions.status.rejected') || 'Rejetée', variant: 'destructive' }
    };
    const config = variants[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getRequestImages = (request: BikeRequest): string[] => {
    const images: string[] = [];
    
    if ('metadata' in request && request.metadata?.inspectionData?.photos) {
      images.push(...request.metadata.inspectionData.photos);
    }
    
    if ('metadata' in request && request.metadata?.inspection?.photos) {
      images.push(...request.metadata.inspection.photos);
    }
    
    // Obtenir l'URL de base sans /api/v1 pour les images statiques
    const getBaseUrl = () => {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
      // Enlever /api/v1 si présent
      return apiUrl.replace(/\/api\/v1\/?$/, '');
    };

    const baseUrl = getBaseUrl();
    
    return images
    .filter(img => img && img.trim() !== '')
    .map(img => {
      if (img.startsWith('http://') || img.startsWith('https://') || img.startsWith('data:')) {
        return img;
      }
      return `${baseUrl}${img.startsWith('/') ? img : '/' + img}`;
    });
  };

  const currentRequests = activeTab === 'unlock' ? requests.unlock : requests.lock;
  const pendingRequests = currentRequests.filter(r => r.status === 'PENDING');

  // Fonction pour obtenir les statistiques
  const getStats = () => {
    const pendingUnlock = requests.unlock.filter(r => r.status === 'PENDING').length;
    const pendingLock = requests.lock.filter(r => r.status === 'PENDING').length;
    const today = new Date().toDateString();
    
    const todayUnlock = requests.unlock.filter(r => 
      new Date(r.requestedAt).toDateString() === today
    ).length;
    
    const todayLock = requests.lock.filter(r => 
      new Date(r.requestedAt).toDateString() === today
    ).length;

    return {
      pendingUnlock,
      pendingLock,
      todayUnlock,
      todayLock
    };
  };

  const stats = getStats();

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-green-600">{t('bikeActions.management') || 'Gestion des Actions Vélos'}</h1>
        <p className="text-gray-600">Validation des demandes de déverrouillage et verrouillage</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('bikeActions.pendingUnlocks') || 'Déverrouillages en attente'}</p>
              <p className="text-gray-900">{stats.pendingUnlock}</p>
            </div>
            <div className="bg-orange-100 text-orange-600 p-3 rounded-lg">
              <Unlock className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('bikeActions.pendingLocks') || 'Verrouillages en attente'}</p>
              <p className="text-gray-900">{stats.pendingLock}</p>
            </div>
            <div className="bg-blue-100 text-blue-600 p-3 rounded-lg">
              <Lock className="w-6 h-6" />
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">{t('bikeActions.todayActions') || 'Actions aujourd\'hui'}</p>
              <p className="text-gray-900">
                {activeTab === 'unlock' ? stats.todayUnlock : stats.todayLock}
              </p>
            </div>
            <div className="bg-purple-100 text-purple-600 p-3 rounded-lg">
              <Clock className="w-6 h-6" />
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <button
          onClick={() => setActiveTab('unlock')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'unlock'
              ? 'bg-white text-orange-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Unlock className="w-4 h-4" />
          {t('bikeActions.unlocks', { count: stats.pendingUnlock }) || `Déverrouillages (${stats.pendingUnlock})`}
        </button>
        <button
          onClick={() => setActiveTab('lock')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'lock'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          <Lock className="w-4 h-4" />
          {t('bikeActions.locks', { count: stats.pendingLock }) || `Verrouillages (${stats.pendingLock})`}
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-4">
        {isLoading ? (
          <Card className="p-12">
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Clock className="w-6 h-6 animate-spin" />
              </div>
              <p>Chargement des demandes...</p>
            </div>
          </Card>
        ) : pendingRequests.length === 0 ? (
          <Card className="p-12">
            <div className="text-center text-gray-500">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                {activeTab === 'unlock' ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
              </div>
              <p>Aucune demande de {activeTab === 'unlock' ? 'déverrouillage' : 'verrouillage'} en attente</p>
            </div>
          </Card>
        ) : (
          pendingRequests.map((request) => {
            const images = getRequestImages(request);
            
            return (
              <Card key={request.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      activeTab === 'unlock' 
                        ? 'bg-orange-100 text-orange-600' 
                        : 'bg-blue-100 text-blue-600'
                    }`}>
                      {activeTab === 'unlock' ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="text-gray-900 font-medium">
                        {request.user?.firstName} {request.user?.lastName}
                      </h4>
                      <p className="text-sm text-gray-600">{request.user?.email}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span>Vélo: {request.bike?.code}</span>
                        <span>•</span>
                        <span>{new Date(request.requestedAt).toLocaleString('fr-FR')}</span>
                      </div>
                      
                      {/* Miniature des images s'il y en a */}
                      {images.length > 0 && (
                        <div className="mt-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-gray-600 font-medium">
                              Photos: {images.length}
                            </span>
                            <Badge variant="outline" size="sm">
                              Cliquer pour voir
                            </Badge>
                          </div>
                          <div className="flex gap-2">
                            {images.slice(0, 3).map((img, index) => (
                              <div
                                key={index}
                                className="w-16 h-16 border rounded-md overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                                onClick={() => openInspectionModal(request, activeTab)}
                              >
                                <img
                                  src={img}
                                  alt={`Photo ${index + 1}`}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    console.error('Erreur de chargement d\'image:', img);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </div>
                            ))}
                            {images.length > 3 && (
                              <div 
                                className="w-16 h-16 border rounded-md flex items-center justify-center bg-gray-100 text-gray-500 text-sm cursor-pointer hover:bg-gray-200 transition-colors"
                                onClick={() => openInspectionModal(request, activeTab)}
                              >
                                +{images.length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Données d'inspection */}
                      {'metadata' in request && request.metadata?.inspectionData && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                          <h5 className="text-xs font-medium text-gray-700 mb-2">Inspection du vélo:</h5>
                          
                          {request.metadata.inspectionData.issues?.length > 0 ? (
                            <div className="mb-2">
                              <span className="text-xs text-red-600 font-medium">Problèmes signalés:</span>
                              <ul className="text-xs text-red-700 mt-1 ml-4">
                                {request.metadata.inspectionData.issues.map((issue: string, index: number) => (
                                  <li key={index}>• {issue}</li>
                                ))}
                              </ul>
                            </div>
                          ) : (
                            <p className="text-xs text-green-600 mb-2">Aucun problème signalé</p>
                          )}
                          
                          {request.metadata.inspectionData.notes && (
                            <div className="mb-2">
                              <span className="text-xs text-gray-600 font-medium">💬 Notes:</span>
                              <p className="text-xs text-gray-700 mt-1">{request.metadata.inspectionData.notes}</p>
                            </div>
                          )}
                          
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="text-xs text-blue-600">
                              Paiement: {request.metadata.paymentMethod === 'SUBSCRIPTION' ? 'Forfait actif' : 'Paiement direct'}
                            </span>
                          </div>
                        </div>
                      )}
                      
                      {'reservation' in request && request.reservation && (
                        <Badge variant="outline" className="mt-2">
                          Réservation: {new Date(request.reservation.startDate).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                  </div>
                  {getStatusBadge(request.status)}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openInspectionModal(request, activeTab)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    Voir Détails {images.length > 0 && `(${images.length} photos)`}
                  </Button>
                  {request.status === 'PENDING' && (
                    <>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setValidationAction('reject');
                        }}
                      >
                        <X className="w-4 h-4 mr-2" />
                        Rejeter
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() => {
                          setSelectedRequest(request);
                          setValidationAction('approve');
                        }}
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Approuver
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Validation Dialog */}
      {selectedRequest && validationAction && (
        <Dialog open={!!validationAction} onOpenChange={() => {
          setValidationAction(null);
          setAdminNote('');
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {validationAction === 'approve' ? 'Approuver' : 'Rejeter'} la demande
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <p><strong>Utilisateur:</strong> {selectedRequest.user?.firstName} {selectedRequest.user?.lastName}</p>
                <p><strong>Vélo:</strong> {selectedRequest.bike?.code}</p>
                <p><strong>Date:</strong> {new Date(selectedRequest.requestedAt).toLocaleString('fr-FR')}</p>
              </div>
              
              <div>
                <label className="text-sm text-gray-600 mb-2 block">
                  Note administrative {validationAction === 'reject' && '*'}
                </label>
                <Textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder={
                    validationAction === 'approve' 
                      ? 'Note optionnelle...'
                      : 'Raison du rejet (obligatoire)'
                  }
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setValidationAction(null);
                setAdminNote('');
              }}>
                {t('common.cancel') || 'Annuler'}
              </Button>
              <Button
                variant={validationAction === 'approve' ? 'default' : 'destructive'}
                onClick={handleValidateRequest}
                disabled={validationAction === 'reject' && !adminNote.trim()}
              >
                {validationAction === 'approve' ? (t('bikeActions.approve') || 'Approuver') : (t('bikeActions.reject') || 'Rejeter')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal amélioré pour les détails d'inspection */}
      {inspectionModal.open && inspectionModal.request && (
        <Dialog open={inspectionModal.open} onOpenChange={(open) => 
          setInspectionModal(prev => ({ ...prev, open }))
        }>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>
                  Détails de la demande - {inspectionModal.type === 'unlock' ? 'Déverrouillage' : 'Verrouillage'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setInspectionModal({ open: false, request: null, type: null })}
                >
                  <X className="w-4 h-4" />
                </Button>
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6 overflow-y-auto pr-2" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {/* Informations de base */}
              <Card className="p-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">Utilisateur</p>
                    <p className="text-sm font-medium">
                      {inspectionModal.request.user?.firstName} {inspectionModal.request.user?.lastName}
                    </p>
                    <p className="text-xs text-gray-600">{inspectionModal.request.user?.email}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">Vélo</p>
                    <p className="text-sm font-medium">{inspectionModal.request.bike?.code}</p>
                    <p className="text-xs text-gray-600">{inspectionModal.request.bike?.model}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">Date de la demande</p>
                    <p className="text-sm">
                      {new Date(inspectionModal.request.requestedAt).toLocaleString('fr-FR')}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-500">Statut</p>
                    <Badge variant={
                      inspectionModal.request.status === 'PENDING' ? 'outline' :
                      inspectionModal.request.status === 'APPROVED' ? 'default' : 'destructive'
                    }>
                      {inspectionModal.request.status === 'PENDING' ? 'En attente' :
                       inspectionModal.request.status === 'APPROVED' ? 'Approuvée' : 'Rejetée'}
                    </Badge>
                  </div>
                </div>
              </Card>

              {/* Galerie d'images */}
              <Card className="p-4">
                {(() => {
                  const images = getRequestImages(inspectionModal.request);
                  console.log('Images pour la galerie:', images);
                  return (
                    <ImageGallery 
                      images={images}
                      title={`${inspectionModal.type}-${inspectionModal.request.bike?.code || 'unknown'}`}
                    />
                  );
                })()}
              </Card>

              {/* Rapport d'inspection */}
              <Card className="p-4">
                <h4 className="font-medium mb-4 text-lg">Rapport d'inspection</h4>
                
                {/* Condition générale */}
                <div className="mb-4">
                  <p className="text-sm font-medium text-gray-500 mb-2">État général</p>
                  {inspectionModal.request.metadata?.inspection?.condition ? (
                    <Badge variant={
                      inspectionModal.request.metadata.inspection.condition === 'good' ? 'default' :
                      inspectionModal.request.metadata.inspection.condition === 'acceptable' ? 'outline' : 'destructive'
                    }>
                      {inspectionModal.request.metadata.inspection.condition === 'good' ? 'Bon état' :
                       inspectionModal.request.metadata.inspection.condition === 'acceptable' ? 'Acceptable' : 'Endommagé'}
                    </Badge>
                  ) : (
                    <p className="text-sm text-gray-600">Non spécifié</p>
                  )}
                </div>

                {/* Évaluation par élément (scores sliders) */}
                {(() => {
                  const scores = inspectionModal.request.metadata?.inspection?.itemScores as
                    | { id: string; label: string; value: number; state: 'good' | 'degraded' | 'bad' }[]
                    | undefined;
                  if (!scores || scores.length === 0) return null;
                  return (
                    <div className="mb-4">
                      <p className="text-sm font-medium text-gray-500 mb-2">Évaluation par élément</p>
                      <div className="grid grid-cols-1 gap-2">
                        {scores.map((item) => {
                          const pct = item.value ?? 0;
                          const color = pct <= 30 ? '#ef4444' : pct <= 69 ? '#f59e0b' : '#16a34a';
                          const stateLabel = pct <= 30 ? 'Mauvais' : pct <= 69 ? 'Dégradé' : 'Bon';
                          return (
                            <div key={item.id} className="flex items-center gap-3">
                              <span className="text-xs text-gray-600 w-32 shrink-0">{item.label}</span>
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                  className="h-2 rounded-full transition-all"
                                  style={{ width: `${pct}%`, backgroundColor: color }}
                                />
                              </div>
                              <span className="text-xs font-semibold w-8 text-right" style={{ color }}>
                                {pct}%
                              </span>
                              <span className="text-xs w-14" style={{ color }}>{stateLabel}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Problèmes identifiés */}
                {inspectionModal.request.metadata?.inspectionData?.issues &&
                 inspectionModal.request.metadata.inspectionData.issues.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Problèmes signalés</p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <ul className="list-disc pl-5 text-sm">
                        {inspectionModal.request.metadata.inspectionData.issues.map((issue: string, idx: number) => (
                          <li key={idx} className="mb-1 text-red-700">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {(inspectionModal.request.metadata?.inspectionData?.notes || inspectionModal.request.metadata?.inspection?.notes) && (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-gray-500 mb-2">Notes de l'utilisateur</p>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <p className="text-sm text-gray-700">
                        {inspectionModal.request.metadata?.inspection?.notes || inspectionModal.request.metadata?.inspectionData?.notes}
                      </p>
                    </div>
                  </div>
                )}

                {/* Méthode de paiement */}
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Méthode de paiement</p>
                  <Badge variant="secondary">
                    {inspectionModal.request.metadata?.paymentMethod === 'SUBSCRIPTION' ? 'Forfait actif' : 'Paiement direct'}
                  </Badge>
                </div>
              </Card>

              {/* Informations supplémentaires selon le type */}
              {inspectionModal.type === 'unlock' && 'reservation' in inspectionModal.request && inspectionModal.request.reservation && (
                <Card className="p-4">
                  <h4 className="font-medium mb-4">📅 Réservation associée</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Début:</span>
                      <span className="text-sm font-medium">
                        {new Date(inspectionModal.request.reservation.startDate).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Fin:</span>
                      <span className="text-sm font-medium">
                        {new Date(inspectionModal.request.reservation.endDate).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    {inspectionModal.request.reservation.packageType && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Type de forfait:</span>
                        <Badge variant="outline">
                          {inspectionModal.request.reservation.packageType}
                        </Badge>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {inspectionModal.type === 'lock' && 'ride' in inspectionModal.request && inspectionModal.request.ride && (
                <Card className="p-4">
                  <h4 className="font-medium mb-4">🚴 Trajet associé</h4>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Début:</span>
                      <span className="text-sm font-medium">
                        {new Date(inspectionModal.request.ride.startTime).toLocaleString('fr-FR')}
                      </span>
                    </div>
                    {inspectionModal.request.ride.endTime && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Fin:</span>
                        <span className="text-sm font-medium">
                          {new Date(inspectionModal.request.ride.endTime).toLocaleString('fr-FR')}
                        </span>
                      </div>
                    )}
                    {inspectionModal.request.ride.duration && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Durée:</span>
                        <span className="text-sm font-medium">
                          {Math.round((inspectionModal.request.ride.duration) / 60)} minutes
                        </span>
                      </div>
                    )}
                    {inspectionModal.request.ride.cost && (
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Coût:</span>
                        <span className="text-sm font-medium">
                          {inspectionModal.request.ride.cost} XOF
                        </span>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Actions pour les demandes en attente */}
              {inspectionModal.request.status === 'PENDING' && (
                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setInspectionModal({ open: false, request: null, type: null });
                    }}
                    className="flex-1"
                  >
                    Fermer
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setValidationAction('reject');
                      setSelectedRequest(inspectionModal.request);
                      setInspectionModal({ open: false, request: null, type: null });
                    }}
                    className="flex-1"
                  >
                    Rejeter
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => {
                      setValidationAction('approve');
                      setSelectedRequest(inspectionModal.request);
                      setInspectionModal({ open: false, request: null, type: null });
                    }}
                    className="flex-1"
                  >
                    Approuver
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}