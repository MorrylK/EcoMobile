import Constants from 'expo-constants';
import { getTranslationSync } from '../mobile-i18n';
import { storage } from '../../utils/storage';
import { loggerService } from '../../services/loggerService';

// Cache pour la langue
let cachedLanguage: 'fr' | 'en' | null = null;
const LANGUAGE_STORAGE_KEY = 'EcoMobile_mobile_language';

// Fonction pour obtenir la langue actuelle (avec cache)
const getCurrentLanguage = async (): Promise<'fr' | 'en'> => {
  if (cachedLanguage) {
    return cachedLanguage;
  }
  
  try {
    const savedLanguage = await storage.getItem(LANGUAGE_STORAGE_KEY);
    cachedLanguage = (savedLanguage === 'fr' || savedLanguage === 'en') ? savedLanguage as 'fr' | 'en' : 'fr';
    return cachedLanguage;
  } catch {
    return 'fr';
  }
};

const getApiBaseUrl = () => {
  // Priorité 1: Variable d'environnement Expo (pour production)
  const envApiUrl = Constants.expoConfig?.extra?.apiUrl;
  
  // Priorité 3: URL par défaut depuis app.json
  // const defaultUrl = 'http://10.33.52.189:10000/api/v1';
  // const defaultUrl = 'https://env-freebike-xybronix.hidora.com/api/v1';
  // const defaultUrl = 'https://ecomobile-8bx0.onrender.com/api/v1';
  const defaultUrl = 'http://www.srv884070.hstgr.cloud:22333/api/v1';
  
  // En développement, toujours utiliser l'URL de développement
  if (__DEV__) {
    return defaultUrl;
  }
  
  // En production, utiliser l'URL depuis app.json ou la valeur par défaut
  const apiUrl = envApiUrl || defaultUrl;
  
  // Log pour débogage (uniquement en développement ou si configuré)
  if (__DEV__) {
    console.log('[API Config] Mode:', __DEV__ ? 'DEVELOPMENT' : 'PRODUCTION');
    console.log('[API Config] API URL:', apiUrl);
    console.log('[API Config] Constants.expoConfig?.extra?.apiUrl:', envApiUrl);
  }
  
  return apiUrl;
};

const API_BASE_URL = getApiBaseUrl();


export const API_CONFIG = {
  BASE_URL: API_BASE_URL,
  TIMEOUT: 30000, // Augmenté à 30s pour les connexions lentes
  RETRY_ATTEMPTS: 3, // Nombre de tentatives en cas d'échec
  RETRY_DELAY: 1000, // Délai entre les tentatives (ms)
  HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
};

