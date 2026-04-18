export const getApiBaseUrl = (): string => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    return 'http://www.srv884070.hstgr.cloud:22333/api/v1';
  }
  
  if ((import.meta as any).env.VITE_NODE_ENV === 'production') {
    return 'http://www.srv884070.hstgr.cloud:22333/api/v1';
  }
  
  return 'http://www.srv884070.hstgr.cloud:22333/api/v1';
};

const API_BASE_URL = getApiBaseUrl();

/**
 * Obtient l'URL de base du serveur sans le préfixe /api/v1
 * Utile pour les ressources statiques comme les images
 */
export const getBaseUrl = (): string => {
  const apiUrl = getApiBaseUrl();
  return apiUrl.replace(/\/api\/v1\/?$/, '');
};


export class TokenManager {
  private static readonly TOKEN_KEY = 'ecomobile_token';
  private static readonly REFRESH_TOKEN_KEY = 'ecomobile_refresh_token';
  private static token: string | null = null;

  static setTokens(accessToken: string, refreshToken?: string) {
    this.token = accessToken;
    sessionStorage.setItem(this.TOKEN_KEY, accessToken);
    
    if (refreshToken) {
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  static getToken(): string | null {
    if (this.token) return this.token;
    
    this.token = sessionStorage.getItem(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY);
    return this.token;
  }

  static getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_TOKEN_KEY);
  }

  static clearTokens() {
    this.token = null;
    sessionStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_TOKEN_KEY);
    localStorage.removeItem('authToken');
    localStorage.removeItem('ecomobile_user');
  }

  static isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return Date.now() >= payload.exp * 1000;
    } catch {
      return true;
    }
  }
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  status?: number;
}

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
}

/** Cache GET responses pour éviter les requêtes en double (TTL 15s) */
const GET_CACHE_TTL_MS = 15_000;
const getCache = new Map<string, { response: ApiResponse<unknown>; until: number }>();
/** Requêtes GET en cours : déduplication */
const getInFlight = new Map<string, Promise<ApiResponse<unknown>>>();

// API Client class
export class ApiClient {
  private baseURL: string;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  /** Invalide le cache GET (à appeler après une action qui modifie les données) */
  static invalidateGetCache(): void {
    getCache.clear();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = TokenManager.getToken();
      const language = localStorage.getItem('language') || 'fr';

      if (!token && this.requiresAuth(endpoint)) {
        return {
          success: false,
          error: 'Authentication required',
          status: 401,
        };
      }

      const headers = new Headers({
        'Content-Type': 'application/json',
        'Accept-Language': language,
        ...(options.headers as Record<string, string>),
      });

      if (token) {
        if (TokenManager.isTokenExpired(token)) {
          TokenManager.clearTokens();
          return {
            success: false,
            error: 'Token expired',
            status: 401,
          };
        }
        headers.set('Authorization', `Bearer ${token}`);
      }

      const config: RequestInit = {
        ...options,
        headers,
      };

      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || data.error || 'Une erreur est survenue',
          status: response.status,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
        status: response.status,
      };
    } catch (error) {
      console.error('API Error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur de connexion au serveur',
        status: 0,
      };
    }
  }

  private requiresAuth(endpoint: string): boolean {
    const authRequiredEndpoints = [
      '/admin/',
      '/rides',
      '/notifications',
      '/users'
    ];
    return authRequiredEndpoints.some(authEndpoint => 
      endpoint.startsWith(authEndpoint)
    );
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    const cacheKey = `GET:${url}`;
    const now = Date.now();

    // 1. Cache valide → retour immédiat
    const cached = getCache.get(cacheKey);
    if (cached && cached.until > now) {
      return { ...cached.response, data: cached.response.data } as ApiResponse<T>;
    }

    // 2. Requête déjà en cours → réutiliser la même promesse
    const inFlight = getInFlight.get(cacheKey);
    if (inFlight) {
      const result = await inFlight;
      return { ...result, data: result.data } as ApiResponse<T>;
    }

    // 3. Nouvelle requête
    const promise = this.request<T>(url).then((res) => {
      getInFlight.delete(cacheKey);
      if (res.success && res.status === 200) {
        getCache.set(cacheKey, {
          response: { ...res },
          until: now + GET_CACHE_TTL_MS,
        });
      }
      return res;
    });
    getInFlight.set(cacheKey, promise as Promise<ApiResponse<unknown>>);
    return promise;
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    ApiClient.invalidateGetCache();
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    ApiClient.invalidateGetCache();
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    ApiClient.invalidateGetCache();
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();

export const setAuthToken = (token: string, refreshToken?: string) => {
  TokenManager.setTokens(token, refreshToken);
};

export const getAuthToken = () => TokenManager.getToken();

export const removeAuthToken = () => TokenManager.clearTokens();