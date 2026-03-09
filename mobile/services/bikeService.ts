import { API_CONFIG, handleApiResponse, ApiError } from '@/lib/api/config';
import { authService } from './authService';

export interface Bike {
  id: string;
  code: string;
  qrCode: string;
  model: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'UNAVAILABLE';
  batteryLevel: number;
  latitude: number | null;
  longitude: number | null;
  locationName?: string;
  equipment?: string[];
  lastMaintenanceAt?: string;
  createdAt: string;
  updatedAt: string;
  distance?: number;
  currentPricing?: {
    displayPrice: number;
    durationHours: number;
    isNight: boolean;
    isFallback: boolean;
    unlockFee: number;
  };
}

export interface Location {
  latitude: number;
  longitude: number;
  lat?: number;
  lng?: number;
}

export interface BikeFilters {
  status?: string;
  minBatteryLevel?: number;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface Area {
  key: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
}

class BikeService {
  private baseUrl = `${API_CONFIG.BASE_URL}/bikes`;

  private async getAuthHeaders() {
    const token = await authService.getToken();
    if (!token) {
      throw new Error('not_authenticated');
    }
    return {
      ...API_CONFIG.HEADERS,
      'Authorization': `Bearer ${token}`,
    };
  }

  async getAvailableBikes(filters?: BikeFilters, page: number = 1, limit: number = 20): Promise<{ bikes: Bike[]; pagination: any }> {
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            queryParams.append(key, value.toString());
          }
        });
      }
      
      const response = await fetch(`${this.baseUrl}/available?${queryParams.toString()}`, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      const result = await handleApiResponse(response);
      return {
        bikes: result.data || [],
        pagination: result.pagination || { page, limit, total: 0, totalPages: 0 }
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async getBikeById(bikeId: string): Promise<Bike> {
    try {
      const response = await fetch(`${this.baseUrl}/${bikeId}`, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      const result = await handleApiResponse(response);
      return result.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async getBikeByCode(code: string): Promise<Bike> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/code/${code}`, {
        method: 'GET',
        headers,
      });

      const result = await handleApiResponse(response);
      return result.data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async unlockBike(bikeId: string): Promise<{ success: boolean; message: string }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/${bikeId}/unlock`, {
        method: 'POST',
        headers,
      });

      const result = await handleApiResponse(response);
      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async getDefaultAreas(): Promise<Area[]> {
    try {
      const response = await fetch(`${this.baseUrl}/areas/default`, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      const result = await handleApiResponse(response);
      return result.data || [];
    } catch (error) {
      console.error('Error loading default areas:', error);
      return [];
    }
  }

  async reportIssue(bikeId: string, issueData: {
    type: string;
    description: string;
    photos?: string[];
  }): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/api/v1/incidents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          bikeId,
          type: issueData.type,
          description: issueData.description,
          priority: 'MEDIUM'
        }),
      });

      await handleApiResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  private getErrorMessage(error: ApiError): string {
    return error.message || 'unknown_error';
  }
}

export const bikeService = new BikeService();