// Gestion des erreurs API
export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// Intercepteur de requêtes avec gestion améliorée des erreurs
export const handleApiResponse = async (response: Response) => {
  if (!response.ok) {
    let errorData: { error?: string; message?: string; code?: string } = {};
    try {
      errorData = await response.json() as { error?: string; message?: string; code?: string };
    } catch {
      errorData = { 
        error: `HTTP ${response.status} - ${response.statusText}`,
        message: `HTTP ${response.status} - ${response.statusText}`,
        code: 'UNKNOWN_ERROR'
      };
    }
    
    // Le backend peut renvoyer soit 'error' soit 'message', on prend les deux en compte
    const backendErrorMessage = errorData.error || errorData.message || `Request failed with status ${response.status}`;
    
    // Gestion spéciale pour les erreurs 502 (Bad Gateway)
    // Cela peut indiquer que le serveur backend n'est pas accessible ou qu'il y a un problème de proxy
    if (response.status === 502) {
      const language = await getCurrentLanguage();
      const translatedMessage = getTranslationSync('error.badGateway', language);
      
      // Logger l'erreur 502
      await loggerService.logApiError(
        `Bad Gateway (502): ${translatedMessage}`,
        response.url || 'Unknown URL',
        'GET',
        502,
        { errorData, statusText: response.statusText }
      );
      
      throw new ApiError(
        response.status,
        translatedMessage,
        'BAD_GATEWAY'
      );
    }
    
    // Gestion spéciale pour les erreurs 503 (Service Unavailable)
    // Cela peut indiquer que le serveur est en veille (Render.com free tier)
    if (response.status === 503) {
      const language = await getCurrentLanguage();
      const translatedMessage = getTranslationSync('error.serviceUnavailableMessage', language);
      
      // Logger l'erreur 503
      await loggerService.logApiError(
        `Service Unavailable (503): ${translatedMessage}`,
        response.url || 'Unknown URL',
        'GET',
        503,
        { errorData, statusText: response.statusText }
      );
      
      throw new ApiError(
        response.status,
        translatedMessage,
        'SERVICE_UNAVAILABLE'
      );
    }
    
    // Gestion spéciale pour les erreurs de connexion réseau
    if (response.status === 0 || response.status === 408) {
      const language = await getCurrentLanguage();
      const translatedMessage = getTranslationSync('error.connectionError', language);
      
      // Logger l'erreur de connexion
      await loggerService.logApiError(
        `Connection Error (${response.status}): ${translatedMessage}`,
        response.url || 'Unknown URL',
        'GET',
        response.status,
        { errorData, statusText: response.statusText }
      );
      
      throw new ApiError(
        response.status,
        translatedMessage,
        'NETWORK_ERROR'
      );
    }
    
    // Logger toutes les autres erreurs HTTP
    await loggerService.logApiError(
      `HTTP ${response.status}: ${backendErrorMessage}`,
      response.url || 'Unknown URL',
      'GET',
      response.status,
      { errorData, statusText: response.statusText }
    );
    
    // Si c'est un 403 (Forbidden), déconnecter l'utilisateur automatiquement
    if (response.status === 403) {
      const { authService } = await import('@/services/authService');
      try {
        await authService.logout();
      } catch (logoutError) {
        console.error('Error during logout on 403:', logoutError);
      }
    }
    
    // Pour les autres erreurs, utiliser le message du backend (qui peut déjà être traduit)
    throw new ApiError(
      response.status, 
      backendErrorMessage, 
      errorData.code
    );
  }
  
  try {
    return await response.json();
  } catch (error) {
    const language = await getCurrentLanguage();
    const baseMessage = getTranslationSync('error.invalidJsonResponse', language);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Logger l'erreur de parsing JSON
    await loggerService.logError(
      `Invalid JSON Response: ${baseMessage}`,
      error instanceof Error ? error : new Error(errorMessage),
      { url: response.url, status: response.status }
    );
    
    throw new ApiError(500, `${baseMessage}: ${errorMessage}`, 'INVALID_JSON');
  }
};

// Fonction helper pour retry automatique en cas d'erreur réseau ou 503
export const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  retries: number = API_CONFIG.RETRY_ATTEMPTS
): Promise<Response> => {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Créer un AbortController pour gérer le timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
      
      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal as any, // Type assertion pour compatibilité React Native
        });
        
        clearTimeout(timeoutId);
        
        // Si c'est un 502 (Bad Gateway) ou 503 (Service Unavailable), on réessaie
        if ((response.status === 502 || response.status === 503) && attempt < retries - 1) {
          if (__DEV__) {
            console.log(`[API Retry] Tentative ${attempt + 1}/${retries} - ${response.status === 502 ? 'Bad Gateway (502)' : 'Service Unavailable (503)'}, nouvelle tentative dans ${API_CONFIG.RETRY_DELAY * (attempt + 1)}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1)));
          continue;
        }
        
        return response;
      } catch (fetchError) {
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Logger l'erreur de tentative
      await loggerService.logWarning(
        `API Retry attempt ${attempt + 1}/${retries} failed`,
        {
          url,
          error: lastError.message,
          errorName: lastError.name,
        }
      );
      
      // Si c'est une erreur réseau/timeout et qu'il reste des tentatives, on réessaie
      if (attempt < retries - 1) {
        const isNetworkError = 
          error instanceof TypeError || 
          (error instanceof Error && (error.message.includes('Network') || error.message.includes('fetch'))) ||
          (error instanceof Error && error.name === 'AbortError');
        
        if (isNetworkError) {
          if (__DEV__) {
            console.log(`[API Retry] Tentative ${attempt + 1}/${retries} - Erreur réseau, nouvelle tentative dans ${API_CONFIG.RETRY_DELAY * (attempt + 1)}ms...`);
          }
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.RETRY_DELAY * (attempt + 1)));
          continue;
        }
      }
      
      // Si ce n'est pas une erreur réseau ou qu'on a épuisé les tentatives, on propage l'erreur
      if (attempt === retries - 1) {
        // Logger l'erreur finale après toutes les tentatives
        await loggerService.logApiError(
          `Failed after ${retries} retries: ${lastError.message}`,
          url,
          options.method || 'GET',
          undefined,
          { error: lastError.message, errorName: lastError.name }
        );
        throw lastError;
      }
    }
  }
  
  const language = await getCurrentLanguage();
  const errorMessage = getTranslationSync('error.failedAfterRetries', language);
  throw lastError || new Error(errorMessage);
};
