import { apiClient } from './client';

export interface DashboardStats {
  totalUsers: number;
  totalBikes: number;
  totalRides: number;
  totalRevenue: number;
  activeUsers: number;
  availableBikes: number;
  activeRides: number;
  ongoingRides: number;
  revenueToday: number;
  userGrowth: number;
  bikeUtilization: number;
  avgTripDuration: number;
  popularZones: Array<{ name: string; count: number }>;
  maintenanceBikes: number;
  weeklyGrowth: {
    users: number;
    rides: number;
    revenue: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
}

export interface AppSettings {
  company: {
    name: string;
    email: string;
    phone: string;
    address: string;
    website?: string;
  };
  pricing: {
    unlockFee: number;
    ratePerMinute: number;
    maxDailyRate: number;
    currency: string;
  };
  notifications: {
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  };
  features: {
    maintenanceMode: boolean;
    registrationOpen: boolean;
    gpsTracking: boolean;
  };
  supportEmail: string;
  timezone: string;
}

export interface Incident {
  id: string;
  userId: string;
  userName: string;
  bikeId: string;
  bikeName: string;
  type: 'technical' | 'accident' | 'damaged' | 'payment' | 'theft';
  status: 'pending' | 'in-progress' | 'resolved' | 'rejected';
  description: string;
  refundAmount?: number;
  adminNote?: string;
  createdAt: string;
  updatedAt: string;
  attachments?: string[];
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  description: string;
  resource: string;
  resourceId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: string;
  module: string;
  status: 'success' | 'error' | 'warning';
}

export interface PaginatedIncidents {
  incidents: Incident[];
  total: number;
  pages: number;
  currentPage: number;
}

export interface PaginatedLogs {
  logs: ActivityLog[];
  total: number;
  pages: number;
  currentPage: number;
}

export interface PricingConfig {
  unlockFee: number;
  perMinuteRate: number;
  freeMinutes: number;
  maxDailyCharge: number;
  currency: string;
  discounts: Array<{
    name: string;
    percentage: number;
    conditions: string;
  }>;
}

export interface PricingTier {
  id: string;
  name?: string | null;
  durationMinutes: number;
  price: number;
  dayStartHour?: number | null;
  dayEndHour?: number | null;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface PricingTierConflict {
  tierId: string;
  tierName: string;
  overlapStart: number;
  overlapEnd: number;
  priorityWinner: string;
}

export class AdminService {
  /**
   * OPTIMISATION: Récupère toutes les données du dashboard en une seule requête groupée
   * Remplace 4 requêtes séparées par 1 seule requête
   */
  async getDashboardComplete(): Promise<{
    stats: {
      users: { total: number; recent: number };
      bikes: { total: number; byStatus: Record<string, number> };
      rides: { total: number; active: number; today: number };
      revenue: { total: number };
    };
    recentTrips: any[];
    recentIncidents: Incident[];
    gpsData: {
      total: number;
      online: number;
      offline: number;
    };
    realtimePositions: any[];
  }> {
    const response = await apiClient.get<{
      stats: {
        users: { total: number; recent: number };
        bikes: { total: number; byStatus: Record<string, number> };
        rides: { total: number; active: number; today: number };
        revenue: { total: number };
      };
      recentTrips: any[];
      recentIncidents: Incident[];
      gpsData: {
        total: number;
        online: number;
        offline: number;
      };
      realtimePositions: any[];
    }>('/admin/dashboard/complete');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération du dashboard');
    }

    return response.data;
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get<DashboardStats>('/admin/dashboard/stats');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des statistiques');
    }

    return response.data;
  }

  async getSettings(): Promise<AppSettings> {
    const response = await apiClient.get<AppSettings>('/admin/settings');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des paramètres');
    }

