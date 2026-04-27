import { apiClient } from './client';
import { BikePosition } from './bike.service';
import { AppVersionManifest } from './admin.service';

export interface CompanySettings {
  companyName: string;
  description?: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  orangeMoneyNumber: string;
  mobileMoneyNumber: string;
  facebook?: string;
  twitter?: string;
  instagram?: string;
  linkedin?: string;
  website?: string;
}

export interface PricingPlan {
  id?: string;
  name: string;
  hourlyRate: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  minimumHours: number;
  discount: number;
  isActive: boolean;
  conditions: string[];
  originalHourlyRate?: number;
  appliedRule?: string;
  appliedPromotions?: Promotion[];
  bikes: BikePosition[];
  bikeCount: number;
  override?: {
    id: string;
    overTimeType: 'FIXED_PRICE' | 'PERCENTAGE_REDUCTION';
    overTimeValue: number;
    hourlyStartHour?: number | null;
    hourlyEndHour?: number | null;
    dailyStartHour?: number | null;
    dailyEndHour?: number | null;
    weeklyStartHour?: number | null;
    weeklyEndHour?: number | null;
    monthlyStartHour?: number | null;
    monthlyEndHour?: number | null;
  };
}

export interface PricingRule {
  id?: string;
  name: string;
  dayOfWeek?: number | null;
  startHour?: number;
  endHour?: number;
  multiplier: number;
  isActive: boolean;
  priority: number;
}

export interface Promotion {
  id?: string;
  name: string;
  description?: string;
  discountType: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  conditions?: any;
  plans?: any[];
}

export interface PricingConfig {
  unlockFee: number;
  baseHourlyRate: number;
  plans: PricingPlan[];
  rules: PricingRule[];
  promotions: Promotion[];
  appliedRule?: PricingRule;
  multiplier?: number;
  nextUpdate?: string;
}

export class CompanyService {
  async getSettings(): Promise<CompanySettings> {
    const response = await apiClient.get<Record<string, string>>('/admin/settings');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des paramètres');
    }

