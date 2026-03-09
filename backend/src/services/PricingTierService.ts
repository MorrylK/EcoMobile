import { prisma } from '../config/prisma';

export interface PricingTierData {
  name?: string;
  durationMinutes: number;
  price: number;
  dayStartHour?: number | null;
  dayEndHour?: number | null;
  isActive?: boolean;
}

export interface ConflictInfo {
  tierId: string;
  tierName: string;
  overlapStart: number;
  overlapEnd: number;
  priorityWinner: string; // which tier wins (most restrictive time window)
}

export interface CostBreakdown {
  type: 'tier' | 'fallback';
  label: string;
  hours: number;
  unitPrice: number;
  cost: number;
}

export interface CostCalculation {
  totalCost: number;
  billedHours: number;
  breakdown: CostBreakdown[];
}

class PricingTierService {
  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async getAllTiers() {
    return prisma.pricingTier.findMany({
      orderBy: [{ durationMinutes: 'asc' }, { dayStartHour: 'asc' }]
    });
  }

  async getTierById(id: string) {
    return prisma.pricingTier.findUnique({ where: { id } });
  }

  async createTier(data: PricingTierData) {
    const tier = await prisma.pricingTier.create({ data: { ...data, isActive: data.isActive ?? true } as any });
    return { tier, conflicts: await this.detectConflictsFor(tier) };
  }

  async updateTier(id: string, data: Partial<PricingTierData>) {
    const tier = await prisma.pricingTier.update({ where: { id }, data: data as any });
    return { tier, conflicts: await this.detectConflictsFor(tier) };
  }

  async deleteTier(id: string) {
    return prisma.pricingTier.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const tier = await prisma.pricingTier.findUnique({ where: { id } });
    if (!tier) throw new Error('Palier introuvable');
    return prisma.pricingTier.update({ where: { id }, data: { isActive: !tier.isActive } as any });
  }

  // ─── Conflict detection ──────────────────────────────────────────────────────

  /**
   * Two tiers conflict if they have the same durationMinutes AND their time windows overlap.
   * "No time window" (null) means "all day" which overlaps with everything.
   */
  async detectConflictsFor(targetTier: any): Promise<ConflictInfo[]> {
    const allTiers = await prisma.pricingTier.findMany({
      where: { isActive: true, id: { not: targetTier.id } }
    });

    const conflicts: ConflictInfo[] = [];

    for (const other of allTiers) {
      if (other.durationMinutes !== targetTier.durationMinutes) continue;

      const overlap = this.getTimeOverlap(
        targetTier.dayStartHour, targetTier.dayEndHour,
        other.dayStartHour as number | null, other.dayEndHour as number | null
      );

      if (overlap) {
        // Priority: most restrictive window wins
        const targetRange = this.rangeSize(targetTier.dayStartHour, targetTier.dayEndHour);
        const otherRange = this.rangeSize(other.dayStartHour as number | null, other.dayEndHour as number | null);
        const winner = targetRange <= otherRange ? targetTier.name || 'Nouveau palier' : other.name || 'Palier existant';

        conflicts.push({
          tierId: other.id,
          tierName: other.name || `${other.durationMinutes / 60}h — ${other.price} FCFA`,
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
          priorityWinner: winner
        });
      }
    }

    return conflicts;
  }

  async getAllConflicts(): Promise<{ tier: any; conflicts: ConflictInfo[] }[]> {
    const tiers = await prisma.pricingTier.findMany({ where: { isActive: true } });
    const result = [];

    for (const tier of tiers) {
      const conflicts = await this.detectConflictsFor(tier);
      if (conflicts.length > 0) {
        result.push({ tier, conflicts });
      }
    }

    return result;
  }

  private getTimeOverlap(
    aStart: number | null, aEnd: number | null,
    bStart: number | null, bEnd: number | null
  ): { start: number; end: number } | null {
    // null = all day (0-24)
    const as = aStart ?? 0;
    const ae = aEnd ?? 24;
    const bs = bStart ?? 0;
    const be = bEnd ?? 24;

    // Handle overnight windows (e.g. 22-06 = 22-24 + 00-06)
    const aRanges = as < ae ? [[as, ae]] : [[as, 24], [0, ae]];
    const bRanges = bs < be ? [[bs, be]] : [[bs, 24], [0, be]];

    for (const [as2, ae2] of aRanges) {
      for (const [bs2, be2] of bRanges) {
        const start = Math.max(as2, bs2);
        const end = Math.min(ae2, be2);
        if (start < end) return { start, end };
      }
    }

    return null;
  }

  private rangeSize(start: number | null, end: number | null): number {
    if (start === null || end === null) return 24; // all day = largest
    if (start <= end) return end - start;
    return (24 - start) + end; // overnight
  }

  // ─── Cost calculation ────────────────────────────────────────────────────────

