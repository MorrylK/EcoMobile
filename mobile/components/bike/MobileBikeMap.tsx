/* eslint-disable react-hooks/exhaustive-deps */
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/Sheet';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bikeService } from '@/services/bikeService';
import type { Bike, Area } from '@/services/bikeService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { OSMMap } from '@/components/maps/OSMMap';
import { Battery, Building2, Filter, Home, MapPin, Navigation, Search, X, Zap, RotateCcw, MapPinIcon, CheckCircle, ZoomIn, ZoomOut, RotateCw } from 'lucide-react-native';
import React, { useEffect, useState, useRef } from 'react';
import { RefreshControl, ScrollView, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { debounce } from '@/utils/debounce';
import { cacheService } from '@/services/cacheService';

interface MobileBikeMapProps {
  onNavigate: (screen: string, data?: unknown) => void;
}

const DISTANCE_PRESETS = [
  { label: '500m', value: 0.5 },
  { label: '1km', value: 1 },
  { label: '2km', value: 2 },
  { label: '5km', value: 5 },
  { label: '10km', value: 10 },
  { label: '20km+', value: 20 }
];

const BATTERY_LEVELS = [
  { label: 'Toutes', value: 0 },
  { label: '20%+', value: 20 },
  { label: '50%+', value: 50 },
  { label: '80%+', value: 80 }
];

export function MobileBikeMap({ onNavigate }: MobileBikeMapProps) {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const mapRef = useRef<any>(null);
  
  const [selectedBike] = useState<Bike | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [bikes, setBikes] = useState<Bike[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showAreaDropdown, setShowAreaDropdown] = useState(false);
  const [areaSearchQuery, setAreaSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [showBikeDetails, setShowBikeDetails] = useState(false);
  
  // États des filtres améliorés
  const [searchMode, setSearchMode] = useState<'proximity' | 'area'>('proximity');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [maxDistance, setMaxDistance] = useState<number>(2);
  const [minBattery, setMinBattery] = useState<number>(0);
  const [searchLocation, setSearchLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [filtersApplied, setFiltersApplied] = useState(false); // Indique si les filtres ont été appliqués par l'utilisateur

  useEffect(() => {
    getUserLocation();
    loadAreas();
  }, []);

  // OPTIMISATION: Utiliser le cache et debouncing pour éviter les requêtes inutiles
  const loadActiveBikesDebounced = useRef(
    debounce((applyRadiusFilter: boolean) => {
      loadActiveBikes(applyRadiusFilter);
    }, 500) // Attendre 500ms après le dernier changement
  ).current;

  useEffect(() => {
    // Charger les vélos une fois que la localisation est disponible
    // Au chargement initial, charger tous les vélos sans filtre de rayon
    if (userLocation || searchLocation) {
      // Vérifier le cache d'abord
      const cacheKey = `bikes_${userLocation?.lat}_${userLocation?.lng}_${maxDistance}_${minBattery}`;
      cacheService.get<Bike[]>(cacheKey).then((cached) => {
        if (cached) {
          setBikes(cached);
          setIsLoading(false);
        } else {
          loadActiveBikes(false);
        }
      }).catch(() => {
        loadActiveBikes(false);
      });
    }
  }, [userLocation, searchLocation]);

  // Recharger les vélos quand les filtres changent (avec debouncing)
  useEffect(() => {
    if (filtersApplied && (userLocation || searchLocation)) {
      // Utiliser debouncing pour éviter les requêtes multiples lors de changements rapides
      loadActiveBikesDebounced(true);
    }
  }, [maxDistance, minBattery, searchMode, selectedArea, filtersApplied]);

  useEffect(() => {
    if (mapLoaded && bikes.length > 0) {
      updateMapView();
    }
  }, [bikes, searchLocation, userLocation, mapLoaded]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        
        setUserLocation({
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        });
      } else {
        setUserLocation({ lat: 4.0511, lng: 9.7679 });
      }
    } catch (error) {
      console.error('Erreur de géolocalisation:', error);
      setUserLocation({ lat: 4.0511, lng: 9.7679 });
    }
  };

  const getBikesWithValidCoords = (bikes: Bike[]) => {
    return bikes.filter(bike => 
      bike.latitude !== null && 
      bike.longitude !== null &&
      !isNaN(bike.latitude) && 
      !isNaN(bike.longitude)
    );
  };

  const loadAreas = async () => {
    try {
      const defaultAreas = await bikeService.getDefaultAreas();
      setAreas(defaultAreas);
    } catch (error) {
      console.error('Error loading areas:', error);
    }
  };

  const loadActiveBikes = async (applyRadiusFilter: boolean = false) => {
    try {
      setIsLoading(true);
      const referenceLocation = searchMode === 'area' && searchLocation 
        ? searchLocation 
        : userLocation || { lat: 4.0511, lng: 9.7679 }; // Fallback si userLocation est null

      const filters: any = {
        minBatteryLevel: minBattery,
      };

      // Ne pas appliquer le filtre de rayon au chargement initial
      // Seulement si l'utilisateur a activé les filtres ou si applyRadiusFilter est true
      if (applyRadiusFilter || filtersApplied) {
        if (referenceLocation) {
          filters.latitude = referenceLocation.lat;
          filters.longitude = referenceLocation.lng;
          filters.radius = maxDistance;
        }
      }

      // Vérifier le cache
      const cacheKey = `bikes_${referenceLocation.lat}_${referenceLocation.lng}_${maxDistance}_${minBattery}`;
      const cached = await cacheService.get<Bike[]>(cacheKey);
      
      if (cached) {
        setBikes(cached);
        setIsLoading(false);
        // Recharger en arrière-plan pour mettre à jour
        loadBikesFromAPI(filters, cacheKey);
      } else {
        await loadBikesFromAPI(filters, cacheKey);
      }
    } catch (error) {
      console.error('Error loading bikes:', error);
      toast.error(t('common.error'));
      setIsLoading(false);
    }
  };

  const loadBikesFromAPI = async (filters: any, cacheKey: string) => {
    try {
      const result = await bikeService.getAvailableBikes(filters, 1, 50);
      const bikes = (result.bikes || []).filter((b: Bike) => b.status === 'AVAILABLE');

      setBikes(bikes);

      // Mettre en cache pour 30 secondes
      await cacheService.set(cacheKey, bikes, 30 * 1000);
    } catch (error) {
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const handleBikePressOnMap = (_bike: any) => {
    haptics.medium();
    //setSelectedBike(bike as Bike);
    //setShowBikeDetails(true);
  };

  const updateMapView = () => {
    setMapLoaded(true);
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Fonction pour recentrer sur l'utilisateur
  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.centerOnUser();
      haptics.light();
    }
  };

  // Fonctions de zoom
  const zoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
      haptics.light();
    }
  };

  const zoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
      haptics.light();
    }
  };

  // Fonction pour basculer entre les styles de carte
  const toggleMapStyle = () => {
    if (mapRef.current) {
      mapRef.current.toggleMapStyle();
      haptics.light();
    }
  };

  const referenceLocation = searchMode === 'area' && searchLocation 
    ? searchLocation 
    : userLocation;

  let filteredBikes = bikes;

  // Ajouter la distance pour chaque vélo
  if (referenceLocation) {
    filteredBikes = bikes.map(bike => ({
      ...bike,
      distance: bike.latitude && bike.longitude
        ? calculateDistance(referenceLocation.lat, referenceLocation.lng, bike.latitude, bike.longitude)
        : 999
    })).sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  // Filtre par recherche textuelle
  if (searchQuery) {
    filteredBikes = filteredBikes.filter(
      (bike) =>
        bike.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        bike.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (bike.locationName && bike.locationName.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }

  const filteredAreas = areas.filter(area =>
    area.name.toLowerCase().includes(areaSearchQuery.toLowerCase())
  );

  const applyAreaFilter = (area: Area) => {
    setSearchLocation({ lat: area.location.lat, lng: area.location.lng });
    setSelectedArea(area.key);
    setSearchMode('area');
    setShowAreaDropdown(false);
    setAreaSearchQuery('');
    setFiltersApplied(true); // Marquer que les filtres ont été appliqués
    haptics.selection();
    loadActiveBikes(true); // Appliquer le filtre de rayon
  };

  const resetToProximity = () => {
    setSearchMode('proximity');
    setSearchLocation(null);
    setSelectedArea('');
    setShowAreaDropdown(false);
    setAreaSearchQuery('');
    setFiltersApplied(false); // Réinitialiser l'état des filtres
    haptics.light();
    loadActiveBikes(false); // Ne pas appliquer le filtre de rayon
  };

  const hasActiveFilters = maxDistance !== 2 || minBattery !== 0 || searchMode === 'area' || filtersApplied;

  const resetAllFilters = () => {
    resetToProximity();
    setMaxDistance(2);
    setMinBattery(0);
    setFiltersApplied(false); // Réinitialiser l'état des filtres
    haptics.light();
    loadActiveBikes(false); // Charger tous les vélos sans filtre
  };

  return (
    <View style={styles.container}>
      <MobileHeader 
        title={t('nav.map')} 
        showNotifications
        notificationCount={2}
        onNotifications={() => {
          haptics.light();
          onNavigate('notifications');
        }}
      />

      {/* Filter Sheet */}
      <Sheet open={showFilters} onOpenChange={setShowFilters}>
        <SheetContent side="bottom" style={{ height: '85%', zIndex: 1000 }} onClose={() => setShowFilters(false)}>
          <SheetHeader>
            <SheetTitle>
              {t('map.filters.title')}
            </SheetTitle>
            <SheetDescription>
              {t('map.filters.description')}
            </SheetDescription>
          </SheetHeader>

          <ScrollView style={{ flex: 1, marginTop: 10 }} showsVerticalScrollIndicator={false}>
            <View style={{ gap: 24, paddingBottom: 100, marginRight: 10, marginLeft: 10 }}>
              {/* Mode de recherche */}
              <View style={{ gap: 12 }}>
                <Label>
                  {t('map.filters.searchMode')}
                </Label>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <Button
                    variant={searchMode === 'proximity' ? 'primary' : 'secondary'}
                    onPress={resetToProximity}
                    style={{ flex: 1 }}
                  >
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <Navigation size={16} color={colors.text} />
                      <Text style={styles.ml8}>
                        {t('map.filters.nearby')}
                      </Text>
                    </View>
                  </Button>
                  <Button
                    variant={searchMode === 'area' ? 'primary' : 'secondary'}
                    onPress={() => {
                      setSearchMode('area');
                      setFiltersApplied(true); // Marquer que les filtres ont été appliqués
                      haptics.light();
                    }}
                    style={{ flex: 1 }}
                  >
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <Building2 size={16} color={colors.text} />
                      <Text style={styles.ml8}>
                        {t('map.filters.byArea')}
                      </Text>
                    </View>
                  </Button>
                </View>
              </View>

              {/* Sélection de quartier */}
              {searchMode === 'area' && (
                <View style={{ gap: 12 }}>
                  <Label>
                    {t('map.filters.selectArea')}
                  </Label>
                  <View style={styles.relative}>
                    <TouchableOpacity
                      onPress={() => setShowAreaDropdown(true)}
                      style={[
                        styles.input,
                        { 
                          flexDirection: 'row', 
                          alignItems: 'center', 
                          justifyContent: 'space-between',
                          paddingRight: 12,
                        }
                      ]}
                    >
                      <Text>
                        {selectedArea 
                          ? areas.find(a => a.key === selectedArea)?.name 
                          : t('map.filters.chooseArea')}
                      </Text>
                      <Home size={16} color="#9ca3af" />
                    </TouchableOpacity>

                    {showAreaDropdown && (
                      <View 
                        style={[
                          styles.absolute,
                          styles.card,
                          styles.shadowLg,
                          { 
                            top: '100%',
                            left: 0,
                            right: 0,
                            zIndex: 1000,
                            marginTop: 4,
                            maxHeight: 200,
                          }
                        ]}
                      >
                        <View style={[styles.relative, { padding: 8 }]}>
                          <View style={[styles.absolute, { left: 20, top: 20, zIndex: 10 }]}>
                            <Search size={16} color="#9ca3af" />
                          </View>
                          <Input
                            value={areaSearchQuery}
                            onChangeText={setAreaSearchQuery}
                            placeholder={t('map.filters.searchArea')}
                            style={{ paddingLeft: 40 }}
                          />
                        </View>

                        <ScrollView style={{ maxHeight: 150 }} showsVerticalScrollIndicator={false}>
                          {filteredAreas.length === 0 ? (
                            <View style={[styles.py12, styles.px16, styles.alignCenter]}>
                              <Text color="#6b7280">
                                {t('map.filters.noAreaFound')}
                              </Text>
                            </View>
                          ) : (
                            filteredAreas.map((area) => (
                              <TouchableOpacity
                                key={area.key}
                                onPress={() => applyAreaFilter(area)}
                                style={[
                                  styles.py12,
                                  styles.px16,
                                  { 
                                    borderBottomWidth: 1, 
                                    borderBottomColor: colors.border,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 8,
                                    backgroundColor: selectedArea === area.key ? colors.primary + '20' : 'transparent',
                                  }
                                ]}
                              >
                                <Home size={16} color={selectedArea === area.key ? colors.primary : colors.text} />
                                <Text color={selectedArea === area.key ? colors.primary : colors.text}>
                                  {area.name}
                                </Text>
                                {selectedArea === area.key && (
                                  <CheckCircle size={16} color={colors.primary} style={{ marginLeft: 'auto' }} />
                                )}
                              </TouchableOpacity>
                            ))
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Distance avec boutons prédéfinis */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label>
                    {t('map.filters.maxDistance')}
                  </Label>
                  <Badge variant="secondary">
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <MapPinIcon size={12} color={colors.text} />
                      <Text style={styles.ml4}>{DISTANCE_PRESETS.find(d => d.value === maxDistance)?.label || `${maxDistance}km`}</Text>
                    </View>
                  </Badge>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DISTANCE_PRESETS.map((preset) => (
                    <TouchableOpacity
                      key={preset.value}
                      onPress={() => {
                        setMaxDistance(preset.value);
                        setFiltersApplied(true); // Marquer que les filtres ont été appliqués
                        haptics.light();
                      }}
                      style={[
                        {
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          minWidth: 60,
                          alignItems: 'center',
                        },
                        maxDistance === preset.value 
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: 'transparent', borderColor: colors.border }
                      ]}
                    >
                      <Text 
                        size="sm" 
                        color={maxDistance === preset.value ? 'white' : colors.text}
                      >
                        {preset.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Niveau de batterie avec boutons prédéfinis */}
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Label>
                    {t('map.filters.minBattery')}
                  </Label>
                  <Badge variant="secondary">
                    <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                      <Battery size={14} color={colors.text} />
                      <Text style={styles.ml4}>{BATTERY_LEVELS.find(b => b.value === minBattery)?.label || `${minBattery}%`}</Text>
                    </View>
                  </Badge>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {BATTERY_LEVELS.map((level) => (
                    <TouchableOpacity
                      key={level.value}
                      onPress={() => {
                        setMinBattery(level.value);
                        setFiltersApplied(true); // Marquer que les filtres ont été appliqués
                        haptics.light();
                      }}
                      style={[
                        {
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          minWidth: 60,
                          alignItems: 'center',
                        },
                        minBattery === level.value 
                          ? { backgroundColor: colors.primary, borderColor: colors.primary }
                          : { backgroundColor: 'transparent', borderColor: colors.border }
                      ]}
                    >
                      <Text 
                        size="sm" 
                        color={minBattery === level.value ? 'white' : colors.text}
                      >
                        {level.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Actions */}
              <View style={{ flexDirection: 'row', gap: 12, paddingTop: 16 }}>
                <Button 
                  variant="secondary" 
                  onPress={resetAllFilters}
                  style={{ flex: 1 }}
                >
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <RotateCcw size={16} color={colors.text} />
                    <Text style={styles.ml8}>{t('common.reset')}</Text>
                  </View>
                </Button>
                <Button 
                  variant="primary"
                  onPress={() => {
                    setFiltersApplied(true); // Marquer que les filtres ont été appliqués
                    setShowFilters(false);
                    loadActiveBikes(true); // Appliquer le filtre de rayon
                    haptics.success();
                  }}
                  style={{ flex: 1 }}
                >
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <Filter size={16} color={colors.text} />
                    <Text style={styles.ml8}>{t('common.apply')}</Text>
                  </View>
                </Button>
              </View>
            </View>
          </ScrollView>
        </SheetContent>
      </Sheet>

      {/* Sheet pour les détails du vélo */}
      <Sheet open={showBikeDetails} onOpenChange={setShowBikeDetails}>
        <SheetContent side="bottom" style={{ height: '60%' }} onClose={() => setShowBikeDetails(false)}>
          {selectedBike && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Vélo {selectedBike.code}
                </SheetTitle>
                <SheetDescription>
                  {selectedBike.model} • {selectedBike.distance?.toFixed(1)} km de vous
                </SheetDescription>
              </SheetHeader>

              <View style={{ flex: 1, paddingTop: 24, gap: 20 }}>
                <View style={[styles.row, { gap: 16 }]}>
                  <View style={[styles.flex1, styles.card, { padding: 16, alignItems: 'center' }]}>
                    <Battery size={24} color={selectedBike.batteryLevel > 50 ? '#16a34a' : selectedBike.batteryLevel > 20 ? '#f59e0b' : '#ef4444'} />
                    <Text variant="body" style={{ marginTop: 8 }}>
                      {selectedBike.batteryLevel}%
                    </Text>
                    <Text size="sm" color="#6b7280">
                      Batterie
                    </Text>
                  </View>

                  <View style={[styles.flex1, styles.card, { padding: 16, alignItems: 'center' }]}>
                    <MapPin size={24} color="#6b7280" />
                    <Text variant="body" style={{ marginTop: 8 }}>
                      {selectedBike.distance?.toFixed(1)} km
                    </Text>
                    <Text size="sm" color="#6b7280">
                      Distance
                    </Text>
                  </View>

                  <View style={[styles.flex1, styles.card, { padding: 16, alignItems: 'center' }]}>
                    <Zap size={24} color="#5D5CDE" />
                    <Text variant="body" style={{ marginTop: 8 }}>
                      {selectedBike.currentPricing?.displayPrice ?? '--'} XOF
                    </Text>
                    <Text size="sm" color="#6b7280">
                      /{selectedBike.currentPricing?.durationHours ?? 1}h
                    </Text>
                  </View>
                </View>

                {selectedBike.locationName && (
                  <View style={[styles.card, { padding: 16 }]}>
                    <Text size="sm" color="#6b7280" style={{ marginBottom: 4 }}>
                      Localisation
                    </Text>
                    <Text variant="body">
                      {selectedBike.locationName}
                    </Text>
                  </View>
                )}

                <View style={{ marginTop: 'auto', gap: 12, paddingBottom: 20 }}>
                  <Button
                    variant="primary"
                    onPress={() => {
                      setShowBikeDetails(false);
                      haptics.success();
                      onNavigate('bike-details', selectedBike);
                    }}
                    style={{ height: 54 }}
                  >
                    <Text color="white">Déverrouiller ce vélo</Text>
                  </Button>
                  <Button
                    variant="secondary"
                    onPress={() => setShowBikeDetails(false)}
                    style={{ height: 54 }}
                  >
                    <Text>Annuler</Text>
                  </Button>
                </View>
              </View>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Carte Interactive Complètement Améliorée */}
      <View style={styles.relative}>
        {/* Carte Interactive avec vraies fonctionnalités */}
        <View 
          style={[
            styles.wT100,
            { height: 350, backgroundColor: colorScheme === 'light' ? '#f8fafc' : '#1e293b' }
          ]}
        >
          <OSMMap
            ref={mapRef}
            userLocation={referenceLocation}
            bikes={getBikesWithValidCoords(filteredBikes)}
            radius={maxDistance}
            onBikePress={handleBikePressOnMap}
            onMapReady={() => setMapLoaded(true)}
            colorScheme={colorScheme}
          />

          {/* Info overlay mise à jour */}
          <View style={[
            styles.absolute,
            { bottom: 16, left: 16, right: 16 },
            styles.alignCenter
          ]}>
            <View 
              style={[
                styles.row,
                { 
                  backgroundColor: 'rgba(255,255,255,0.95)',
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  alignItems: 'center',
                  gap: 8,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                }
              ]}
            >
              <View 
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#16a34a',
                }}
              />
              <Text size="sm" color="#111827">
                {filteredBikes.length} vélo{filteredBikes.length > 1 ? 's' : ''} trouvé{filteredBikes.length > 1 ? 's' : ''}
              </Text>
              {searchMode === 'area' && selectedArea && (
                <>
                  <Text size="sm" color="#6b7280">•</Text>
                  <Text size="sm" color="#6b7280">
                    {areas.find(a => a.key === selectedArea)?.name}
                  </Text>
                </>
              )}
              <Text size="sm" color="#6b7280">•</Text>
              <Text size="sm" color="#6b7280">
                Rayon {maxDistance}km
              </Text>
            </View>
          </View>
        </View>

        {/* Contrôles de carte améliorés */}
        <View style={[styles.absolute, { top: 16, right: 16 }, { gap: 8 }]}>
          {/* Bouton de géolocalisation */}
          <TouchableOpacity
            onPress={centerOnUser}
            style={[
              { width: 48, height: 48 },
              styles.rounded24,
              styles.alignCenter,
              styles.justifyCenter,
              styles.shadow,
              {
                backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
              }
            ]}
          >
            <Navigation size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
          </TouchableOpacity>

          {/* Contrôles de zoom */}
          <TouchableOpacity
            onPress={zoomIn}
            style={[
              { width: 48, height: 48 },
              styles.rounded24,
              styles.alignCenter,
              styles.justifyCenter,
              styles.shadow,
              {
                backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
              }
            ]}
          >
            <ZoomIn size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={zoomOut}
            style={[
              { width: 48, height: 48 },
              styles.rounded24,
              styles.alignCenter,
              styles.justifyCenter,
              styles.shadow,
              {
                backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
              }
            ]}
          >
            <ZoomOut size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
          </TouchableOpacity>

          {/* Bouton pour changer le style de carte */}
          <TouchableOpacity
            onPress={toggleMapStyle}
            style={[
              { width: 48, height: 48 },
              styles.rounded24,
              styles.alignCenter,
              styles.justifyCenter,
              styles.shadow,
              {
                backgroundColor: colorScheme === 'light' ? 'white' : '#374151',
              }
            ]}
          >
            <RotateCw size={20} color={colorScheme === 'light' ? '#111827' : '#f9fafb'} />
          </TouchableOpacity>

          {/* Bouton de filtres */}
          <TouchableOpacity
            onPress={() => {
              haptics.light();
              setShowFilters(!showFilters);
            }}
            style={[
              { width: 48, height: 48 },
              styles.rounded24,
              styles.alignCenter,
              styles.justifyCenter,
              styles.shadow,
              {
                backgroundColor: hasActiveFilters
                  ? '#16a34a'
                  : (colorScheme === 'light' ? 'white' : '#374151'),
              }
            ]}
          >
            <Filter 
              size={20} 
              color={hasActiveFilters
                ? 'white'
                : (colorScheme === 'light' ? '#111827' : '#f9fafb')
              } 
            />
            {hasActiveFilters && (
              <View 
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#ef4444',
                }}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={[styles.absolute, { top: 16, left: 16, right: 80 }]}>
          <View style={styles.relative}>
            <View style={[styles.absolute, { left: 12, top: 14, zIndex: 10 }]}>
              <Search size={20} color="#9ca3af" />
            </View>
            <Input
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('map.searchPlaceholder')}
              style={[{ paddingLeft: 44 }, styles.shadow]}
            />
          </View>
        </View>
      </View>

      {/* Liste des vélos améliorée */}
      <ScrollView 
        style={styles.flex1}
        contentContainerStyle={[styles.scrollContentPadded, { gap: 16 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={loadActiveBikes}
            colors={['#16a34a']}
            tintColor="#16a34a"
          />
        }
      >
        <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
          <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
            {searchMode === 'area' && selectedArea
              ? `Vélos à ${areas.find(a => a.key === selectedArea)?.name}`
              : 'Vélos disponibles à proximité'}
          </Text>
          <Badge variant="secondary">
            <View style={[styles.row, styles.gap4, styles.alignCenter]}>
              <Zap size={12} color={colors.text} style={{marginRight: 10}} />
              <Text>{filteredBikes.length}</Text>
            </View>
          </Badge>
        </View>

        {/* Résumé des filtres appliqués */}
        {hasActiveFilters && (
          <View style={[styles.card, { padding: 12 }]}>
            <View style={[styles.row, { gap: 8, flexWrap: 'wrap' }]}>
              <Text size="sm" color={colors.primary}>Filtres actifs:</Text>
              {searchMode === 'area' && (
                <Badge variant="secondary" style={{ backgroundColor: colors.primary + '20' }}>
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <Building2 size={10} color={colors.primary} />
                    <Text size="xs" color={colors.primary}>
                      {areas.find(a => a.key === selectedArea)?.name}
                    </Text>
                  </View>
                </Badge>
              )}
              {maxDistance !== 2 && (
                <Badge variant="secondary" style={{ backgroundColor: colors.primary + '20' }}>
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <MapPin size={10} color={colors.primary} />
                    <Text size="xs" color={colors.primary}>
                      {DISTANCE_PRESETS.find(d => d.value === maxDistance)?.label}
                    </Text>
                  </View>
                </Badge>
              )}
              {minBattery > 0 && (
                <Badge variant="secondary" style={{ backgroundColor: colors.primary + '20' }}>
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <Battery size={10} color={colors.primary} />
                    <Text size="xs" color={colors.primary}>
                      {minBattery}%+
                    </Text>
                  </View>
                </Badge>
              )}
              <TouchableOpacity onPress={resetAllFilters}>
                <Badge variant="secondary" style={{ backgroundColor: '#ef444420' }}>
                  <View style={[styles.row, styles.gap4, styles.alignCenter]}>
                    <X size={10} color="#ef4444" />
                    <Text size="xs" color="#ef4444" style={styles.ml4}>
                      Effacer
                    </Text>
                  </View>
                </Badge>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ gap: 12 }}>
          {filteredBikes.length === 0 ? (
            <View style={[styles.card, { padding: 32 }, styles.alignCenter]}>
              <View style={[styles.alignCenter, { gap: 16 }]}>
                <View 
                  style={[
                    { width: 64, height: 64 },
                    styles.rounded24,
                    styles.alignCenter,
                    styles.justifyCenter,
                    { backgroundColor: colorScheme === 'light' ? '#f3f4f6' : '#374151' }
                  ]}
                >
                  <Search size={32} color={colorScheme === 'light' ? '#9ca3af' : '#6b7280'} />
                </View>
                <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.mb8}>
                  {t('map.noBikesFound')}
                </Text>
                <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={[styles.mb16, { textAlign: 'center' }]}>
                  {t('map.adjustFilters')}
                </Text>
                <Button onPress={() => setShowFilters(true)} variant="secondary">
                  <View style={[styles.row, styles.gap8, styles.alignCenter]}>
                    <Filter size={16} color={colors.text} />
                    <Text style={styles.ml8}>{t('map.modifyFilters')}</Text>
                  </View>
                </Button>
              </View>
            </View>
          ) : (
            filteredBikes.map((bike) => (
              <TouchableOpacity
                key={bike.id}
                onPress={() => {
                  haptics.light();
                  onNavigate('bike-details', bike);
                }}
              >
                <View style={[styles.card, { padding: 16 }]}>
                  <View style={[styles.row, { gap: 12 }]}>
                    <View 
                      style={[
                        { width: 48, height: 48 },
                        styles.rounded12,
                        styles.alignCenter,
                        styles.justifyCenter,
                        { backgroundColor: colorScheme === 'light' ? '#f0fdf4' : '#14532d' }
                      ]}
                    >
                      <Zap size={24} color="#16a34a" />
                    </View>

                    <View style={styles.flex1}>
                      <View style={[styles.row, styles.spaceBetween, styles.alignCenter, styles.mb4]}>
                        <View>
                          <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                            {bike.code}
                          </Text>
                          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                            {bike.model}
                          </Text>
                        </View>
                        {/**
                        <Badge variant={bike.batteryLevel > 50 ? 'default' : 'secondary'}>
                          <View style={[styles.row, styles.gap8, styles.alignCenter]}>
                            <Battery size={12} color={bike.batteryLevel > 50 ? 'white' : '#111827'} />
                            <Text style={styles.ml4} color={bike.batteryLevel > 50 ? 'white' : '#111827'}>
                              {bike.batteryLevel}%
                            </Text>
                          </View>
                        </Badge>
                         */}
                      </View>

                      <View style={[styles.row, { gap: 16 }, styles.mb8]}>
                        <View style={[styles.row, styles.alignCenter, { gap: 4 }]}>
                          <MapPin size={16} color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} />
                          <Text size="sm" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}>
                            {bike.distance ? `${bike.distance.toFixed(1)} km` : '--'}
                          </Text>
                        </View>
                        {bike.locationName && (
                          <Text 
                            size="sm" 
                            color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'}
                            numberOfLines={1}
                            style={{ flex: 1 }}
                          >
                            {bike.locationName}
                          </Text>
                        )}
                      </View>

                      <View style={[styles.row, styles.spaceBetween, styles.alignCenter]}>
                        <Text size="sm" color={colorScheme === 'light' ? '#111827' : '#f9fafb'}>
                          {bike.currentPricing
                            ? `${bike.currentPricing.displayPrice} XOF/${bike.currentPricing.durationHours}h`
                            : t('map.priceUnavailable')}
                        </Text>
                        <Button
                          size="sm"
                          variant="primary"
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            haptics.success();
                            onNavigate('bike-details', bike);
                          }}
                        >
                          <Text color="white" style={styles.ml4}>{t('map.view')}</Text>
                        </Button>
                      </View>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}