    return {
      companyName: response.data.companyName || 'EcoMobile',
      description: response.data.description || '',
      email: response.data.email || '',
      phone: response.data.phone || '',
      address: response.data.address || '',
      city: response.data.city || '',
      country: response.data.country || '',
      orangeMoneyNumber: response.data.orangeMoneyNumber || '',
      mobileMoneyNumber: response.data.mobileMoneyNumber || '',
      facebook: response.data.facebook || '',
      twitter: response.data.twitter || '',
      instagram: response.data.instagram || '',
      linkedin: response.data.linkedin || '',
      website: response.data.website || ''
    };
  }

  async updateSettings(settings: CompanySettings): Promise<void> {
    const response = await apiClient.put('/admin/settings', settings);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la mise à jour des paramètres');
    }
  }

  async getPricing(): Promise<PricingConfig> {
    const response = await apiClient.get<PricingConfig>('/admin/pricing');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération de la configuration de prix');
    }

    const plansWithOverrides = response.data.plans?.map(plan => ({
      ...plan,
      override: plan.override || undefined
    })) || [];

    return {
      ...response.data,
      plans: plansWithOverrides
    };
  }

  async updatePricing(pricing: Partial<PricingConfig>): Promise<void> {
    const response = await apiClient.put('/admin/pricing', pricing);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la mise à jour des prix');
    }
  }

  // Méthodes publiques pour le frontend
  async getPublicPricing(date?: Date, hour?: number): Promise<PricingConfig> {
    const params: Record<string, string> = {};
    if (date) params.date = date.toISOString();
    if (hour !== undefined) params.hour = hour.toString();

    const response = await apiClient.get<PricingConfig>('/public/pricing', params);
    
    if (!response.success) {
      if (response.status === 404 || !response.data) {
        return this.getEmptyPricingConfig();
      }
      throw new Error(response.error || 'Erreur lors de la récupération des prix');
    }

    return response.data || this.getEmptyPricingConfig();
  }

  private getEmptyPricingConfig(): PricingConfig {
    const now = new Date();
    const nextHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours() + 1, 0, 0, 0);
    
    return {
      unlockFee: 0,
      baseHourlyRate: 0,
      plans: [],
      rules: [],
      promotions: [],
      nextUpdate: nextHour.toISOString()
    };
  }

  async getPublicSettings(): Promise<CompanySettings> {
    const response = await apiClient.get<Record<string, string>>('/public/company');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des informations');
    }

    return {
      companyName: response.data.companyName || 'EcoMobile',
      description: response.data.description || '',
      email: response.data.email || '',
      phone: response.data.phone || '',
      address: response.data.address || '',
      city: response.data.city || '',
      country: response.data.country || '',
      orangeMoneyNumber: response.data.orangeMoneyNumber || '',
      mobileMoneyNumber: response.data.mobileMoneyNumber || '',
      facebook: response.data.facebook || '',
      twitter: response.data.twitter || '',
      instagram: response.data.instagram || '',
      linkedin: response.data.linkedin || '',
      website: response.data.website || ''
    };
  }

  async getPromotions(): Promise<Promotion[]> {
    const response = await apiClient.get<Promotion[]>('/admin/promotions');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des promotions');
    }

    return response.data;
  }

  async createPromotion(promotion: Partial<Promotion> & { planIds: string[] }): Promise<void> {
    const response = await apiClient.post('/admin/promotions', promotion);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la création de la promotion');
    }
  }

  async updatePromotion(promotionId: string, promotion: Partial<Promotion> & { planIds?: string[] }): Promise<void> {
    const response = await apiClient.put(`/admin/promotions/${promotionId}`, promotion);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la mise à jour de la promotion');
    }
  }

  async togglePromotionStatus(promotionId: string, isActive: boolean): Promise<void> {
    const response = await apiClient.put(`/admin/promotions/${promotionId}/status`, { isActive });
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la modification du statut de la promotion');
    }
  }

  async deletePlan(planId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/plans/${planId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la suppression du plan');
    }
  }

  async deleteRule(ruleId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/rules/${ruleId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la suppression de la règle');
    }
  }

  async deletePromotion(promotionId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/promotions/${promotionId}`);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la suppression de la promotion');
    }
  }

  async getPlanDetails(planId: string): Promise<PricingPlan> {
    const response = await apiClient.get<PricingPlan>(`/admin/plans/${planId}/details`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des détails du plan');
    }

    return response.data;
  }

  async getPlanBikes(planId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{ bikes: BikePosition[], total: number, pagination: any }> {
    const response = await apiClient.get<{ bikes: BikePosition[], total: number, pagination: any }>(`/admin/plans/${planId}/bikes`, params);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération des vélos du plan');
    }

    return response.data;
  }

  async createPlan(planData: Partial<PricingPlan>): Promise<{ data: PricingPlan }> {
    const response = await apiClient.post<PricingPlan>('/admin/plans', planData);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la création du plan');
    }

    return { data: response.data };
  }

  async createPlanOverride(
    planId: string, 
    overTimeType: string, 
    overTimeValue: number,
    timeSlots?: {
      hourlyStartHour?: number | null;
      hourlyEndHour?: number | null;
      dailyStartHour?: number | null;
      dailyEndHour?: number | null;
      weeklyStartHour?: number | null;
      weeklyEndHour?: number | null;
      monthlyStartHour?: number | null;
      monthlyEndHour?: number | null;
    }
  ): Promise<void> {
    const response = await apiClient.post(`/admin/plans/${planId}/override`, {
      overTimeType,
      overTimeValue,
      ...(timeSlots || {})
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la création de l\'override');
    }
  }

  async deletePlanOverride(planId: string): Promise<void> {
    const response = await apiClient.delete(`/admin/plans/${planId}/override`);
    
    if (!response.success) {
      throw new Error(response.error || 'Erreur lors de la suppression de l\'override');
    }
  }

  async getAppVersion(): Promise<AppVersionManifest> {
    const response = await apiClient.get<AppVersionManifest>('/public/app-version');
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Erreur lors de la récupération de la version applicative');
    }

    return response.data;
  }
}

export const companyService = new CompanyService();