  /**
   * Main billing function for rides without an active subscription.
   * 1. Round duration up to nearest hour
   * 2. Split ride into time segments where different tiers apply
   * 3. Apply greedy algorithm per segment
   * 4. Use fallback rate for any uncovered time
   */
  async calculateRideCost(
    durationMinutes: number,
    startTime: Date,
    _endTime: Date
  ): Promise<CostCalculation> {
    const pricingConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
    const fallbackHourlyRate = pricingConfig?.baseHourlyRate ?? 200;

    const allTiers = await prisma.pricingTier.findMany({ where: { isActive: true } });

    // Round up to nearest hour
    const billedHours = Math.ceil(durationMinutes / 60);

    // Split into segments based on time boundaries
    const segments = this.splitIntoSegments(startTime, billedHours, allTiers);

    let totalCost = 0;
    const breakdown: CostBreakdown[] = [];

    for (const seg of segments) {
      const segResult = this.greedyForSegment(seg.hours, seg.tiers, fallbackHourlyRate);
      totalCost += segResult.cost;
      breakdown.push(...segResult.breakdown);
    }

    return { totalCost, billedHours, breakdown };
  }

  /**
   * Split N hours (starting from startTime) into segments where the same set of tiers applies.
   */
  private splitIntoSegments(
    startTime: Date,
    totalHours: number,
    allTiers: any[]
  ): { hours: number; tiers: any[] }[] {
    const segments: { hours: number; tiers: any[] }[] = [];
    let remaining = totalHours;
    let currentTime = new Date(startTime);

    while (remaining > 0) {
      const currentHour = currentTime.getHours();

      // Find applicable tiers for this hour
      const applicableTiers = allTiers.filter(t => this.tierAppliesAtHour(t, currentHour));

      // Find how many consecutive hours have the same tier set
      let consecutiveHours = 1;
      while (consecutiveHours < remaining) {
        const nextHour = (currentHour + consecutiveHours) % 24;
        const nextTiers = allTiers.filter(t => this.tierAppliesAtHour(t, nextHour));
        if (!this.sameTierSet(applicableTiers, nextTiers)) break;
        consecutiveHours++;
      }

      const segHours = Math.min(consecutiveHours, remaining);
      segments.push({ hours: segHours, tiers: applicableTiers });

      remaining -= segHours;
      currentTime = new Date(currentTime.getTime() + segHours * 3600000);
    }

    return segments;
  }

  private tierAppliesAtHour(tier: any, hour: number): boolean {
    if (tier.dayStartHour === null || tier.dayEndHour === null) return true;

    const start = tier.dayStartHour;
    const end = tier.dayEndHour;

    if (start <= end) {
      return hour >= start && hour < end;
    } else {
      // Overnight: e.g. 22h-06h
      return hour >= start || hour < end;
    }
  }

  private sameTierSet(a: any[], b: any[]): boolean {
    if (a.length !== b.length) return false;
    const aIds = new Set(a.map(t => t.id));
    return b.every(t => aIds.has(t.id));
  }

  /**
   * Greedy algorithm: cover N hours using available tiers, largest-first.
   * Remainder covered by fallback rate.
   */
  private greedyForSegment(
    hours: number,
    tiers: any[],
    fallbackHourlyRate: number
  ): { cost: number; breakdown: CostBreakdown[] } {
    let remaining = hours;
    let cost = 0;
    const breakdown: CostBreakdown[] = [];

    // Sort tiers by durationMinutes descending (largest first), only whole-hour tiers
    const sortedTiers = [...tiers]
      .filter(t => t.durationMinutes % 60 === 0) // whole hours only
      .sort((a, b) => b.durationMinutes - a.durationMinutes);

    while (remaining > 0) {
      const eligible = sortedTiers.filter(t => t.durationMinutes / 60 <= remaining);

      if (eligible.length === 0) {
        // Fallback for remaining hours
        const fallbackCost = remaining * fallbackHourlyRate;
        cost += fallbackCost;
        breakdown.push({
          type: 'fallback',
          label: `Tarif de base (${remaining}h)`,
          hours: remaining,
          unitPrice: fallbackHourlyRate,
          cost: fallbackCost
        });
        remaining = 0;
      } else {
        const best = eligible[0]; // largest that fits
        const tierHours = best.durationMinutes / 60;
        cost += best.price;
        breakdown.push({
          type: 'tier',
          label: best.name || `${tierHours}h`,
          hours: tierHours,
          unitPrice: best.price / tierHours,
          cost: best.price
        });
        remaining -= tierHours;
      }
    }

    return { cost, breakdown };
  }

  // ─── Display price (for BikeMap/BikeDetail) ───────────────────────────────

  /**
   * Returns the entry price to display: the cheapest active tier for the current hour
   * (smallest duration that applies now), or fallback if no tier.
   */
  async getDisplayPrice(): Promise<{ price: number; durationHours: number; isNight: boolean; fallback: boolean }> {
    const currentHour = new Date().getHours();
    const pricingConfig = await prisma.pricingConfig.findFirst({ where: { isActive: true } });
    const fallbackHourlyRate = pricingConfig?.baseHourlyRate ?? 200;

    const activeTiers = await prisma.pricingTier.findMany({ where: { isActive: true } });
    const applicable = activeTiers.filter(t => this.tierAppliesAtHour(t, currentHour));

    if (applicable.length === 0) {
      return { price: fallbackHourlyRate, durationHours: 1, isNight: false, fallback: true };
    }

    // Smallest duration tier = entry price
    const smallest = applicable.reduce((a, b) => a.durationMinutes < b.durationMinutes ? a : b);

    // Is it a night-specific tier?
    const isNight = smallest.dayStartHour !== null && smallest.dayEndHour !== null;

    return {
      price: smallest.price,
      durationHours: smallest.durationMinutes / 60,
      isNight,
      fallback: false
    };
  }
}

export default new PricingTierService();