    return response.data;
  }

  async updateSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
    const response = await apiClient.put<AppSettings>('/admin/settings', settings);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la mise à jour des paramètres');
    }

    return response.data;
  }

  async getPricing(): Promise<AppSettings['pricing']> {
    const response = await apiClient.get<AppSettings['pricing']>('/admin/pricing');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des tarifs');
    }

    return response.data;
  }

  async updatePricing(pricing: Partial<AppSettings['pricing']>): Promise<AppSettings['pricing']> {
    const response = await apiClient.put<AppSettings['pricing']>('/admin/pricing', pricing);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la mise à jour des tarifs');
    }

    return response.data;
  }

  /* Subscription package / formula / promotion admin APIs (new system) */
  async getSubscriptionPackages(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/admin/pricing/packages');
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la récupération des forfaits');
    return response.data;
  }

  async getSubscriptionPackageById(id: string): Promise<any> {
    const response = await apiClient.get<any>(`/admin/pricing/packages/${id}`);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la récupération du forfait');
    return response.data;
  }

  async createSubscriptionPackage(data: { name: string; description?: string }): Promise<any> {
    const response = await apiClient.post<any>('/admin/pricing/packages', data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la création du forfait');
    return response.data;
  }

  async updateSubscriptionPackage(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/admin/pricing/packages/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la mise à jour du forfait');
    return response.data;
  }

  async deleteSubscriptionPackage(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/admin/pricing/packages/${id}`);
    if (!response.success) throw new Error(response.error || 'Erreur lors de la suppression du forfait');
  }

  async createSubscriptionFormula(data: any): Promise<any> {
    const response = await apiClient.post<any>('/admin/pricing/formulas', data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la création de la formule');
    return response.data;
  }

  async updateSubscriptionFormula(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/admin/pricing/formulas/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la mise à jour de la formule');
    return response.data;
  }

  async deleteSubscriptionFormula(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/admin/pricing/formulas/${id}`);
    if (!response.success) throw new Error(response.error || 'Erreur lors de la suppression de la formule');
  }

  async getPromotions(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/admin/pricing/promotions');
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la récupération des promotions');
    return response.data;
  }

  async createPromotion(data: any): Promise<any> {
    const response = await apiClient.post<any>('/admin/pricing/promotions', data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la création de la promotion');
    return response.data;
  }

  async updatePromotion(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/admin/pricing/promotions/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la mise à jour de la promotion');
    return response.data;
  }

  async deletePromotion(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/admin/pricing/promotions/${id}`);
    if (!response.success) throw new Error(response.error || 'Erreur lors de la suppression de la promotion');
  }

  /* Free Days Rules APIs */
  async getFreeDaysRules(): Promise<any[]> {
    const response = await apiClient.get<any[]>('/free-days');
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la récupération des règles de jours gratuits');
    return response.data;
  }

  async getFreeDaysRuleById(id: string): Promise<any> {
    const response = await apiClient.get<any>(`/free-days/${id}`);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la récupération de la règle');
    return response.data;
  }

  async createFreeDaysRule(data: {
    name: string;
    description?: string;
    numberOfDays: number;
    startType?: string;
    targetType?: string;
    targetDaysSinceRegistration?: number;
    targetMinSpend?: number;
    applyAfterSubscription?: boolean;
    validFrom?: string;
    validUntil?: string;
    maxBeneficiaries?: number;
  }): Promise<any> {
    const response = await apiClient.post<any>('/free-days', data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la création de la règle');
    return response.data;
  }

  async updateFreeDaysRule(id: string, data: any): Promise<any> {
    const response = await apiClient.put<any>(`/free-days/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la mise à jour de la règle');
    return response.data;
  }

  async deleteFreeDaysRule(id: string): Promise<void> {
    const response = await apiClient.delete<void>(`/free-days/${id}`);
    if (!response.success) throw new Error(response.error || 'Erreur lors de la suppression de la règle');
  }

  async addFreeDaysBeneficiary(ruleId: string, userId: string): Promise<any> {
    const response = await apiClient.post<any>(`/free-days/${ruleId}/beneficiaries`, { userId });
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de l\'ajout du bénéficiaire');
    return response.data;
  }

  async removeFreeDaysBeneficiary(ruleId: string, userId: string): Promise<void> {
    const response = await apiClient.delete<void>(`/free-days/${ruleId}/beneficiaries/${userId}`);
    if (!response.success) throw new Error(response.error || 'Erreur lors de la suppression du bénéficiaire');
  }

  async searchFreeDaysUsers(query: string): Promise<any[]> {
    const response = await apiClient.get<any[]>(`/free-days/users/search?q=${encodeURIComponent(query)}`);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur lors de la recherche d\'utilisateurs');
    return response.data;
  }

  async getIncidents(params?: {
    page?: number;
    limit?: number;
    status?: string;
    type?: string;
  }): Promise<PaginatedIncidents> {
    const response = await apiClient.get<PaginatedIncidents>('/admin/incidents', params);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des signalements');
    }

    return response.data;
  }

  async updateIncident(id: string, data: {
    status?: string;
    refundAmount?: number;
    adminNote?: string;
  }): Promise<Incident> {
    const response = await apiClient.put<Incident>(`/admin/incidents/${id}`, data);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la mise à jour du signalement');
    }

    return response.data;
  }

  async getActivityLogs(params?: {
    page?: number;
    limit?: number;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<PaginatedLogs> {
    const response = await apiClient.get<PaginatedLogs>('/admin/activity-logs', params);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des journaux');
    }

    return response.data;
  }

  async resetUserPassword(userId: string, data: { newPassword?: string; generateNew?: boolean }): Promise<{ generated: boolean; password?: string }> {
    const response = await apiClient.post<{ generated: boolean; password?: string }>(`/admin/users/${userId}/reset-password`, data);
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la réinitialisation du mot de passe');
    }
    return response.data;
  }

  // ─── PricingTier ─────────────────────────────────────────────────────────

  async getPricingTiers(): Promise<PricingTier[]> {
    const response = await apiClient.get<{ tiers: PricingTier[] }>('/admin/pricing/tiers');
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data.tiers;
  }

  async createPricingTier(data: Omit<PricingTier, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ tier: PricingTier; conflicts: PricingTierConflict[] }> {
    const response = await apiClient.post<{ tier: PricingTier; conflicts: PricingTierConflict[] }>('/admin/pricing/tiers', data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data;
  }

  async updatePricingTier(id: string, data: Partial<PricingTier>): Promise<{ tier: PricingTier; conflicts: PricingTierConflict[] }> {
    const response = await apiClient.put<{ tier: PricingTier; conflicts: PricingTierConflict[] }>(`/admin/pricing/tiers/${id}`, data);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data;
  }

  async deletePricingTier(id: string): Promise<void> {
    const response = await apiClient.delete(`/admin/pricing/tiers/${id}`);
    if (!response.success) throw new Error(response.error || 'Erreur');
  }

  async togglePricingTierActive(id: string): Promise<PricingTier> {
    const response = await apiClient.put<{ tier: PricingTier }>(`/admin/pricing/tiers/${id}/toggle`);
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data.tier;
  }

  async getPricingTierConflicts(): Promise<{ tier: PricingTier; conflicts: PricingTierConflict[] }[]> {
    const response = await apiClient.get<{ conflicts: { tier: PricingTier; conflicts: PricingTierConflict[] }[] }>('/admin/pricing/tiers/conflicts');
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data.conflicts;
  }

  async updateFallbackRate(baseHourlyRate: number): Promise<{ baseHourlyRate: number }> {
    const response = await apiClient.put<{ baseHourlyRate: number }>('/admin/pricing/fallback', { baseHourlyRate });
    if (!response.success || !response.data) throw new Error(response.error || 'Erreur');
    return response.data;
  }
}

export const adminService = new AdminService();