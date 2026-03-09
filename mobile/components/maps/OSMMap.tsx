/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react/display-name */
import React, { useRef, useImperativeHandle, forwardRef, useEffect, useCallback } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

interface MapBikeMarker {
  id: string;
  latitude?: number | null | undefined;
  longitude?: number | null | undefined;
  batteryLevel: number;
  code: string;
  distance?: number;
  model: string;
}

interface OSMMapProps {
  userLocation?: { lat: number; lng: number } | null;
  bikes: MapBikeMarker[];
  radius: number;
  onBikePress?: (bike: MapBikeMarker) => void;
  onMapReady?: () => void;
  colorScheme: 'light' | 'dark';
}

export interface OSMMapRef {
  centerOnUser: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  toggleMapStyle: () => void;
}

export const OSMMap = forwardRef<OSMMapRef, OSMMapProps>(({
  userLocation,
  bikes,
  radius,
  onBikePress,
  onMapReady,
  colorScheme
}, ref) => {
  const webViewRef = useRef<any>(null);
  const mapContainerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const isWeb = Platform.OS === 'web';
  
  // Coordonnées par défaut (Douala, Cameroun)
  const center = userLocation || { lat: 4.0511, lng: 9.7679 };
  
  // Filtrer les vélos avec coordonnées valides
  const bikesWithCoords = bikes.filter((b): b is MapBikeMarker & { 
    latitude: number; 
    longitude: number; 
  } => 
    b.latitude != null &&
    b.longitude != null && 
    !isNaN(b.latitude) && 
    !isNaN(b.longitude)
  );

  // Fonctions pour le web (Leaflet direct)
  const centerOnUserWeb = useCallback(() => {
    if (mapInstanceRef.current && leafletRef.current && center) {
      mapInstanceRef.current.setView([center.lat, center.lng], mapInstanceRef.current.getZoom(), {
        animate: true
      });
    }
  }, [center]);

  const zoomInWeb = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomIn(0.5, { animate: true });
    }
  }, []);

  const zoomOutWeb = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.zoomOut(0.5, { animate: true });
    }
  }, []);

  const toggleMapStyleWeb = useCallback(() => {
    if (mapInstanceRef.current && leafletRef.current) {
      const currentTileLayer = mapInstanceRef.current._baseLayer;
      const mapStyles = [
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
      ];
      
      const currentUrl = currentTileLayer?._url || '';
      let currentIndex = 0;
      
      if (currentUrl.includes('openstreetmap')) currentIndex = 0;
      else if (currentUrl.includes('arcgisonline')) currentIndex = 1;
      else if (currentUrl.includes('cartocdn.com/dark')) currentIndex = 2;
      
      const nextIndex = (currentIndex + 1) % mapStyles.length;
      
      const newTileLayer = leafletRef.current.tileLayer(mapStyles[nextIndex], {
        attribution: nextIndex === 0 ? '© StreetMap' : 
                     nextIndex === 1 ? '© Esri' : '© CartoDB',
        maxZoom: 19,
        detectRetina: true
      });
      
      currentTileLayer.remove();
      mapInstanceRef.current._baseLayer = newTileLayer.addTo(mapInstanceRef.current);
    }
  }, []);

  // Fonctions pour mobile (WebView)
  const centerOnUserMobile = useCallback(() => {
    if (webViewRef.current && webViewRef.current.postMessage) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'centerOnUser'
      }));
    }
  }, []);

  const zoomInMobile = useCallback(() => {
    if (webViewRef.current && webViewRef.current.postMessage) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'zoomIn'
      }));
    }
  }, []);

  const zoomOutMobile = useCallback(() => {
    if (webViewRef.current && webViewRef.current.postMessage) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'zoomOut'
      }));
    }
  }, []);

  const toggleMapStyleMobile = useCallback(() => {
    if (webViewRef.current && webViewRef.current.postMessage) {
      webViewRef.current.postMessage(JSON.stringify({
        type: 'toggleMapStyle'
      }));
    }
  }, []);

  // Exposition des fonctions via ref
  useImperativeHandle(ref, () => ({
    centerOnUser: isWeb ? centerOnUserWeb : centerOnUserMobile,
    zoomIn: isWeb ? zoomInWeb : zoomInMobile,
    zoomOut: isWeb ? zoomOutWeb : zoomOutMobile,
    toggleMapStyle: isWeb ? toggleMapStyleWeb : toggleMapStyleMobile
  }), [
    isWeb, 
    centerOnUserWeb, zoomInWeb, zoomOutWeb, toggleMapStyleWeb,
    centerOnUserMobile, zoomInMobile, zoomOutMobile, toggleMapStyleMobile
  ]);

  // Effet pour initialiser la carte web
  useEffect(() => {
    if (!isWeb || !mapContainerRef.current) return;

    let mounted = true;
    
    const initializeWebMap = async () => {
      try {
        // Vérifier si Leaflet est déjà chargé
        if ((window as any).L) {
          leafletRef.current = (window as any).L;
        } else {
          // Charger Leaflet dynamiquement
          await new Promise((resolve, reject) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
            link.onload = () => {
              const script = document.createElement('script');
              script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
              script.onload = () => {
                leafletRef.current = (window as any).L;
                resolve(true);
              };
              script.onerror = reject;
              document.head.appendChild(script);
            };
            link.onerror = reject;
            document.head.appendChild(link);
          });
        }

        if (!mounted || !leafletRef.current) return;

        // Initialiser la carte
        const map = leafletRef.current.map(mapContainerRef.current, {
          zoomControl: false,
          touchZoom: true,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          boxZoom: false,
          keyboard: true,
          dragging: true,
          zoomSnap: 0.5,
          tap: true
        }).setView([center.lat, center.lng], 14);

        mapInstanceRef.current = map;

        // Ajouter la couche de base
        const baseLayer = leafletRef.current.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '© StreetMap',
            maxZoom: 19,
            detectRetina: true
          }
        ).addTo(map);
        
        map._baseLayer = baseLayer;

        // Marqueur utilisateur
        const userIcon = leafletRef.current.divIcon({
          className: 'user-marker',
          html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
          iconSize: [26, 26],
          iconAnchor: [13, 13]
        });

        leafletRef.current.marker([center.lat, center.lng], { icon: userIcon })
          .addTo(map);

        // Cercle de recherche
        leafletRef.current.circle([center.lat, center.lng], {
          radius: radius * 1000,
          fillColor: '#3b82f6',
          fillOpacity: 0.1,
          color: '#3b82f6',
          weight: 2,
          opacity: 0.6
        }).addTo(map);

        // Ajouter les marqueurs de vélos
        bikesWithCoords.forEach(bike => {
          const batteryColor = bike.batteryLevel > 50 ? '#16a34a' : 
                            bike.batteryLevel > 20 ? '#f59e0b' : '#ef4444';
          
          const bikeIcon = leafletRef.current.divIcon({
            className: 'bike-marker',
            html: `
              <div style="display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;">
                <div style="
                  background: ${batteryColor};
                  color: white;
                  width: 36px;
                  height: 36px;
                  border-radius: 50%;
                  border: 2px solid white;
                  box-shadow: 0 2px 6px rgba(0,0,0,0.35);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 10px;
                  font-weight: bold;
                ">
                  ${bike.batteryLevel}%
                </div>
                <div style="
                  background: rgba(0,0,0,0.72);
                  color: white;
                  font-size: 9px;
                  font-weight: 600;
                  padding: 1px 5px;
                  border-radius: 4px;
                  white-space: nowrap;
                  letter-spacing: 0.3px;
                ">
                  ${bike.code}
                </div>
              </div>
            `,
            iconSize: [46, 54],
            iconAnchor: [23, 36]
          });

          const marker = leafletRef.current.marker([bike.latitude!, bike.longitude!], {
            icon: bikeIcon
          }).addTo(map);

          // Créer le contenu du popup amélioré
          const popupContent = `
            <div class="bike-popup" style="
              min-width: 240px;
              padding: 12px;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ">
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 12px;
              ">
                <div style="
                  background: ${batteryColor};
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-size: 10px;
                  font-weight: bold;
                ">
                  ${bike.batteryLevel}%
                </div>
                <div>
                  <div style="font-weight: 600; font-size: 16px; color: #111827;">
                    Vélo ${bike.code}
                  </div>
                  <div style="font-size: 14px; color: #6b7280;">
                    ${bike.model}
                  </div>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
                <div style="text-align: center;">
                  <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 4px;">
                    ⚡ ${bike.batteryLevel}%
                  </div>
                  <div style="font-size: 12px; color: #6b7280;">
                    Batterie
                  </div>
                </div>
                <div style="text-align: center;">
                  <div style="font-weight: 600; font-size: 14px; color: #111827; margin-bottom: 4px;">
                    📍 ${bike.distance ? bike.distance.toFixed(1) + ' km' : '--'}
                  </div>
                  <div style="font-size: 12px; color: #6b7280;">
                    Distance
                  </div>
                </div>
              </div>
              
              <button onclick="window.handleBikeSelect && window.handleBikeSelect('${bike.id}')" 
                      style="
                        background: #5D5CDE;
                        color: white;
                        border: none;
                        padding: 10px 16px;
                        border-radius: 8px;
                        font-size: 14px;
                        font-weight: 500;
                        cursor: pointer;
                        width: 100%;
                        transition: background 0.2s;
                      "
                      onmouseover="this.style.background='#4c4bcc'"
                      onmouseout="this.style.background='#5D5CDE'">
                Déverrouiller
              </button>
            </div>
          `;

          // Lier le popup au marqueur
          marker.bindPopup(popupContent, {
            className: 'bike-popup-leaflet',
            maxWidth: 280,
            minWidth: 240,
            offset: [0, -15],
            closeButton: true,
            autoClose: false,
            closeOnClick: false
          });

          // Ouvrir le popup au clic
          marker.on('click', () => {
            marker.openPopup();
          });

          // Ouvrir le popup au survol (hover)
          marker.on('mouseover', () => {
            marker.openPopup();
          });

          // Fermer le popup quand on quitte le marqueur
          marker.on('mouseout', () => {
            // Petit délai pour éviter de fermer trop vite
            setTimeout(() => {
              if (!marker._popup._container?.matches(':hover')) {
                marker.closePopup();
              }
            }, 100);
          });

          // Garder le popup ouvert si la souris est dessus
          marker.on('popupopen', () => {
            const popup = marker.getPopup();
            if (popup && popup._container) {
              popup._container.addEventListener('mouseenter', () => {
                marker._popupHovered = true;
              });
              popup._container.addEventListener('mouseleave', () => {
                marker._popupHovered = false;
                setTimeout(() => {
                  if (!marker._popupHovered) {
                    marker.closePopup();
                  }
                }, 100);
              });
            }
          });
        });

        // Ajouter les styles CSS
        const style = document.createElement('style');
        style.innerHTML = `
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-content-wrapper {
            border-radius: 12px;
            padding: 0;
            overflow: hidden;
            box-shadow: 0 6px 16px rgba(0,0,0,0.15);
          }
          
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-content {
            margin: 0;
            line-height: 1.4;
          }
          
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-tip-container {
            margin-top: -1px;
          }
          
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-tip {
            background: white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.1);
          }
          
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-close-button {
            width: 24px;
            height: 24px;
            font-size: 18px;
            line-height: 24px;
            color: #6b7280;
            transition: color 0.2s;
            z-index: 1000;
          }
          
          .leaflet-popup.bike-popup-leaflet .leaflet-popup-close-button:hover {
            color: #111827;
          }
        `;
        document.head.appendChild(style);

        onMapReady?.();
      } catch (error) {
        console.error('Error loading Leaflet:', error);
      }
    };

    initializeWebMap();

    return () => {
      mounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isWeb, center.lat, center.lng, radius, bikesWithCoords, onBikePress, onMapReady]);

  // HTML pour la version mobile (WebView) - VERSION CORRIGÉE POUR NAVIGATION TACTILE
  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
            * {
                box-sizing: border-box;
            }
            
            body { 
                margin: 0; 
                padding: 0; 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                overflow: hidden;
                position: fixed;
                width: 100%;
                height: 100%;
                touch-action: auto;
            }
            
            #map { 
                height: 100vh; 
                width: 100vw; 
                touch-action: auto;
                position: relative;
                cursor: grab;
            }
            
            #map:active {
                cursor: grabbing;
            }
            
            .leaflet-container {
                touch-action: auto !important;
            }
            
            .leaflet-control-container {
                pointer-events: none;
            }
            
            .leaflet-control {
                pointer-events: auto;
            }
            
            .leaflet-popup-content-wrapper {
                touch-action: auto;
            }
            
            .bike-popup {
                font-family: inherit;
                text-align: center;
                min-width: 200px;
            }
            .bike-popup .title {
                font-size: 16px;
                font-weight: 600;
                margin-bottom: 8px;
                color: #111827;
            }
            .bike-popup .details {
                display: flex;
                gap: 12px;
                justify-content: center;
                margin-bottom: 12px;
            }
            .bike-popup .detail-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
            }
            .bike-popup .detail-value {
                font-weight: 600;
                font-size: 14px;
            }
            .bike-popup .detail-label {
                font-size: 12px;
                color: #6b7280;
            }
            .bike-popup .action-btn {
                background: #5D5CDE;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                width: 100%;
                margin-top: 8px;
                touch-action: manipulation;
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
            let map;
            let userMarker;
            let radiusCircle;
            let bikeMarkers = [];
            let currentMapStyle = 'osm';
            
            const mapStyles = {
                osm: {
                    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                    attribution: '© StreetMap'
                },
                satellite: {
                    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                    attribution: '© Esri'
                },
                dark: {
                    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                    attribution: '© CartoDB'
                }
            };
            
            function initMap() {
                try {
                    map = L.map('map', {
                        // Configuration optimisée pour navigation tactile
                        zoomControl: false,
                        attributionControl: true,
                        
                        // Navigation tactile
                        touchZoom: true,           // Pincer pour zoomer
                        scrollWheelZoom: true,     // Molette souris
                        doubleClickZoom: true,     // Double-tap pour zoomer
                        dragging: true,            // Glisser pour déplacer
                        
                        // Configuration tactile avancée
                        tap: true,                 // Support des taps
                        tapTolerance: 15,          // Tolérance des taps
                        touchExtend: true,         // Support multi-touch
                        
                        // Animation fluide
                        zoomAnimation: true,
                        fadeAnimation: true,
                        markerZoomAnimation: true,
                        
                        // Inertie pour navigation fluide
                        inertia: true,
                        inertiaDeceleration: 3000,
                        inertiaMaxSpeed: Infinity,
                        easeLinearity: 0.2,
                        
                        // Configuration zoom
                        zoomSnap: 0.25,
                        zoomDelta: 0.75,
                        wheelDebounceTime: 40,
                        wheelPxPerZoomLevel: 60,
                        
                        // Limites
                        maxZoom: 18,
                        minZoom: 10,
                        bounceAtZoomLimits: false,
                        
                        // Autres
                        keyboard: true,
                        boxZoom: false,
                        closePopupOnClick: false,
                        trackResize: true,
                        preferCanvas: false
                    }).setView([${center.lat}, ${center.lng}], 14);
                    
                    // Forcer la mise à jour après initialisation
                    setTimeout(() => {
                        map.invalidateSize(true);
                    }, 100);
                    
                    updateMapStyle();
                    updateUserLocation();
                    updateBikes();
                    
                    // Confirmation de chargement
                    setTimeout(() => {
                        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'mapReady'
                            }));
                        }
                    }, 500);
                } catch (error) {
                    console.error('Error initializing map:', error);
                }
            }
            
            function updateMapStyle() {
                if (!map) return;
                
                if (map._baseLayer) {
                    map.removeLayer(map._baseLayer);
                }
                
                const style = mapStyles[currentMapStyle] || mapStyles.osm;
                map._baseLayer = L.tileLayer(style.url, {
                    attribution: style.attribution,
                    maxZoom: 19,
                    detectRetina: true
                }).addTo(map);
            }
            
            function updateUserLocation() {
                if (!map) return;
                
                if (userMarker) map.removeLayer(userMarker);
                if (radiusCircle) map.removeLayer(radiusCircle);
                
                const userIcon = L.divIcon({
                    className: 'user-marker',
                    html: '<div style="background: #3b82f6; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2);"></div>',
                    iconSize: [26, 26],
                    iconAnchor: [13, 13]
                });
                
                userMarker = L.marker([${center.lat}, ${center.lng}], { 
                    icon: userIcon,
                    interactive: false
                }).addTo(map);
                
                radiusCircle = L.circle([${center.lat}, ${center.lng}], {
                    radius: ${radius * 1000},
                    fillColor: '#3b82f6',
                    fillOpacity: 0.1,
                    color: '#3b82f6',
                    weight: 2,
                    opacity: 0.6,
                    interactive: false
                }).addTo(map);
            }
            
            function updateBikes() {
                if (!map) return;
                
                bikeMarkers.forEach(marker => map.removeLayer(marker));
                bikeMarkers = [];
                
                const bikes = ${JSON.stringify(bikesWithCoords)};
                
                bikes.forEach(bike => {
                    let batteryColor = '#16a34a';
                    if (bike.batteryLevel <= 50) batteryColor = '#f59e0b';
                    if (bike.batteryLevel <= 20) batteryColor = '#ef4444';
                    
                    const bikeIcon = L.divIcon({
                        className: 'bike-marker',
                        html: \`
                            <div style="
                                background: \${batteryColor}; 
                                color: white; 
                                width: 32px; 
                                height: 32px; 
                                border-radius: 50%; 
                                border: 2px solid white; 
                                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                                display: flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-size: 10px; 
                                font-weight: bold;
                                cursor: pointer;
                                touch-action: manipulation;
                            ">
                                \${bike.batteryLevel}%
                            </div>
                        \`,
                        iconSize: [36, 36],
                        iconAnchor: [18, 18]
                    });
                    
                    const popupContent = \`
                        <div class="bike-popup">
                            <div class="title">🚲 \${bike.code}</div>
                            <div style="color: #6b7280; margin-bottom: 12px;">\${bike.model}</div>
                            <div class="details">
                                <div class="detail-item">
                                    <div class="detail-value" style="color: \${batteryColor}">
                                        ⚡ \${bike.batteryLevel}%
                                    </div>
                                    <div class="detail-label">Batterie</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-value">📍 \${bike.distance ? bike.distance.toFixed(1) + ' km' : '--'}</div>
                                    <div class="detail-label">Distance</div>
                                </div>
                            </div>
                        </div>
                    \`;
                    
                    const marker = L.marker([bike.latitude, bike.longitude], { 
                        icon: bikeIcon 
                    })
                    .bindPopup(popupContent, {
                        className: 'bike-popup-container',
                        maxWidth: 280,
                        offset: [0, -10]
                    })
                    .addTo(map);
                    
                    marker.on('click', (e) => {
                        e.originalEvent.preventDefault();
                        e.originalEvent.stopPropagation();
                        
                        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                type: 'bikeSelected',
                                bike: bike
                            }));
                        }
                    });
                    
                    bikeMarkers.push(marker);
                });
            }
            
            function centerOnUser() {
                if (map) {
                    map.setView([${center.lat}, ${center.lng}], map.getZoom(), { 
                        animate: true,
                        duration: 0.5 
                    });
                }
            }
            
            function zoomIn() {
                if (map) {
                    map.zoomIn(0.75, { animate: true });
                }
            }
            
            function zoomOut() {
                if (map) {
                    map.zoomOut(0.75, { animate: true });
                }
            }
            
            function toggleMapStyle() {
                const styles = Object.keys(mapStyles);
                const currentIndex = styles.indexOf(currentMapStyle);
                const nextIndex = (currentIndex + 1) % styles.length;
                currentMapStyle = styles[nextIndex];
                updateMapStyle();
            }
            
            // Gestionnaire de messages
            function handleMessage(event) {
                try {
                    const data = JSON.parse(event.data);
                    
                    switch(data.type) {
                        case 'centerOnUser':
                            centerOnUser();
                            break;
                        case 'zoomIn':
                            zoomIn();
                            break;
                        case 'zoomOut':
                            zoomOut();
                            break;
                        case 'toggleMapStyle':
                            toggleMapStyle();
                            break;
                    }
                } catch (e) {
                    console.error('Error parsing message:', e);
                }
            }
            
            // Attacher les événements
            window.addEventListener('message', handleMessage);
            document.addEventListener('message', handleMessage);
            
            // Gestion du redimensionnement
            window.addEventListener('resize', function() {
                if (map) {
                    setTimeout(() => {
                        map.invalidateSize(true);
                    }, 100);
                }
            });
            
            // Initialisation
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', initMap);
            } else {
                initMap();
            }
        </script>
    </body>
    </html>
  `;

  // Rendu conditionnel basé sur la plateforme
  if (isWeb) {
    return (
      <View style={styles.container}>
        <div 
          ref={(el: any) => { mapContainerRef.current = el; }}
          style={{ 
            width: '100%', 
            height: '100%',
            touchAction: 'auto'
          }}
        />
      </View>
    );
  }

  // Version mobile avec WebView - CONFIGURATION CORRIGÉE
  const ReactNativeWebView = require('react-native-webview').WebView;

  return (
    <View style={styles.container}>
      <ReactNativeWebView
        ref={webViewRef}
        source={{ html: mapHTML }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={false}
        scalesPageToFit={false}
        scrollEnabled={true}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        bounces={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        originWhitelist={['*']}
        mixedContentMode="compatibility"
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        allowsFullscreenVideo={false}
        allowsBackForwardNavigationGestures={false}
        cacheEnabled={true}
        incognito={false}
        onMessage={(event: any) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            
            switch(data.type) {
              case 'mapReady':
                onMapReady?.();
                break;
              case 'bikeSelected':
                onBikePress?.(data.bike);
                break;
            }
          } catch (e) {
            console.error('Error parsing WebView message:', e);
          }
        }}
        onError={(syntheticEvent: { nativeEvent: any; }) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error: ', nativeEvent);
        }}
        onLoadEnd={() => {
          // console.log('WebView loaded successfully');
        }}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});