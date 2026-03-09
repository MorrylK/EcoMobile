import { API_CONFIG, handleApiResponse, ApiError } from '@/lib/api/config';
import { withNetworkCheck } from '@/lib/api/networkInterceptor';
import { authService, User } from './authService';
import { storeLanguage, storeUserData } from '@/utils/storage';

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  language?: 'fr' | 'en';
}

export interface UserStats {
  rides: {
    total: number;
    totalDistance: number;
    totalCost: number;
    totalDuration: number;
  };
  averageRating: number;
  carbonSaved: number;
  monthlyStats?: {
    month: string;
    rides: number;
    distance: number;
    cost: number;
  }[];
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error' | 'promotional';
  isRead: boolean;
  createdAt: string;
}

class UserService {
  private baseUrl = `${API_CONFIG.BASE_URL}/users`;

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

  async getProfile(): Promise<User> {
    return withNetworkCheck(async () => {
      const headers = await this.getAuthHeaders();
      
      try {
        const response = await fetch(`${this.baseUrl}/profile`, {
          method: 'GET',
          headers,
        });

        const result = await handleApiResponse(response);
        const user = result.data;
        
        await storeUserData(user);
        return user;
      } catch (error) {
        // Vérifier si c'est une erreur de compte désactivé
        const { checkAndHandleAccountDeactivation } = await import('@/utils/accountDeactivationHandler');
        const isDeactivated = await checkAndHandleAccountDeactivation(error);
        if (isDeactivated) {
          throw new Error('not_authenticated');
        }
        
        // Si erreur d'autorisation (401, 403), déconnecter l'utilisateur
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await authService.logout();
          throw new Error('not_authenticated');
        }
        throw error;
      }
    }, 'auth.internetRequired');
  }

  async updateProfile(profileData: UpdateProfileData): Promise<User> {
    return withNetworkCheck(async () => {
      const headers = await this.getAuthHeaders();
      
      try {
        const response = await fetch(`${this.baseUrl}/profile`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(profileData),
        });

        const result = await handleApiResponse(response);
        const user = result.data;
        
        await storeUserData(user);
        
        if (profileData.language) {
          await storeLanguage(profileData.language);
        }

        return user;
      } catch (error) {
        // Si erreur d'autorisation (401, 403), déconnecter l'utilisateur
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          await authService.logout();
          throw new Error('not_authenticated');
        }
        if (error instanceof ApiError) {
          throw new Error(this.getErrorMessage(error));
        }
        throw new Error('network_error');
      }
    }, 'auth.internetRequired');
  }

  async updatePassword(currentPassword: string, newPassword: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/password`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      await handleApiResponse(response);
    } catch (error) {
      // Si erreur d'autorisation (401, 403), déconnecter l'utilisateur
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await authService.logout();
        throw new Error('not_authenticated');
      }
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  /**
   * Récupère toutes les données du dashboard en une seule requête (optimisé)
   */
  async getDashboard(): Promise<{
    wallet: any;
    deposit: any;
    recentRides: any[];
    stats: {
      totalRides: number;
      totalSpent: number;
      totalDistance: number;
      lastRideDate: string | null;
    };
    subscription: any | null;
  }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/dashboard`, {
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

  async getStats(): Promise<UserStats> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/stats`, {
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

  async getNotifications(page: number = 1, limit: number = 20): Promise<{ notifications: UserNotification[]; total: number; page: number }> {
    const headers = await this.getAuthHeaders();
    
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('page', page.toString());
      queryParams.append('limit', limit.toString());
      
      const response = await fetch(`${this.baseUrl}/notifications?${queryParams.toString()}`, {
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

  async markNotificationAsRead(notificationId: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/notifications/${notificationId}/read`, {
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

  async markAllNotificationsAsRead(): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/notifications/read-all`, {
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

  async getUnreadNotificationsCount(): Promise<number> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/notifications/unread-count`, {
        method: 'GET',
        headers,
      });

      const result = await handleApiResponse(response);
      return result.data.unreadCount || 0;
    } catch (error) {
      if (error instanceof ApiError) {
        throw new Error(this.getErrorMessage(error));
      }
      throw new Error('network_error');
    }
  }

  async uploadProfilePicture(imageUri: string): Promise<{ imageUrl: string }> {
    const token = await authService.getToken();
    if (!token) {
      throw new Error('not_authenticated');
    }

    try {
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'profile.jpg',
      } as any);

      const response = await fetch(`${this.baseUrl}/profile/photo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
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

  async deleteAccount(): Promise<void> {
    const headers = await this.getAuthHeaders();
    
    try {
      const response = await fetch(`${this.baseUrl}/account`, {
        method: 'DELETE',
        headers,
      });

      await handleApiResponse(response);
      await authService.logout();
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

export const userService = new UserService();