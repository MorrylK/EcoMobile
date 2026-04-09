import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';

import { authService } from '@/services/authService';
import { notificationService } from '@/services/notificationService';
import { API_CONFIG } from '@/lib/api/config';
import { toast } from '@/components/ui/Toast';
import { haptics } from '@/utils/haptics';

/**
 * Hook pour utiliser Server-Sent Events (SSE) pour les notifications en temps réel sur mobile
 * React Native n'a pas EventSource natif, on utilise fetch avec streaming
 * Remplace le polling et réduit drastiquement le nombre de requêtes
 */
export function useNotificationSSE() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const [isConnected, setIsConnected] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);
  const reconnectAttempts = useRef<number>(0);
  const maxReconnectAttempts = 5;
  const reconnectDelay = 3000; // 3 secondes
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    let isMounted = true;
    let cleanupPolling: (() => void) | null = null;

    const connectSSE = async () => {
      // Annuler la connexion existante si elle existe
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      try {
        const token = await authService.getToken();
        if (!token) {
          return;
        }

        const apiUrl = API_CONFIG.BASE_URL;
        // Passer le token en query param car fetch ne supporte pas les headers personnalisés pour SSE
        const sseUrl = `${apiUrl}/notifications/stream?token=${encodeURIComponent(token)}`;

        // Créer un AbortController pour pouvoir annuler la requête
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Utiliser fetch avec streaming pour simuler EventSource
        const response = await fetch(sseUrl, {
          method: 'GET',
          headers: {
            'Accept': 'text/event-stream',
            'Cache-Control': 'no-cache',
          },
          signal: abortController.signal as any,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        if (!isMounted) {
          return;
        }

        setIsConnected(true);
        reconnectAttempts.current = 0;

        // Arrêter le polling si on est connecté en SSE
        if (cleanupPolling) {
          cleanupPolling();
          cleanupPolling = null;
        }

        // Lire le stream
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No reader available');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        const readStream = async () => {
          try {
            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                break;
              }

              if (!isMounted) {
                break;
              }

              // Décoder les données
              buffer += decoder.decode(value, { stream: true });

              // Traiter les lignes complètes
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Garder la ligne incomplète dans le buffer

              for (const line of lines) {
                // Ignorer les commentaires (heartbeat)
                if (line.startsWith(':')) {
                  continue;
                }

                // Traiter les événements SSE
                if (line.startsWith('data: ')) {
                  const dataStr = line.substring(6);
                  try {
                    const data = JSON.parse(dataStr);
                    
                    if (data.type === 'unread_count') {
                      setUnreadCount(data.count);
                      DeviceEventEmitter.emit('unread_count_changed', data.count);
                    } else if (data.type === 'notification') {
                      // Nouvelle notification reçue
                      const notification = data.data;
                      setUnreadCount((prev) => {
                        const newCount = prev + 1;
                        DeviceEventEmitter.emit('unread_count_changed', newCount);
                        return newCount;
                      });
                      
                      // Gérer le blocage de compte en temps réel
                      if (notification.type === 'USER_STATUS_CHANGED' && notification.status === 'blocked') {
                        router.replace('/blocked' as any);
                      }

                      // Redirection automatique pour les actions sur les vélos
                      if (notification.type === 'UNLOCK_APPROVED') {
                        haptics.success();
                        toast.success(notification.message || 'Déverrouillage approuvé');
                        router.push({
                          pathname: '/(modals)/ride-in-progress' as any,
                          params: { bikeData: JSON.stringify(notification.metadata?.bike || {}) }
                        });
                      } else if (notification.type === 'LOCK_APPROVED') {
                        haptics.success();
                        toast.success(notification.message || 'Verrouillage approuvé');
                        router.replace('/(tabs)/home' as any);
                      } else if (notification.type === 'UNLOCK_REJECTED' || notification.type === 'LOCK_REJECTED') {
                        haptics.error();
                        toast.error(notification.message || 'Demande refusée');
                      }

                      // Émettre un événement global pour que les composants puissent réagir
                      DeviceEventEmitter.emit('notification_received', notification);
                    }

                  } catch (error) {
                    console.error('[SSE] Error parsing data:', error);
                  }
                } else if (line.startsWith('event: ')) {
                  line.substring(7);
                } else if (line.startsWith('id: ')) {
                }
              }
            }
          } catch (error: any) {
            if (error.name === 'AbortError') {
              // Connexion annulée intentionnellement
              return;
            }
            throw error;
          } finally {
            if (isMounted) {
              setIsConnected(false);
            }
          }
        };

        // Lire le stream en arrière-plan
        readStream().catch((error) => {
          if (error.name !== 'AbortError' && isMounted) {
            console.error('[SSE] Stream error:', error);
            setIsConnected(false);

            // Tentative de reconnexion
            if (reconnectAttempts.current < maxReconnectAttempts) {
              reconnectAttempts.current += 1;
              reconnectTimeoutRef.current = setTimeout(() => {
                if (isMounted) {
                  connectSSE();
                }
              }, reconnectDelay * reconnectAttempts.current);
            } else {
              console.error('[SSE] Max reconnection attempts reached. Falling back to polling.');
              if (!cleanupPolling) {
                cleanupPolling = fallbackToPolling();
              }
            }
          }
        });
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }
        console.error('[SSE] Error creating connection:', error);
        if (isMounted) {
          setIsConnected(false);
          if (!cleanupPolling) {
            cleanupPolling = fallbackToPolling();
          }
        }
      }
    };

    const fallbackToPolling = () => {
      // Fallback vers polling toutes les 60 secondes
      let pollInterval: any = null;
      
      const startPolling = () => {
        pollInterval = setInterval(async () => {
          if (appStateRef.current === 'active' && isMounted) {
            try {
              const count = await notificationService.getUnreadCount();
              if (isMounted) {
                setUnreadCount(count);
                DeviceEventEmitter.emit('unread_count_changed', count);
              }
            } catch (error) {
              console.error('[SSE Fallback] Error fetching unread count:', error);
            }
          }
        }, 60000); // 60 secondes
      };

      startPolling();

      return () => {
        if (pollInterval) {
          clearInterval(pollInterval);
        }
      };
    };

    // Charger le nombre initial
    notificationService.getUnreadCount()
      .then((count) => {
        if (isMounted) {
          setUnreadCount(count);
          DeviceEventEmitter.emit('unread_count_changed', count);
        }
      })
      .catch(console.error);

    // Gérer les changements d'état de l'application
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // L'application revient au premier plan, reconnecter SSE
        if (!isConnected && reconnectAttempts.current < maxReconnectAttempts) {
          connectSSE();
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Connecter au stream SSE
    connectSSE();

    // Nettoyage
    return () => {
      isMounted = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (cleanupPolling) {
        cleanupPolling();
      }
      subscription.remove();
    };
  }, []);

  return { unreadCount, isConnected };
}

/**
 * Hook pour écouter les changements du nombre de notifications non lues
 * sans créer de nouvelle connexion SSE
 */
export function useUnreadCount() {
  const [unreadCount, setUnreadCount] = useState<number>(0);

  useEffect(() => {
    // Charger le nombre initial
    notificationService.getUnreadCount()
      .then(setUnreadCount)
      .catch(console.error);

    const subscription = DeviceEventEmitter.addListener('unread_count_changed', (count: number) => {
      setUnreadCount(count);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return unreadCount;
}
