/* eslint-disable @typescript-eslint/no-unused-vars */
import { API_CONFIG, handleApiResponse, ApiError } from '@/lib/api/config';
import { authService } from './authService';

export interface SubscriptionPackage {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  formulas: SubscriptionFormula[];
}

export interface SubscriptionFormula {
  id: string;
  packageId: string;
  name: string;
  description?: string;
  numberOfDays: number;
  price: number;
  dayStartHour: number;
  dayEndHour: number;
  chargeAfterHours: boolean;
  afterHoursPrice?: number;
  afterHoursType?: string;
  isActive: boolean;
}

export interface FreePlanBeneficiary {
  id: string;
  daysGranted: number;
  daysRemaining: number;
  startDate: string;  // Si > now → pas encore activé
  expiresAt: string;
  isActive: boolean;
  rule: {
    name: string;
    startHour: number | null;
    endHour: number | null;
    validFrom: string | null;
    validUntil: string | null;
  };
}

export interface SubscribeToFormulaRequest {
  formulaId: string;
  startDate?: Date;
}

export interface ActiveSubscription {
  id: string;
  packageName: string;
  formulaName: string;
  startDate: string;
  endDate: string;
  dayResetTime: string;
  currentDay: number;
  numberOfDays: number;
  dayStartHour: number;
  dayEndHour: number;
  chargeAfterHours: boolean;
  status: string;
  remainingDays: number;
  // Nouveau système de tarification
  formulaType?: string; // 'TIME_WINDOW' | 'DURATION'
  maxRideDurationHours?: number | null;
  usedRideMinutes?: number;
  remainingRideMinutes?: number | null;
  planName?: string;
}

class SubscriptionService {
  private baseUrl = `${API_CONFIG.BASE_URL}/subscriptions`;

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

  async getAvailablePackages(): Promise<SubscriptionPackage[]> {
    const response = await fetch(`${this.baseUrl}/packages`, {
      method: 'GET',
      headers: API_CONFIG.HEADERS,
    });

    const result = await handleApiResponse(response);
    // Support both { data: { packages: [] } } and { data: [] }
    return result.data?.packages ?? result.data ?? [];
  }

  async getPackageDetails(packageId: string): Promise<SubscriptionPackage | null> {
    try {
      const response = await fetch(`${this.baseUrl}/packages/${packageId}`, {
        method: 'GET',
        headers: API_CONFIG.HEADERS,
      });

      const result = await handleApiResponse(response);
      return result.data || null;
    } catch (error) {
      console.error('Error loading package details:', error);
      return null;
    }
  }

  async subscribe(data: SubscribeToFormulaRequest): Promise<ActiveSubscription> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
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

  async getCurrentSubscription(): Promise<ActiveSubscription | null> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/current`, {
        method: 'GET',
        headers,
      });

      if (response.status === 404) {
        return null;
      }

      const result = await handleApiResponse(response);
      return result.data;
    } catch (error) {
      return null;
    }
  }

  async getMyFreePlans(): Promise<FreePlanBeneficiary[]> {
    const headers = await this.getAuthHeaders();
    try {
      const response = await fetch(`${API_CONFIG.BASE_URL}/free-days/me`, {
        method: 'GET',
        headers,
      });
      const result = await handleApiResponse(response);
      return result.data ?? [];
    } catch {
      return [];
    }
  }

  async activateFreePlan(beneficiaryId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const response = await fetch(`${API_CONFIG.BASE_URL}/free-days/me/activate/${beneficiaryId}`, {
      method: 'PATCH',
      headers,
    });
    await handleApiResponse(response);
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/${subscriptionId}/cancel`, {
        method: 'POST',
        headers,
      });

      await handleApiResponse(response);
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async changeSubscription(subscriptionId: string, newFormulaId: string): Promise<ActiveSubscription> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/${subscriptionId}/change`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ newFormulaId }),
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

  private getErrorMessage(error: ApiError): string {
    return error.message || 'unknown_error';
  }
}

export const subscriptionService = new SubscriptionService();