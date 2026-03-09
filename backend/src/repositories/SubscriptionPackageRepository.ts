import { prisma } from '../config/prisma';

export interface CreateSubscriptionPackageDTO {
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateSubscriptionPackageDTO {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface CreateSubscriptionFormulaDTO {
  packageId: string;
  name: string;
  description?: string;
  formulaType?: string; // 'TIME_WINDOW' | 'DURATION'
  numberOfDays: number;
  price: number;
  // TIME_WINDOW fields
  dayStartHour?: number;
  dayEndHour?: number;
  chargeAfterHours?: boolean;
  afterHoursPrice?: number;
  afterHoursType?: string;
  // DURATION fields
  maxRideDurationHours?: number;
  isActive?: boolean;
}

export interface UpdateSubscriptionFormulaDTO {
  name?: string;
  description?: string;
  formulaType?: string;
  numberOfDays?: number;
  price?: number;
  dayStartHour?: number;
  dayEndHour?: number;
  chargeAfterHours?: boolean;
  afterHoursPrice?: number;
  afterHoursType?: string;
  maxRideDurationHours?: number;
  isActive?: boolean;
}

class SubscriptionPackageRepository {
  // Package Management
  async createPackage(data: CreateSubscriptionPackageDTO) {
    return await prisma.subscriptionPackage.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: data.isActive ?? true
      },
      include: { formulas: true }
    });
  }

  async getPackageById(id: string) {
    return await prisma.subscriptionPackage.findUnique({
      where: { id },
      include: { formulas: true }
    });
  }

  async getAllPackages(includeInactive: boolean = false) {
    return await prisma.subscriptionPackage.findMany({
      where: includeInactive ? {} : { isActive: true },
      include: { 
        formulas: includeInactive ? true : { where: { isActive: true } }
      },
      orderBy: { createdAt: 'asc' }
    });
  }

  async updatePackage(id: string, data: UpdateSubscriptionPackageDTO) {
    return await prisma.subscriptionPackage.update({
      where: { id },
      data,
      include: { formulas: true }
    });
  }

  async deletePackage(id: string) {
    return await prisma.subscriptionPackage.delete({
      where: { id }
    });
  }

  // Formula Management
  async createFormula(data: CreateSubscriptionFormulaDTO) {
    return await prisma.subscriptionFormula.create({
      data: {
        packageId: data.packageId,
        name: data.name,
        description: data.description,
        formulaType: data.formulaType ?? 'TIME_WINDOW',
        numberOfDays: data.numberOfDays,
        price: data.price,
        dayStartHour: data.dayStartHour ?? 0,
        dayEndHour: data.dayEndHour ?? 23,
        chargeAfterHours: data.chargeAfterHours ?? false,
        afterHoursPrice: data.afterHoursPrice,
        afterHoursType: data.afterHoursType ?? 'FIXED_PRICE',
        maxRideDurationHours: data.maxRideDurationHours ?? null,
        isActive: data.isActive ?? true
      } as any
    });
  }

  async getFormulaById(id: string) {
    return await prisma.subscriptionFormula.findUnique({
      where: { id }
    });
  }

  async getFormulasByPackageId(packageId: string, includeInactive: boolean = false) {
    return await prisma.subscriptionFormula.findMany({
      where: {
        packageId,
        ...(includeInactive ? {} : { isActive: true })
      },
      orderBy: { numberOfDays: 'asc' }
    });
  }

  async updateFormula(id: string, data: UpdateSubscriptionFormulaDTO) {
    return await prisma.subscriptionFormula.update({
      where: { id },
      data
    });
  }

  async deleteFormula(id: string) {
    return await prisma.subscriptionFormula.delete({
      where: { id }
    });
  }

  // Promotion Management
  async createPromotion(data: {
    name: string;
    description?: string;
    discountType: string;
    discountValue: number;
    startDate: Date;
    endDate: Date;
    usageLimit?: number;
    isActive?: boolean;
  }) {
    return await prisma.subscriptionPromotionRule.create({
      data: {
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        startDate: data.startDate,
        endDate: data.endDate,
        usageLimit: data.usageLimit,
        isActive: data.isActive ?? true
      },
      include: { promotions: true }
    });
  }

  async getPromotionById(id: string) {
    return await prisma.subscriptionPromotionRule.findUnique({
      where: { id },
      include: { promotions: true }
    });
  }

  async getAllPromotions() {
    return await prisma.subscriptionPromotionRule.findMany({
      where: { isActive: true },
      include: { promotions: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  async updatePromotion(id: string, data: Partial<any>) {
    return await prisma.subscriptionPromotionRule.update({
      where: { id },
      data,
      include: { promotions: true }
    });
  }

  async deletePromotion(id: string) {
    return await prisma.subscriptionPromotionRule.delete({
      where: { id }
    });
  }

  // Promotion Relations
  async attachPromotionToPackage(promotionId: string, packageId: string) {
    return await prisma.promotionPackageRelation.create({
      data: {
        promotionId,
        packageId,
        formulaId: null
      }
    });
  }

  async attachPromotionToFormula(promotionId: string, formulaId: string) {
    return await prisma.promotionPackageRelation.create({
      data: {
        promotionId,
        packageId: null,
        formulaId
      }
    });
  }

  async removePromotionRelation(relationId: string) {
    return await prisma.promotionPackageRelation.delete({
      where: { id: relationId }
    });
  }

  async getPromotionsForFormula(formulaId: string) {
    return await prisma.promotionPackageRelation.findMany({
      where: { formulaId },
      include: { promotion: true }
    });
  }

  async getPromotionsForPackage(packageId: string) {
    return await prisma.promotionPackageRelation.findMany({
      where: { packageId },
      include: { promotion: true }
    });
  }
}

export default new SubscriptionPackageRepository();
