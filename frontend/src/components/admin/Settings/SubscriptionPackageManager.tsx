import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Check, ChevronDown, ChevronUp, Clock, Eye, EyeOff, AlertTriangle, Moon, Sun, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../../ui/dialog';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Textarea } from '../../ui/textarea';
import { toast } from 'sonner';
import { useTranslation } from '../../../lib/i18n';
import { adminService, PricingTier, PricingTierConflict } from '../../../services/api/admin.service';
import { companyService, PricingPlan, PricingRule, PricingConfig as PricingConfigType } from '../../../services/api/company.service';
import { usePermissions } from '../../../hooks/usePermissions';

export function SubscriptionPackageManager() {
  const { t, language } = useTranslation();
  const { can } = usePermissions();
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [isAddingPackage, setIsAddingPackage] = useState(false);
  const [isEditingPackage, setIsEditingPackage] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<any>(null);
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);
  
  // Formula states
  const [isAddingFormula, setIsAddingFormula] = useState(false);
  const [isEditingFormula, setIsEditingFormula] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<any>(null);
  
  // Promotion states
  const [isAddingPromotion, setIsAddingPromotion] = useState(false);
  const [isEditingPromotion, setIsEditingPromotion] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [promotions, setPromotions] = useState<any[]>([]);
  
  // Free Days Rules states
  const [freeDaysRules, setFreeDaysRules] = useState<any[]>([]);
  const [isLoadingFreeDaysRules, setIsLoadingFreeDaysRules] = useState(true);
  const [isAddingFreeDaysRule, setIsAddingFreeDaysRule] = useState(false);
  const [isEditingFreeDaysRule, setIsEditingFreeDaysRule] = useState(false);
  const [selectedFreeDaysRule, setSelectedFreeDaysRule] = useState<any>(null);
  const [expandedFreeDaysRuleId, setExpandedFreeDaysRuleId] = useState<string | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // PricingConfig states (plans, rules, hourly rate)
  const [pricingConfig, setPricingConfig] = useState<PricingConfigType | null>(null);
  const [isLoadingPricing, setIsLoadingPricing] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);
  const [selectedRule, setSelectedRule] = useState<PricingRule | null>(null);
  const [isEditingPlan, setIsEditingPlan] = useState(false);
  const [isAddingNewPlan, setIsAddingNewPlan] = useState(false);
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [isAddingNewRule, setIsAddingNewRule] = useState(false);
  const [isDeletingPlan, setIsDeletingPlan] = useState<string | null>(null);
  const [isDeletingRule, setIsDeletingRule] = useState<string | null>(null);
  const [editedHourlyPricing, setEditedHourlyPricing] = useState({ unlockFee: 0, baseHourlyRate: 0 });
  const [editedPlan, setEditedPlan] = useState({
    name: '',
    hourlyRate: 0,
    dailyRate: 0,
    weeklyRate: 0,
    monthlyRate: 0,
    minimumHours: 1,
    discount: 0,
    isActive: true,
    conditions: [] as string[],
    hasOverride: false,
    overTimeType: 'PERCENTAGE_REDUCTION' as 'FIXED_PRICE' | 'PERCENTAGE_REDUCTION',
    overTimeValue: 0,
    hourlyStartHour: null as number | null,
    hourlyEndHour: null as number | null,
    dailyStartHour: null as number | null,
    dailyEndHour: null as number | null,
    weeklyStartHour: null as number | null,
    weeklyEndHour: null as number | null,
    monthlyStartHour: null as number | null,
    monthlyEndHour: null as number | null
  });
  const [editedRule, setEditedRule] = useState({
    name: '',
    dayOfWeek: null as number | null,
    startHour: null as number | null,
    endHour: null as number | null,
    multiplier: 1,
    isActive: true,
    priority: 0
  });
  const [pricingFormErrors, setPricingFormErrors] = useState<{ planName?: string; multiplier?: string }>({});
  const [isEditingHourlyPricing, setIsEditingHourlyPricing] = useState(false);

  // PricingTier states
  const [pricingTiers, setPricingTiers] = useState<PricingTier[]>([]);
  const [tierConflicts, setTierConflicts] = useState<{ tier: PricingTier; conflicts: PricingTierConflict[] }[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(true);
  const [isAddingTier, setIsAddingTier] = useState(false);
  const [isEditingTier, setIsEditingTier] = useState(false);
  const [selectedTier, setSelectedTier] = useState<PricingTier | null>(null);
  const [tierForm, setTierForm] = useState({
    name: '',
    durationMinutes: 60,
    price: 0,
    hasTimeWindow: false,
    dayStartHour: 22,
    dayEndHour: 6,
    isActive: true
  });

  // Confirmation states
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'package' | 'formula' | 'promotion'; id: string; name: string } | null>(null);

  // Form states
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: ''
  });

  const [formulaForm, setFormulaForm] = useState({
    name: '',
    description: '',
    formulaType: 'TIME_WINDOW',
    numberOfDays: 1,
    price: 0,
    dayStartHour: 0,
    dayEndHour: 23,
    chargeAfterHours: false,
    afterHoursPrice: 0,
    afterHoursType: 'FIXED_PRICE',
    maxRideDurationHours: 1
  });

  const [promotionForm, setPromotionForm] = useState({
    name: '',
    description: '',
    discountType: 'PERCENTAGE',
    discountValue: 0,
    startDate: '',
    endDate: '',
    usageLimit: null as number | null,
    packageIds: [] as string[],
    formulaIds: [] as string[]
  });

  // Free Days Rule form state
  const [freeDaysRuleForm, setFreeDaysRuleForm] = useState({
    name: '',
    description: '',
    numberOfDays: 1,
    targetType: 'NEW_USERS',
    targetDaysSinceRegistration: undefined as number | undefined,
    targetMinSpend: undefined as number | undefined,
    startHour: undefined as number | undefined,
    endHour: undefined as number | undefined,
    validFrom: '',
    validUntil: '',
    maxBeneficiaries: undefined as number | undefined
  });

  useEffect(() => {
    loadPackages();
    loadPromotions();
    loadFreeDaysRules();
    loadPricing();
    loadPricingTiers();
  }, []);

  const loadPackages = async () => {
    try {
      setIsLoadingPackages(true);
      const data = await adminService.getSubscriptionPackages();
      setPackages(data || []);
    } catch (error: any) {
      console.error('loadPackages error', error);
      toast.error(error?.message || 'Erreur lors du chargement des forfaits');
    } finally {
      setIsLoadingPackages(false);
    }
  };

  const loadPromotions = async () => {
    try {
      const data = await adminService.getPromotions();
      setPromotions(data || []);
    } catch (error: any) {
      console.error('loadPromotions error', error);
    }
  };

  const loadFreeDaysRules = async () => {
    try {
      setIsLoadingFreeDaysRules(true);
      const data = await adminService.getFreeDaysRules();
      setFreeDaysRules(data || []);
    } catch (error: any) {
      console.error('loadFreeDaysRules error', error);
      toast.error(error?.message || 'Erreur lors du chargement des règles');
    } finally {
      setIsLoadingFreeDaysRules(false);
    }
  };

  const handleSavePackage = async () => {
    if (!packageForm.name.trim()) {
      toast.error('Le nom du forfait est requis');
      return;
    }

    try {
      if (isEditingPackage && selectedPackage) {
        // UPDATE
        await adminService.updateSubscriptionPackage(selectedPackage.id, packageForm);
        toast.success('Forfait mis à jour');
      } else {
        // CREATE
        await adminService.createSubscriptionPackage(packageForm);
        toast.success('Forfait créé');
      }
      await loadPackages();
      setIsAddingPackage(false);
      setIsEditingPackage(false);
      setPackageForm({ name: '', description: '' });
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeletePackage = async (packageId: string, packageName: string) => {
    setDeleteConfirm({ type: 'package', id: packageId, name: packageName });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    
    try {
      if (deleteConfirm.type === 'package') {
        await adminService.deleteSubscriptionPackage(deleteConfirm.id);
        toast.success('Forfait supprimé');
        await loadPackages();
      } else if (deleteConfirm.type === 'formula') {
        await adminService.deleteSubscriptionFormula(deleteConfirm.id);
        toast.success('Formule supprimée');
        await loadPackages();
      } else if (deleteConfirm.type === 'promotion') {
        await adminService.deletePromotion(deleteConfirm.id);
        toast.success('Promotion supprimée');
        await loadPromotions();
      }
      setDeleteConfirm(null);
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleSavePromotion = async () => {
    if (!promotionForm.name.trim() || !selectedPackage) {
      toast.error('Le nom et le forfait sont requis');
      return;
    }

    try {
      const payload = {
        ...promotionForm,
        packageIds: [selectedPackage.id],
        discountValue: parseFloat(String(promotionForm.discountValue)) || 0,
        usageLimit: promotionForm.usageLimit ? parseInt(String(promotionForm.usageLimit)) : null
      };

      if (isEditingPromotion && selectedPromotion) {
        await adminService.updatePromotion(selectedPromotion.id, payload);
        toast.success('Promotion mise à jour');
      } else {
        await adminService.createPromotion(payload);
        toast.success('Promotion créée');
      }
      await loadPromotions();
      await loadPackages();
      setIsAddingPromotion(false);
      setIsEditingPromotion(false);
      setSelectedPromotion(null);
      setPromotionForm({
        name: '',
        description: '',
        discountType: 'PERCENTAGE',
        discountValue: 0,
        startDate: '',
        endDate: '',
        usageLimit: null,
        packageIds: [],
        formulaIds: []
      });
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeletePromotion = async (promotionId: string, promotionName: string) => {
    setDeleteConfirm({ type: 'promotion', id: promotionId, name: promotionName });
  };

  const handleSaveFormula = async () => {
    if (!formulaForm.name.trim() || !selectedPackage) {
      toast.error('Le nom et le forfait sont requis');
      return;
    }

    try {
      if (isEditingFormula && selectedFormula) {
        // UPDATE
        await adminService.updateSubscriptionFormula(selectedFormula.id, { ...formulaForm });
        toast.success('Formule mise à jour');
      } else {
        // CREATE
        await adminService.createSubscriptionFormula({
          ...formulaForm,
          packageId: selectedPackage.id
        });
        toast.success('Formule créée');
      }
      await loadPackages();
      setIsAddingFormula(false);
      setIsEditingFormula(false);
      setSelectedFormula(null);
      setFormulaForm({
        name: '',
        description: '',
        formulaType: 'TIME_WINDOW',
        numberOfDays: 1,
        price: 0,
        dayStartHour: 0,
        dayEndHour: 23,
        chargeAfterHours: false,
        afterHoursPrice: 0,
        afterHoursType: 'FIXED_PRICE',
        maxRideDurationHours: 1
      });
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteFormula = async (formulaId: string, formulaName: string) => {
    setDeleteConfirm({ type: 'formula', id: formulaId, name: formulaName });
  };

  // Free Days Rules handlers
  const handleSaveFreeDaysRule = async () => {
    if (!freeDaysRuleForm.name.trim() || !freeDaysRuleForm.numberOfDays) {
      toast.error('Le nom et le nombre de jours sont requis');
      return;
    }

    try {
      const payload = {
        ...freeDaysRuleForm,
        numberOfDays: parseInt(String(freeDaysRuleForm.numberOfDays)),
        targetDaysSinceRegistration: freeDaysRuleForm.targetDaysSinceRegistration ? parseInt(String(freeDaysRuleForm.targetDaysSinceRegistration)) : undefined,
        targetMinSpend: freeDaysRuleForm.targetMinSpend ? parseFloat(String(freeDaysRuleForm.targetMinSpend)) : undefined,
        maxBeneficiaries: freeDaysRuleForm.maxBeneficiaries ? parseInt(String(freeDaysRuleForm.maxBeneficiaries)) : undefined,
        validFrom: freeDaysRuleForm.validFrom || undefined,
        validUntil: freeDaysRuleForm.validUntil || undefined
      };

      if (isEditingFreeDaysRule && selectedFreeDaysRule) {
        await adminService.updateFreeDaysRule(selectedFreeDaysRule.id, payload);
        toast.success('Règle mise à jour');
      } else {
        await adminService.createFreeDaysRule(payload);
        toast.success('Règle créée');
      }
      await loadFreeDaysRules();
      setIsAddingFreeDaysRule(false);
      setIsEditingFreeDaysRule(false);
      setSelectedFreeDaysRule(null);
      setFreeDaysRuleForm({
        name: '',
        description: '',
        numberOfDays: 1,
        startType: 'ON_USE',
        targetType: 'NEW_USERS',
        targetDaysSinceRegistration: undefined,
        targetMinSpend: undefined,
        startHour: undefined,
        endHour: undefined,
        validFrom: '',
        validUntil: '',
        maxBeneficiaries: undefined
      });
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteFreeDaysRule = async (ruleId: string, ruleName: string) => {
    try {
      await adminService.deleteFreeDaysRule(ruleId);
      toast.success('Règle supprimée');
      await loadFreeDaysRules();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression');
    }
  };

  const handleSearchUsers = async (query: string) => {
    setUserSearchQuery(query);
    if (query.length < 2) {
      setUserSearchResults([]);
      return;
    }
    try {
      const results = await adminService.searchFreeDaysUsers(query);
      setUserSearchResults(results || []);
    } catch (error: any) {
      console.error('User search error', error);
    }
  };

  const handleAddBeneficiary = async (ruleId: string, userId: string) => {
    try {
      await adminService.addFreeDaysBeneficiary(ruleId, userId);
      toast.success('Bénéficiaire ajouté');
      setUserSearchResults([]);
      setUserSearchQuery('');
      // Refresh the expanded rule's beneficiaries
      const detailed = await adminService.getFreeDaysRuleById(ruleId);
      setFreeDaysRules(prev => prev.map(r => r.id === ruleId ? { ...r, beneficiaries: detailed.beneficiaries } : r));
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de l\'ajout du bénéficiaire');
    }
  };

  const handleRemoveBeneficiary = async (ruleId: string, userId: string) => {
    try {
      await adminService.removeFreeDaysBeneficiary(ruleId, userId);
      toast.success('Bénéficiaire supprimé');
      // Refresh the expanded rule's beneficiaries
      const detailed = await adminService.getFreeDaysRuleById(ruleId);
      setFreeDaysRules(prev => prev.map(r => r.id === ruleId ? { ...r, beneficiaries: detailed.beneficiaries } : r));
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression du bénéficiaire');
    }
  };

  const handleExpandFreeDaysRule = async (ruleId: string) => {
    if (expandedFreeDaysRuleId === ruleId) {
      setExpandedFreeDaysRuleId(null);
      return;
    }
    setExpandedFreeDaysRuleId(ruleId);
    try {
      const detailed = await adminService.getFreeDaysRuleById(ruleId);
      setFreeDaysRules(prev => prev.map(r => r.id === ruleId ? { ...r, beneficiaries: detailed.beneficiaries } : r));
    } catch {
      // silently ignore — beneficiaries list stays empty
    }
  };

  // ── PricingConfig handlers ──────────────────────────────────────────────

  const loadPricing = async () => {
    try {
      setIsLoadingPricing(true);
      const data = await companyService.getPricing();
      setPricingConfig(data);
      setEditedHourlyPricing({ unlockFee: data.unlockFee || 0, baseHourlyRate: data.baseHourlyRate || 0 });
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors du chargement de la tarification');
    } finally {
      setIsLoadingPricing(false);
    }
  };

  const handleSaveHourlyPricing = async () => {
    try {
      await companyService.updatePricing({ ...pricingConfig, unlockFee: editedHourlyPricing.unlockFee, baseHourlyRate: editedHourlyPricing.baseHourlyRate });
      const data = await companyService.getPricing();
      setPricingConfig(data);
      toast.success(language === 'fr' ? 'Tarification à l\'heure mise à jour' : 'Hourly pricing updated');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la mise à jour');
    }
  };

  const handleAddNewPlan = () => {
    setEditedPlan({ name: '', hourlyRate: 0, dailyRate: 0, weeklyRate: 0, monthlyRate: 0, minimumHours: 1, discount: 0, isActive: true, conditions: [], hasOverride: false, overTimeType: 'PERCENTAGE_REDUCTION', overTimeValue: 0, hourlyStartHour: null, hourlyEndHour: null, dailyStartHour: null, dailyEndHour: null, weeklyStartHour: null, weeklyEndHour: null, monthlyStartHour: null, monthlyEndHour: null });
    setPricingFormErrors({});
    setIsAddingNewPlan(true);
  };

  const handleEditPlan = (plan: PricingPlan) => {
    setSelectedPlan(plan);
    const override = plan.override;
    setEditedPlan({
      name: plan.name, hourlyRate: plan.hourlyRate, dailyRate: plan.dailyRate, weeklyRate: plan.weeklyRate, monthlyRate: plan.monthlyRate, minimumHours: plan.minimumHours, discount: plan.discount, isActive: plan.isActive, conditions: plan.conditions || [],
      hasOverride: !!override, overTimeType: override?.overTimeType || 'PERCENTAGE_REDUCTION', overTimeValue: override?.overTimeValue || 0,
      hourlyStartHour: override?.hourlyStartHour ?? null, hourlyEndHour: override?.hourlyEndHour ?? null,
      dailyStartHour: override?.dailyStartHour ?? null, dailyEndHour: override?.dailyEndHour ?? null,
      weeklyStartHour: override?.weeklyStartHour ?? null, weeklyEndHour: override?.weeklyEndHour ?? null,
      monthlyStartHour: override?.monthlyStartHour ?? null, monthlyEndHour: override?.monthlyEndHour ?? null
    });
    setPricingFormErrors({});
    setIsEditingPlan(true);
  };

  const handleSavePlan = async () => {
    if (!editedPlan.name.trim()) { setPricingFormErrors({ planName: 'Le nom est requis' }); return; }
    setPricingFormErrors({});
    const planData = { name: editedPlan.name, hourlyRate: editedPlan.hourlyRate, dailyRate: editedPlan.dailyRate, weeklyRate: editedPlan.weeklyRate, monthlyRate: editedPlan.monthlyRate, minimumHours: editedPlan.minimumHours, discount: editedPlan.discount, isActive: editedPlan.isActive, conditions: editedPlan.conditions };
    try {
      let planId: string | undefined;
      if (isAddingNewPlan) {
        const res = await companyService.createPlan(planData);
        planId = res.data.id;
        toast.success(`Plan "${editedPlan.name}" créé`);
      } else {
        const updatedPlans = (pricingConfig?.plans || []).map(p => p.id === selectedPlan?.id ? { ...p, ...planData, id: selectedPlan!.id } : p);
        await companyService.updatePricing({ ...pricingConfig, plans: updatedPlans });
        planId = selectedPlan?.id;
        toast.success(`Plan "${editedPlan.name}" mis à jour`);
      }
      if (planId) {
        if (editedPlan.hasOverride && editedPlan.overTimeValue > 0) {
          try {
            await companyService.createPlanOverride(planId, editedPlan.overTimeType, editedPlan.overTimeValue, { hourlyStartHour: editedPlan.hourlyStartHour, hourlyEndHour: editedPlan.hourlyEndHour, dailyStartHour: editedPlan.dailyStartHour, dailyEndHour: editedPlan.dailyEndHour, weeklyStartHour: editedPlan.weeklyStartHour, weeklyEndHour: editedPlan.weeklyEndHour, monthlyStartHour: editedPlan.monthlyStartHour, monthlyEndHour: editedPlan.monthlyEndHour });
          } catch { toast.error('Erreur lors de la configuration overtime'); }
        } else {
          try { await companyService.deletePlanOverride(planId); } catch {}
        }
      }
      await loadPricing();
      setIsEditingPlan(false); setIsAddingNewPlan(false); setSelectedPlan(null);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la sauvegarde du plan');
    }
  };

  const handleDeletePlan = async (planId: string) => {
    try {
      await companyService.deletePlan(planId);
      await loadPricing();
      setIsDeletingPlan(null);
      toast.success('Plan supprimé');
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression du plan');
    }
  };

  const handleTogglePlanStatus = async (plan: PricingPlan) => {
    try {
      const updatedPlans = (pricingConfig?.plans || []).map(p => p.id === plan.id ? { ...p, isActive: !p.isActive } : p);
      await companyService.updatePricing({ ...pricingConfig, plans: updatedPlans });
      await loadPricing();
      toast.success(`Plan ${!plan.isActive ? 'activé' : 'désactivé'}`);
    } catch (error: any) { toast.error(error?.message || 'Erreur'); }
  };

  const handleAddNewRule = () => {
    setEditedRule({ name: '', dayOfWeek: null, startHour: null, endHour: null, multiplier: 1, isActive: true, priority: 0 });
    setPricingFormErrors({});
    setIsAddingNewRule(true);
  };

  const handleEditRule = (rule: PricingRule) => {
    setSelectedRule(rule);
    setEditedRule({ name: rule.name, dayOfWeek: rule.dayOfWeek ?? null, startHour: rule.startHour ?? null, endHour: rule.endHour ?? null, multiplier: rule.multiplier, isActive: rule.isActive, priority: rule.priority });
    setPricingFormErrors({});
    setIsEditingRule(true);
  };

  const handleSaveRule = async () => {
    if (!editedRule.name.trim()) { setPricingFormErrors({ planName: 'Le nom est requis' }); return; }
    if (editedRule.multiplier <= 0) { setPricingFormErrors({ multiplier: 'Le multiplicateur doit être > 0' }); return; }
    setPricingFormErrors({});
    try {
      const updatedRules = (isAddingNewRule
        ? [...(pricingConfig?.rules || []), { ...editedRule, id: Date.now().toString(), dayOfWeek: editedRule.dayOfWeek ?? undefined, startHour: editedRule.startHour ?? undefined, endHour: editedRule.endHour ?? undefined }]
        : (pricingConfig?.rules || []).map(r => r.id === selectedRule?.id ? { ...editedRule, id: selectedRule!.id, dayOfWeek: editedRule.dayOfWeek ?? undefined, startHour: editedRule.startHour ?? undefined, endHour: editedRule.endHour ?? undefined } : r)
      ) as PricingRule[];
      await companyService.updatePricing({ ...pricingConfig, rules: updatedRules });
      await loadPricing();
      toast.success(isAddingNewRule ? `Règle "${editedRule.name}" créée` : `Règle "${editedRule.name}" mise à jour`);
      setIsEditingRule(false); setIsAddingNewRule(false); setSelectedRule(null);
    } catch (error: any) { toast.error(error?.message || 'Erreur lors de la sauvegarde'); }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await companyService.deleteRule(ruleId);
      await loadPricing();
      setIsDeletingRule(null);
      toast.success('Règle supprimée');
    } catch (error: any) { toast.error(error?.message || 'Erreur lors de la suppression'); }
  };

  const handleToggleRuleStatus = async (rule: PricingRule) => {
    try {
      const updatedRules = (pricingConfig?.rules || []).map(r => r.id === rule.id ? { ...r, isActive: !r.isActive } : r);
      await companyService.updatePricing({ ...pricingConfig, rules: updatedRules });
      await loadPricing();
      toast.success(`Règle ${!rule.isActive ? 'activée' : 'désactivée'}`);
    } catch (error: any) { toast.error(error?.message || 'Erreur'); }
  };

  // ── PricingTier handlers ────────────────────────────────────────────────

  const loadPricingTiers = async () => {
    try {
      setIsLoadingTiers(true);
      const tiers = await adminService.getPricingTiers();
      setPricingTiers(tiers);
      const conflicts = await adminService.getPricingTierConflicts();
      setTierConflicts(conflicts);
    } catch (error: any) {
      console.error('loadPricingTiers error', error);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const openAddTierDialog = () => {
    setTierForm({ name: '', durationMinutes: 60, price: 0, hasTimeWindow: false, dayStartHour: 22, dayEndHour: 6, isActive: true });
    setSelectedTier(null);
    setIsAddingTier(true);
  };

  const openEditTierDialog = (tier: PricingTier) => {
    setTierForm({
      name: tier.name || '',
      durationMinutes: tier.durationMinutes,
      price: tier.price,
      hasTimeWindow: tier.dayStartHour != null,
      dayStartHour: tier.dayStartHour ?? 22,
      dayEndHour: tier.dayEndHour ?? 6,
      isActive: tier.isActive
    });
    setSelectedTier(tier);
    setIsEditingTier(true);
  };

  const handleSaveTier = async () => {
    if (!tierForm.durationMinutes || tierForm.price <= 0) {
      toast.error('Durée et prix sont requis (prix > 0)');
      return;
    }
    try {
      const data = {
        name: tierForm.name || undefined,
        durationMinutes: tierForm.durationMinutes,
        price: tierForm.price,
        dayStartHour: tierForm.hasTimeWindow ? tierForm.dayStartHour : null,
        dayEndHour: tierForm.hasTimeWindow ? tierForm.dayEndHour : null,
        isActive: tierForm.isActive
      };
      const result = isEditingTier && selectedTier
        ? await adminService.updatePricingTier(selectedTier.id, data)
        : await adminService.createPricingTier(data as any);

      if (result.conflicts.length > 0) {
        toast.warning(`Palier sauvegardé avec ${result.conflicts.length} conflit(s) détecté(s)`);
      } else {
        toast.success(isEditingTier ? 'Palier mis à jour' : 'Palier créé');
      }
      await loadPricingTiers();
      setIsAddingTier(false);
      setIsEditingTier(false);
      setSelectedTier(null);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!confirm('Supprimer ce palier ?')) return;
    try {
      await adminService.deletePricingTier(id);
      toast.success('Palier supprimé');
      await loadPricingTiers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur lors de la suppression');
    }
  };

  const handleToggleTierActive = async (id: string) => {
    try {
      await adminService.togglePricingTierActive(id);
      await loadPricingTiers();
    } catch (error: any) {
      toast.error(error?.message || 'Erreur');
    }
  };

  const handleSaveFallbackRate = async () => {
    try {
      await adminService.updateFallbackRate(editedHourlyPricing.baseHourlyRate);
      toast.success('Tarif de secours mis à jour');
      setIsEditingHourlyPricing(false);
    } catch (error: any) {
      toast.error(error?.message || 'Erreur');
    }
  };

  const formatHour = (h: number) => `${h.toString().padStart(2, '0')}h`;

  const daysOfWeek = [
    { value: null, label: language === 'fr' ? 'Tous les jours' : 'All days' },
    { value: 0, label: language === 'fr' ? 'Dimanche' : 'Sunday' },
    { value: 1, label: language === 'fr' ? 'Lundi' : 'Monday' },
    { value: 2, label: language === 'fr' ? 'Mardi' : 'Tuesday' },
    { value: 3, label: language === 'fr' ? 'Mercredi' : 'Wednesday' },
    { value: 4, label: language === 'fr' ? 'Jeudi' : 'Thursday' },
    { value: 5, label: language === 'fr' ? 'Vendredi' : 'Friday' },
    { value: 6, label: language === 'fr' ? 'Samedi' : 'Saturday' },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {language === 'fr' ? 'Gestion des Forfaits' : 'Subscription Plans Management'}
        </h2>
        <p className="text-gray-600">
          {language === 'fr' 
            ? 'Créez et gérez les forfaits d\'abonnement, les formules et les promotions.'
            : 'Create and manage subscription packages, formulas, and promotions.'}
        </p>
      </div>

      {/* Tarification sans forfait */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{language === 'fr' ? 'Tarification sans forfait' : 'Pay-as-you-go Pricing'}</h2>
            <p className="text-sm text-gray-600">
              {language === 'fr'
                ? 'Paliers tarifaires appliqués à la fin de chaque trajet (algorithme glouton). Le tarif de secours est appliqué si aucun palier ne correspond.'
                : 'Pricing tiers applied at ride end (greedy algorithm). Fallback rate is used when no tier matches.'}
            </p>
          </div>
          {can.createPricing() && (
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={openAddTierDialog}>
              <Plus className="w-4 h-4 mr-2" />{language === 'fr' ? 'Nouveau palier' : 'New tier'}
            </Button>
          )}
        </div>

        {/* Fallback rate */}
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-900">{language === 'fr' ? 'Tarif de secours' : 'Fallback rate'}</p>
              <p className="text-sm text-amber-700">{language === 'fr' ? 'Appliqué par heure non couverte par un palier' : 'Applied per hour not covered by any tier'}</p>
            </div>
            {isEditingHourlyPricing ? (
              <div className="flex items-center gap-2">
                <Input type="number" min="0" className="w-28"
                  value={editedHourlyPricing.baseHourlyRate}
                  onChange={(e) => setEditedHourlyPricing({ ...editedHourlyPricing, baseHourlyRate: parseFloat(e.target.value) || 0 })} />
                <span className="text-sm text-amber-700">FCFA/h</span>
                <Button size="sm" variant="outline" onClick={() => setIsEditingHourlyPricing(false)}><X className="w-4 h-4" /></Button>
                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" onClick={handleSaveFallbackRate}><Check className="w-4 h-4" /></Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-900">{pricingConfig?.baseHourlyRate ?? editedHourlyPricing.baseHourlyRate} <span className="text-sm font-normal">FCFA/h</span></span>
                {can.updatePricing() && (
                  <Button size="sm" variant="outline" onClick={() => setIsEditingHourlyPricing(true)}><Edit className="w-4 h-4" /></Button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Conflict warnings */}
        {tierConflicts.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-300 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <span className="font-medium text-yellow-800">{language === 'fr' ? `${tierConflicts.length} conflit(s) détecté(s)` : `${tierConflicts.length} conflict(s) detected`}</span>
            </div>
            {tierConflicts.map(({ tier, conflicts }) => (
              <div key={tier.id} className="text-sm text-yellow-700 ml-6">
                {conflicts.map(c => (
                  <div key={c.tierId}>
                    {tier.name || `${tier.durationMinutes / 60}h`} ↔ {c.tierName} : chevauchement {formatHour(c.overlapStart)}–{formatHour(c.overlapEnd)} → <strong>{c.priorityWinner}</strong> prioritaire
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* Tiers list */}
        {isLoadingTiers ? (
          <p className="text-gray-500 text-sm">{language === 'fr' ? 'Chargement...' : 'Loading...'}</p>
        ) : pricingTiers.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-6">
            {language === 'fr' ? 'Aucun palier configuré. Ajoutez un palier pour commencer.' : 'No tiers configured. Add a tier to get started.'}
          </p>
        ) : (
          <div className="space-y-2">
            {pricingTiers.map(tier => (
              <div key={tier.id} className={`flex items-center justify-between p-3 rounded-lg border ${tier.isActive ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 opacity-60'}`}>
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {tier.name || `${tier.durationMinutes / 60}h`}
                      </span>
                      {tier.dayStartHour != null && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                          <Moon className="w-3 h-3" />{formatHour(tier.dayStartHour!)} – {formatHour(tier.dayEndHour!)}
                        </span>
                      )}
                      {!tier.isActive && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">{language === 'fr' ? 'Inactif' : 'Inactive'}</span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {tier.durationMinutes / 60}h — <strong className="text-gray-700">{tier.price} FCFA</strong>
                      <span className="ml-2 text-xs text-gray-400">({Math.round(tier.price / (tier.durationMinutes / 60))} FCFA/h)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {can.updatePricing() && (
                    <Button size="sm" variant="ghost" title={tier.isActive ? 'Désactiver' : 'Activer'} onClick={() => handleToggleTierActive(tier.id)}>
                      {tier.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                    </Button>
                  )}
                  {can.updatePricing() && (
                    <Button size="sm" variant="ghost" onClick={() => openEditTierDialog(tier)}><Edit className="w-4 h-4" /></Button>
                  )}
                  {can.deletePricing() && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700" onClick={() => handleDeleteTier(tier.id)}><Trash2 className="w-4 h-4" /></Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add Package Button */}
      <div className="flex justify-end gap-2">
        {can.createPricing() && (
          <Button
            onClick={() => {
              setIsAddingPackage(true);
              setPackageForm({ name: '', description: '' });
            }}
            className="flex items-center gap-2 bg-green-600 text-white hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            {language === 'fr' ? 'Nouveau Forfait' : 'New Package'}
          </Button>
        )}
        {can.manageFreeDays() && (
          <Button
            onClick={() => {
              setIsAddingFreeDaysRule(true);
              setFreeDaysRuleForm({
                name: '',
                description: '',
                numberOfDays: 1,
                startType: 'ON_USE',
                targetType: 'NEW_USERS',
                targetDaysSinceRegistration: undefined,
                targetMinSpend: undefined,
                applyAfterSubscription: false,
                validFrom: '',
                validUntil: '',
                maxBeneficiaries: undefined
              });
            }}
            className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            {language === 'fr' ? 'Nouvelle Règle de Jours Gratuits' : 'New Free Days Rule'}
          </Button>
        )}
      </div>

      {/* Packages List */}
      <div className="space-y-4">
        {packages.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            {language === 'fr' ? 'Aucun forfait créé' : 'No packages created'}
          </Card>
        ) : (
          packages.map(pkg => (
            <Card key={pkg.id} className="overflow-hidden">
              {/* Package Header */}
              <div 
                className="p-6 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() => setExpandedPackageId(expandedPackageId === pkg.id ? null : pkg.id)}
              >
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                  {pkg.description && (
                    <p className="text-sm text-gray-600 mt-1">{pkg.description}</p>
                  )}
                  <div className="mt-2 text-xs text-gray-500">
                    {language === 'fr' ? 'Formules: ' : 'Formulas: '} {pkg.formulas?.length || 0}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {can.updatePricing() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: { stopPropagation: () => void; }) => {
                        e.stopPropagation();
                        setSelectedPackage(pkg);
                        setPackageForm({ name: pkg.name, description: pkg.description });
                        setIsEditingPackage(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  )}
                  {can.deletePricing() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e: { stopPropagation: () => void; }) => {
                        e.stopPropagation();
                        handleDeletePackage(pkg.id, pkg.name);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-red-600" />
                    </Button>
                  )}
                  {expandedPackageId === pkg.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Package Details */}
              {expandedPackageId === pkg.id && (
                <div className="border-t p-6 bg-gray-50">
                  {/* Formulas */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">
                        {language === 'fr' ? 'Formules' : 'Formulas'}
                      </h4>
                      {can.createPricing() && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setIsAddingFormula(true);
                            setSelectedFormula(null);
                            setFormulaForm({
                              name: '',
                              description: '',
                              formulaType: 'TIME_WINDOW',
                              numberOfDays: 1,
                              price: 0,
                              dayStartHour: 0,
                              dayEndHour: 23,
                              chargeAfterHours: false,
                              afterHoursPrice: 0,
                              afterHoursType: 'FIXED_PRICE',
                              maxRideDurationHours: 1
                            });
                          }}
                          className="flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          {language === 'fr' ? 'Ajouter' : 'Add'}
                        </Button>
                      )}
                    </div>

                    {pkg.formulas && pkg.formulas.length > 0 ? (
                      <div className="space-y-2">
                        {pkg.formulas.map((formula: any) => (
                          <div key={formula.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h5 className="font-semibold text-gray-900">{formula.name}</h5>
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                    formula.formulaType === 'DURATION'
                                      ? 'bg-purple-100 text-purple-700'
                                      : 'bg-blue-100 text-blue-700'
                                  }`}>
                                    {formula.formulaType === 'DURATION' ? 'Durée' : 'Plage horaire'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mt-2">
                                  <div><strong>Validité:</strong> {formula.numberOfDays} jour{formula.numberOfDays > 1 ? 's' : ''}</div>
                                  <div><strong>Prix:</strong> {formula.price} XOF</div>
                                  {formula.formulaType === 'DURATION' ? (
                                    <div><strong>Heures accordées:</strong> {formula.maxRideDurationHours ?? '—'}h</div>
                                  ) : (
                                    <>
                                      <div><strong>Horaires:</strong> {formula.dayStartHour}h–{formula.dayEndHour}h</div>
                                      {formula.chargeAfterHours && (
                                        <div><strong>Après horaire:</strong> {formula.afterHoursPrice} XOF</div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2">
                                {can.updatePricing() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedFormula(formula);
                                      setFormulaForm(formula);
                                      setIsEditingFormula(true);
                                      setIsAddingFormula(true);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {can.deletePricing() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteFormula(formula.id, formula.name)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {language === 'fr' ? 'Aucune formule' : 'No formulas'}
                      </p>
                    )}
                  </div>

                  {/* Promotions */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">
                        {language === 'fr' ? 'Promotions' : 'Promotions'}
                      </h4>
                      {can.createPricing() && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedPackage(pkg);
                            setIsAddingPromotion(true);
                            setIsEditingPromotion(false);
                            setSelectedPromotion(null);
                            setPromotionForm({
                              name: '',
                              description: '',
                              discountType: 'PERCENTAGE',
                              discountValue: 0,
                              startDate: '',
                              endDate: '',
                              usageLimit: null,
                              packageIds: [],
                              formulaIds: []
                            });
                          }}
                          className="flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          {language === 'fr' ? 'Ajouter' : 'Add'}
                        </Button>
                      )}
                    </div>

                    {promotions.filter(p => p.packageIds?.includes(pkg.id)).length > 0 ? (
                      <div className="space-y-2">
                        {promotions.filter(p => p.packageIds?.includes(pkg.id)).map((promo: any) => (
                          <div key={promo.id} className="bg-white p-4 rounded-lg border border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h5 className="font-semibold text-gray-900">{promo.name}</h5>
                                <p className="text-sm text-gray-600">{promo.description}</p>
                                <div className="text-sm text-gray-600 mt-2">
                                  <strong>{promo.discountValue}</strong> {promo.discountType === 'PERCENTAGE' ? '%' : 'DZD'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {can.updatePricing() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedPromotion(promo);
                                      setPromotionForm(promo);
                                      setIsEditingPromotion(true);
                                      setIsAddingPromotion(true);
                                      setSelectedPackage(pkg);
                                    }}
                                  >
                                    <Edit className="w-4 h-4" />
                                  </Button>
                                )}
                                {can.deletePricing() && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeletePromotion(promo.id, promo.name)}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                                <Badge variant={promo.isActive ? 'default' : 'secondary'}>
                                  {promo.isActive ? t('common.active') : t('common.inactive')}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">
                        {language === 'fr' ? 'Aucune promotion' : 'No promotions'}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Free Days Rules Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2 mt-8">
          {language === 'fr' ? 'Règles de Jours Gratuits' : 'Free Days Rules'}
        </h2>
        <p className="text-gray-600 mb-4">
          {language === 'fr' 
            ? 'Créez des règles pour offrir des jours gratuits aux utilisateurs.'
            : 'Create rules to offer free days to users.'}
        </p>

        {isLoadingFreeDaysRules ? (
          <Card className="p-8 text-center text-gray-500">
            {language === 'fr' ? 'Chargement...' : 'Loading...'}
          </Card>
        ) : freeDaysRules.length === 0 ? (
          <Card className="p-8 text-center text-gray-500">
            {language === 'fr' ? 'Aucune règle créée' : 'No rules created'}
          </Card>
        ) : (
          <div className="space-y-4">
            {freeDaysRules.map(rule => (
              <Card key={rule.id} className="overflow-hidden">
                <div 
                  className="p-6 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                  onClick={() => handleExpandFreeDaysRule(rule.id)}
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900">{rule.name}</h3>
                    {rule.description && (
                      <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">
                        {rule.numberOfDays} {language === 'fr' ? 'jours' : 'days'}
                      </Badge>
                      <Badge variant="outline">
                        {rule.targetType === 'NEW_USERS' 
                          ? (language === 'fr' ? 'Nouveaux utilisateurs' : 'New users') 
                          : rule.targetType === 'MANUAL' 
                            ? (language === 'fr' ? 'Manuel' : 'Manual')
                            : rule.targetType === 'EXISTING_BY_DAYS'
                              ? (language === 'fr' ? `Après ${rule.targetDaysSinceRegistration} jours` : `After ${rule.targetDaysSinceRegistration} days`)
                              : (language === 'fr' ? `Après ${rule.targetMinSpend} spent` : `After ${rule.targetMinSpend} spent`)}
                      </Badge>
                      <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                        {rule.isActive ? (language === 'fr' ? 'Active' : 'Active') : (language === 'fr' ? 'Inactive' : 'Inactive')}
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      {language === 'fr' ? 'Bénéficiaires: ' : 'Beneficiaries: '} {rule.currentBeneficiaries || 0}
                      {rule.maxBeneficiaries && ` / ${rule.maxBeneficiaries}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {can.manageFreeDays() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e: { stopPropagation: () => void; }) => {
                          e.stopPropagation();
                          setSelectedFreeDaysRule(rule);
                          setFreeDaysRuleForm({
                            name: rule.name,
                            description: rule.description || '',
                            numberOfDays: rule.numberOfDays,
                            targetType: rule.targetType,
                            targetDaysSinceRegistration: rule.targetDaysSinceRegistration || undefined,
                            targetMinSpend: rule.targetMinSpend || undefined,
                            startHour: rule.startHour ?? undefined,
                            endHour: rule.endHour ?? undefined,
                            validFrom: rule.validFrom ? new Date(rule.validFrom).toISOString().split('T')[0] : '',
                            validUntil: rule.validUntil ? new Date(rule.validUntil).toISOString().split('T')[0] : '',
                            maxBeneficiaries: rule.maxBeneficiaries || undefined
                          });
                          setIsEditingFreeDaysRule(true);
                          setIsAddingFreeDaysRule(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    )}
                    {can.manageFreeDays() && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e: { stopPropagation: () => void; }) => {
                          e.stopPropagation();
                          handleDeleteFreeDaysRule(rule.id, rule.name);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    )}
                    {expandedFreeDaysRuleId === rule.id ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Rule Details — beneficiaries */}
                {expandedFreeDaysRuleId === rule.id && (
                  <div className="border-t p-6 bg-gray-50 space-y-4">
                    {/* Add beneficiary manually — only for MANUAL type */}
                    {rule.targetType === 'MANUAL' && (
                      <div>
                        <Label className="mb-2 block">{language === 'fr' ? 'Ajouter un bénéficiaire' : 'Add a beneficiary'}</Label>
                        <Input
                          value={userSearchQuery}
                          onChange={(e) => handleSearchUsers(e.target.value)}
                          placeholder={language === 'fr' ? 'Nom, email ou téléphone...' : 'Name, email or phone...'}
                        />
                        {userSearchResults.length > 0 && (
                          <div className="mt-2 bg-white border rounded-lg max-h-40 overflow-y-auto">
                            {userSearchResults.map(user => (
                              <div
                                key={user.id}
                                className="p-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                                onClick={() => handleAddBeneficiary(rule.id, user.id)}
                              >
                                <span>{user.firstName} {user.lastName}</span>
                                <span className="text-sm text-gray-500">{user.email}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Beneficiaries list — for all rule types */}
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-3">
                        {language === 'fr' ? 'Bénéficiaires' : 'Beneficiaries'}
                        {rule.beneficiaries?.length > 0 && (
                          <span className="ml-2 text-sm font-normal text-gray-500">({rule.beneficiaries.length})</span>
                        )}
                      </h4>
                      {rule.beneficiaries && rule.beneficiaries.length > 0 ? (
                        <div className="space-y-2">
                          {rule.beneficiaries.map((beneficiary: any) => (
                            <div key={beneficiary.id} className="bg-white p-3 rounded-lg border flex justify-between items-center">
                              <div>
                                <div className="font-medium">{beneficiary.user?.firstName} {beneficiary.user?.lastName}</div>
                                <div className="text-sm text-gray-500">{beneficiary.user?.email}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {beneficiary.daysRemaining ?? beneficiary.daysGranted} / {beneficiary.daysGranted} {language === 'fr' ? 'jours' : 'days'}
                                </Badge>
                                <Badge variant={beneficiary.isActive !== false ? 'default' : 'secondary'} className="text-xs">
                                  {beneficiary.isActive !== false ? (language === 'fr' ? 'Actif' : 'Active') : (language === 'fr' ? 'Terminé' : 'Done')}
                                </Badge>
                                {can.manageFreeDays() && (
                                  <Button variant="ghost" size="sm" onClick={() => handleRemoveBeneficiary(rule.id, beneficiary.userId)}>
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">
                          {language === 'fr' ? 'Aucun bénéficiaire pour le moment' : 'No beneficiaries yet'}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Package Dialog */}
      <Dialog open={isAddingPackage || isEditingPackage} onOpenChange={(open) => {
        if (!open) {
          setIsAddingPackage(false);
          setIsEditingPackage(false);
          setSelectedPackage(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditingPackage 
                ? (language === 'fr' ? 'Modifier le Forfait' : 'Edit Package')
                : (language === 'fr' ? 'Nouveau Forfait' : 'New Package')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Remplissez les informations du forfait' : 'Fill in the package information'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom du Forfait' : 'Package Name'}</Label>
              <Input
                value={packageForm.name}
                onChange={(e) => setPackageForm({ ...packageForm, name: e.target.value })}
                placeholder={language === 'fr' ? 'Ex: Forfait Standard' : 'Ex: Standard Plan'}
              />
            </div>

            <div>
              <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
              <Textarea
                value={packageForm.description}
                onChange={(e) => setPackageForm({ ...packageForm, description: e.target.value })}
                placeholder={language === 'fr' ? 'Description du forfait' : 'Package description'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setIsAddingPackage(false);
                setIsEditingPackage(false);
              }}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleSavePackage}
            >
              {language === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Formula Dialog */}
      <Dialog open={isAddingFormula} onOpenChange={(open) => {
        if (!open) {
          setIsAddingFormula(false);
          setIsEditingFormula(false);
          setSelectedFormula(null);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditingFormula 
                ? (language === 'fr' ? 'Modifier la Formule' : 'Edit Formula')
                : (language === 'fr' ? 'Nouvelle Formule' : 'New Formula')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Configurez les détails de la formule' : 'Configure the formula details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom' : 'Name'}</Label>
              <Input
                value={formulaForm.name}
                onChange={(e) => setFormulaForm({ ...formulaForm, name: e.target.value })}
                placeholder="Ex: Forfait Jour"
              />
            </div>

            <div>
              <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
              <Textarea
                value={formulaForm.description}
                onChange={(e) => setFormulaForm({ ...formulaForm, description: e.target.value })}
                placeholder="Description de la formule"
              />
            </div>

            {/* Type de formule */}
            <div>
              <Label>{language === 'fr' ? 'Type de formule' : 'Formula type'}</Label>
              <Select
                value={(formulaForm as any).formulaType ?? 'TIME_WINDOW'}
                onValueChange={(value) => setFormulaForm({ ...formulaForm, formulaType: value } as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TIME_WINDOW">
                    {language === 'fr' ? 'Plage horaire (accès par jour)' : 'Time window (daily access)'}
                  </SelectItem>
                  <SelectItem value="DURATION">
                    {language === 'fr' ? 'Durée totale (heures de trajet)' : 'Total duration (ride hours)'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Validité (jours)' : 'Validity (days)'}</Label>
                <Input
                  type="number"
                  value={formulaForm.numberOfDays}
                  onChange={(e) => setFormulaForm({ ...formulaForm, numberOfDays: parseInt(e.target.value) })}
                  min="1"
                />
              </div>

              <div>
                <Label>{language === 'fr' ? 'Prix (XOF)' : 'Price (XOF)'}</Label>
                <Input
                  type="number"
                  value={formulaForm.price}
                  onChange={(e) => setFormulaForm({ ...formulaForm, price: parseFloat(e.target.value) })}
                  step="1"
                  min="0"
                />
              </div>
            </div>

            {/* Champs spécifiques DURATION */}
            {(formulaForm as any).formulaType === 'DURATION' && (
              <div>
                <Label>{language === 'fr' ? 'Heures de trajet accordées' : 'Ride hours granted'}</Label>
                <Input
                  type="number"
                  value={(formulaForm as any).maxRideDurationHours ?? 1}
                  onChange={(e) => setFormulaForm({ ...formulaForm, maxRideDurationHours: parseFloat(e.target.value) } as any)}
                  step="0.5"
                  min="0.5"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {language === 'fr'
                    ? 'Ex: 5 = 5 heures de vélo utilisables pendant la période de validité'
                    : 'E.g.: 5 = 5 ride hours usable during validity period'}
                </p>
              </div>
            )}

            {/* Champs spécifiques TIME_WINDOW */}
            {((formulaForm as any).formulaType ?? 'TIME_WINDOW') === 'TIME_WINDOW' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'fr' ? 'Heure de Début' : 'Start Hour'}</Label>
                    <Input
                      type="number"
                      value={formulaForm.dayStartHour}
                      onChange={(e) => setFormulaForm({ ...formulaForm, dayStartHour: parseInt(e.target.value) })}
                      min="0"
                      max="23"
                    />
                  </div>

                  <div>
                    <Label>{language === 'fr' ? 'Heure de Fin' : 'End Hour'}</Label>
                    <Input
                      type="number"
                      value={formulaForm.dayEndHour}
                      onChange={(e) => setFormulaForm({ ...formulaForm, dayEndHour: parseInt(e.target.value) })}
                      min="0"
                      max="23"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formulaForm.chargeAfterHours}
                    onCheckedChange={(checked: any) => setFormulaForm({ ...formulaForm, chargeAfterHours: checked })}
                  />
                  <Label>{language === 'fr' ? 'Facturer après les horaires' : 'Charge after hours'}</Label>
                </div>

                {formulaForm.chargeAfterHours && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>{language === 'fr' ? 'Prix Après Horaire' : 'After Hours Price'}</Label>
                      <Input
                        type="number"
                        value={formulaForm.afterHoursPrice}
                        onChange={(e) => setFormulaForm({ ...formulaForm, afterHoursPrice: parseFloat(e.target.value) })}
                        step="0.01"
                        min="0"
                      />
                    </div>

                    <div>
                      <Label>{language === 'fr' ? 'Type' : 'Type'}</Label>
                      <Select value={formulaForm.afterHoursType} onValueChange={(value) => setFormulaForm({ ...formulaForm, afterHoursType: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FIXED_PRICE">
                            {language === 'fr' ? 'Prix Fixe' : 'Fixed Price'}
                          </SelectItem>
                          <SelectItem value="PERCENTAGE">
                            {language === 'fr' ? 'Pourcentage' : 'Percentage'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setIsAddingFormula(false);
                setIsEditingFormula(false);
              }}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleSaveFormula}
            >
              {language === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promotion Dialog */}
      <Dialog open={isAddingPromotion} onOpenChange={(open) => {
        if (!open) {
          setIsAddingPromotion(false);
          setIsEditingPromotion(false);
          setSelectedPromotion(null);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditingPromotion 
                ? (language === 'fr' ? 'Modifier la Promotion' : 'Edit Promotion')
                : (language === 'fr' ? 'Nouvelle Promotion' : 'New Promotion')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' ? 'Configurez les détails de la promotion' : 'Configure the promotion details'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom' : 'Name'}</Label>
              <Input
                value={promotionForm.name}
                onChange={(e) => setPromotionForm({ ...promotionForm, name: e.target.value })}
                placeholder="Ex: Réduction 20%"
              />
            </div>

            <div>
              <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
              <Textarea
                value={promotionForm.description}
                onChange={(e) => setPromotionForm({ ...promotionForm, description: e.target.value })}
                placeholder="Description de la promotion"
              />
            </div>

            <div>
              <Label>{language === 'fr' ? 'Type de Réduction' : 'Discount Type'}</Label>
              <Select value={promotionForm.discountType} onValueChange={(value) => setPromotionForm({ ...promotionForm, discountType: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTAGE">
                    {language === 'fr' ? 'Pourcentage' : 'Percentage'}
                  </SelectItem>
                  <SelectItem value="FIXED_AMOUNT">
                    {language === 'fr' ? 'Montant Fixe' : 'Fixed Amount'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{language === 'fr' ? 'Valeur de Réduction' : 'Discount Value'}</Label>
              <Input
                type="number"
                value={promotionForm.discountValue || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setPromotionForm({ ...promotionForm, discountValue: val === '' ? 0 : parseFloat(val) || 0 });
                }}
                step="0.01"
                min="0"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Date de Début' : 'Start Date'}</Label>
                <Input
                  type="date"
                  value={promotionForm.startDate}
                  onChange={(e) => setPromotionForm({ ...promotionForm, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label>{language === 'fr' ? 'Date de Fin' : 'End Date'}</Label>
                <Input
                  type="date"
                  value={promotionForm.endDate}
                  onChange={(e) => setPromotionForm({ ...promotionForm, endDate: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>{language === 'fr' ? 'Limite d\'Utilisation' : 'Usage Limit'}</Label>
              <Input
                type="number"
                value={promotionForm.usageLimit || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setPromotionForm({ ...promotionForm, usageLimit: val === '' ? null : parseInt(val) || null });
                }}
                min="1"
                placeholder={language === 'fr' ? 'Laissez vide pour illimité' : 'Leave empty for unlimited'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setIsAddingPromotion(false);
                setIsEditingPromotion(false);
                setSelectedPromotion(null);
              }}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleSavePromotion}
            >
              {language === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm !== null} onOpenChange={(open) => {
        if (!open) setDeleteConfirm(null);
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Confirmer la Suppression' : 'Confirm Deletion'}</DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? `Êtes-vous sûr de vouloir supprimer "${deleteConfirm?.name}" ? Cette action est définitive.`
                : `Are you sure you want to delete "${deleteConfirm?.name}"? This action cannot be undone.`
              }
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDelete}
            >
              {language === 'fr' ? 'Supprimer' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Free Days Rule Dialog */}
      <Dialog open={isAddingFreeDaysRule} onOpenChange={(open) => {
        if (!open) {
          setIsAddingFreeDaysRule(false);
          setIsEditingFreeDaysRule(false);
          setSelectedFreeDaysRule(null);
          setUserSearchResults([]);
          setUserSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isEditingFreeDaysRule 
                ? (language === 'fr' ? 'Modifier la Règle' : 'Edit Rule')
                : (language === 'fr' ? 'Nouvelle Règle de Jours Gratuits' : 'New Free Days Rule')
              }
            </DialogTitle>
            <DialogDescription>
              {language === 'fr' 
                ? 'Configurez les paramètres de la règle de jours gratuits'
                : 'Configure the free days rule settings'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom de la Règle' : 'Rule Name'} *</Label>
              <Input
                value={freeDaysRuleForm.name}
                onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, name: e.target.value })}
                placeholder={language === 'fr' ? 'Ex: 2 Jours Gratuits' : 'Ex: 2 Free Days'}
              />
            </div>

            <div>
              <Label>{language === 'fr' ? 'Description' : 'Description'}</Label>
              <Textarea
                value={freeDaysRuleForm.description}
                onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, description: e.target.value })}
                placeholder={language === 'fr' ? 'Description de la règle' : 'Rule description'}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Nombre de Jours' : 'Number of Days'} *</Label>
                <Input
                  type="number"
                  value={freeDaysRuleForm.numberOfDays}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, numberOfDays: parseInt(e.target.value) || 1 })}
                  min="1"
                />
              </div>

            </div>

            <div>
              <Label>{language === 'fr' ? 'Type de Cible' : 'Target Type'}</Label>
              <Select 
                value={freeDaysRuleForm.targetType} 
                onValueChange={(value) => setFreeDaysRuleForm({ ...freeDaysRuleForm, targetType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW_USERS">
                    {language === 'fr' ? 'Nouveaux Utilisateurs' : 'New Users'}
                  </SelectItem>
                  <SelectItem value="EXISTING_BY_DAYS">
                    {language === 'fr' ? 'Par Jours depuis Inscription' : 'By Days Since Registration'}
                  </SelectItem>
                  <SelectItem value="EXISTING_BY_SPEND">
                    {language === 'fr' ? 'Par Montant Dépensé' : 'By Amount Spent'}
                  </SelectItem>
                  <SelectItem value="MANUAL">
                    {language === 'fr' ? 'Manuel' : 'Manual'}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {freeDaysRuleForm.targetType === 'EXISTING_BY_DAYS' && (
              <div>
                <Label>{language === 'fr' ? 'Jours depuis Inscription' : 'Days Since Registration'}</Label>
                <Input
                  type="number"
                  value={freeDaysRuleForm.targetDaysSinceRegistration || ''}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, targetDaysSinceRegistration: e.target.value ? parseInt(e.target.value) : undefined })}
                  min="1"
                  placeholder="Ex: 30"
                />
              </div>
            )}

            {freeDaysRuleForm.targetType === 'EXISTING_BY_SPEND' && (
              <div>
                <Label>{language === 'fr' ? 'Montant Minimum Dépensé' : 'Minimum Amount Spent'}</Label>
                <Input
                  type="number"
                  value={freeDaysRuleForm.targetMinSpend || ''}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, targetMinSpend: e.target.value ? parseFloat(e.target.value) : undefined })}
                  min="0"
                  placeholder="Ex: 5000"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Heure de début (0-23)' : 'Start Hour (0-23)'}</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={freeDaysRuleForm.startHour ?? ''}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, startHour: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder={language === 'fr' ? 'Optionnel' : 'Optional'}
                />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Heure de fin (0-23)' : 'End Hour (0-23)'}</Label>
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={freeDaysRuleForm.endHour ?? ''}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, endHour: e.target.value ? parseInt(e.target.value) : undefined })}
                  placeholder={language === 'fr' ? 'Optionnel' : 'Optional'}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Valide à partir de' : 'Valid From'}</Label>
                <Input
                  type="date"
                  value={freeDaysRuleForm.validFrom}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, validFrom: e.target.value })}
                />
              </div>

              <div>
                <Label>{language === 'fr' ? 'Valide jusqu\'à' : 'Valid Until'}</Label>
                <Input
                  type="date"
                  value={freeDaysRuleForm.validUntil}
                  onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>{language === 'fr' ? 'Nombre Maximum de Bénéficiaires' : 'Maximum Beneficiaries'}</Label>
              <Input
                type="number"
                value={freeDaysRuleForm.maxBeneficiaries || ''}
                onChange={(e) => setFreeDaysRuleForm({ ...freeDaysRuleForm, maxBeneficiaries: e.target.value ? parseInt(e.target.value) : undefined })}
                min="1"
                placeholder={language === 'fr' ? 'Laissez vide pour illimité' : 'Leave empty for unlimited'}
              />
            </div>
          </div>

          <DialogFooter>
            <Button 
              variant="outline"
              onClick={() => {
                setIsAddingFreeDaysRule(false);
                setIsEditingFreeDaysRule(false);
              }}
            >
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button 
              className="bg-green-600 text-white hover:bg-green-700"
              onClick={handleSaveFreeDaysRule}
            >
              {language === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Plan Dialog (Add / Edit) */}
      <Dialog open={isEditingPlan || isAddingNewPlan} onOpenChange={(open) => { if (!open) { setIsEditingPlan(false); setIsAddingNewPlan(false); setSelectedPlan(null); } }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isAddingNewPlan ? (language === 'fr' ? 'Nouveau Plan Tarifaire' : 'New Pricing Plan') : (language === 'fr' ? `Modifier: ${selectedPlan?.name}` : `Edit: ${selectedPlan?.name}`)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom du Plan *' : 'Plan Name *'}</Label>
              <Input value={editedPlan.name} onChange={(e) => setEditedPlan({ ...editedPlan, name: e.target.value })} className={pricingFormErrors.planName ? 'border-red-500' : ''} />
              {pricingFormErrors.planName && <p className="text-xs text-red-500 mt-1">{pricingFormErrors.planName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Tarif Horaire (FCFA)' : 'Hourly Rate (FCFA)'}</Label>
                <Input type="number" value={editedPlan.hourlyRate} onChange={(e) => setEditedPlan({ ...editedPlan, hourlyRate: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{language === 'fr' ? "Minimum d'Heures" : 'Minimum Hours'}</Label>
                <Input type="number" min="1" value={editedPlan.minimumHours} onChange={(e) => setEditedPlan({ ...editedPlan, minimumHours: parseInt(e.target.value) || 1 })} />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Tarif Journalier (FCFA)' : 'Daily Rate (FCFA)'}</Label>
                <Input type="number" value={editedPlan.dailyRate} onChange={(e) => setEditedPlan({ ...editedPlan, dailyRate: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Réduction (%)' : 'Discount (%)'}</Label>
                <Input type="number" value={editedPlan.discount} onChange={(e) => setEditedPlan({ ...editedPlan, discount: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Tarif Hebdomadaire (FCFA)' : 'Weekly Rate (FCFA)'}</Label>
                <Input type="number" value={editedPlan.weeklyRate} onChange={(e) => setEditedPlan({ ...editedPlan, weeklyRate: parseInt(e.target.value) || 0 })} />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Tarif Mensuel (FCFA)' : 'Monthly Rate (FCFA)'}</Label>
                <Input type="number" value={editedPlan.monthlyRate} onChange={(e) => setEditedPlan({ ...editedPlan, monthlyRate: parseInt(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editedPlan.hasOverride} onCheckedChange={(checked: boolean) => setEditedPlan({ ...editedPlan, hasOverride: checked, overTimeValue: checked ? editedPlan.overTimeValue : 0 })} />
              <Label>{language === 'fr' ? 'Tarification spéciale hors forfait (overtime)' : 'Special overtime pricing'}</Label>
            </div>
            {editedPlan.hasOverride && (
              <Card className="p-4 bg-yellow-50 border-yellow-200">
                <h4 className="text-sm font-medium mb-3 text-yellow-800">{language === 'fr' ? 'Configuration Overtime' : 'Overtime Configuration'}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{language === 'fr' ? 'Type' : 'Type'}</Label>
                    <Select value={editedPlan.overTimeType} onValueChange={(v: 'FIXED_PRICE' | 'PERCENTAGE_REDUCTION') => setEditedPlan({ ...editedPlan, overTimeType: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PERCENTAGE_REDUCTION">{language === 'fr' ? 'Réduction en %' : 'Percentage reduction'}</SelectItem>
                        <SelectItem value="FIXED_PRICE">{language === 'fr' ? 'Prix fixe' : 'Fixed price'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{editedPlan.overTimeType === 'FIXED_PRICE' ? (language === 'fr' ? 'Prix fixe (FCFA)' : 'Fixed price (FCFA)') : (language === 'fr' ? 'Réduction (%)' : 'Reduction (%)')}</Label>
                    <Input type="number" value={editedPlan.overTimeValue} onChange={(e) => setEditedPlan({ ...editedPlan, overTimeValue: parseFloat(e.target.value) || 0 })} min="0" max={editedPlan.overTimeType === 'PERCENTAGE_REDUCTION' ? '100' : undefined} />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <p className="text-xs font-medium text-yellow-800">{language === 'fr' ? 'Plages horaires (0-23h)' : 'Time slots (0-23h)'}</p>
                  {(['hourly', 'daily', 'weekly', 'monthly'] as const).map((type) => (
                    <div key={type} className="grid grid-cols-3 gap-2 items-end">
                      <Label className="text-xs capitalize">{language === 'fr' ? { hourly: 'Horaire', daily: 'Journalier', weekly: 'Hebdo', monthly: 'Mensuel' }[type] : type}</Label>
                      <div>
                        <Label className="text-xs">{language === 'fr' ? 'Début' : 'Start'}</Label>
                        <Input type="number" min="0" max="23" className="h-8"
                          value={(editedPlan[`${type}StartHour` as keyof typeof editedPlan] as number | null) ?? ''}
                          onChange={(e) => setEditedPlan({ ...editedPlan, [`${type}StartHour`]: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="0" />
                      </div>
                      <div>
                        <Label className="text-xs">{language === 'fr' ? 'Fin' : 'End'}</Label>
                        <Input type="number" min="0" max="23" className="h-8"
                          value={(editedPlan[`${type}EndHour` as keyof typeof editedPlan] as number | null) ?? ''}
                          onChange={(e) => setEditedPlan({ ...editedPlan, [`${type}EndHour`]: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="23" />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={editedPlan.isActive} onCheckedChange={(checked: boolean) => setEditedPlan({ ...editedPlan, isActive: checked })} />
              <Label>{language === 'fr' ? 'Plan Actif' : 'Active Plan'}</Label>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditingPlan(false); setIsAddingNewPlan(false); }}>
              <X className="w-4 h-4 mr-2" />{language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSavePlan}>
              <Check className="w-4 h-4 mr-2" />{language === 'fr' ? 'Sauvegarder' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog (Add / Edit) */}
      <Dialog open={isEditingRule || isAddingNewRule} onOpenChange={(open) => { if (!open) { setIsEditingRule(false); setIsAddingNewRule(false); setSelectedRule(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAddingNewRule ? (language === 'fr' ? 'Nouvelle Règle Tarifaire' : 'New Pricing Rule') : (language === 'fr' ? `Modifier: ${selectedRule?.name}` : `Edit: ${selectedRule?.name}`)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom de la Règle *' : 'Rule Name *'}</Label>
              <Input value={editedRule.name} onChange={(e) => setEditedRule({ ...editedRule, name: e.target.value })} className={pricingFormErrors.planName ? 'border-red-500' : ''} />
              {pricingFormErrors.planName && <p className="text-xs text-red-500 mt-1">{pricingFormErrors.planName}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Jour de la Semaine' : 'Day of Week'}</Label>
                <Select value={editedRule.dayOfWeek?.toString() ?? 'null'} onValueChange={(v) => setEditedRule({ ...editedRule, dayOfWeek: v === 'null' ? null : parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {daysOfWeek.map((d) => (
                      <SelectItem key={d.value?.toString() ?? 'null'} value={d.value?.toString() ?? 'null'}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{language === 'fr' ? 'Multiplicateur *' : 'Multiplier *'}</Label>
                <Input type="number" step="0.1" value={editedRule.multiplier} onChange={(e) => setEditedRule({ ...editedRule, multiplier: parseFloat(e.target.value) || 1 })} className={pricingFormErrors.multiplier ? 'border-red-500' : ''} />
                {pricingFormErrors.multiplier && <p className="text-xs text-red-500 mt-1">{pricingFormErrors.multiplier}</p>}
              </div>
              <div>
                <Label>{language === 'fr' ? 'Heure de Début' : 'Start Hour'}</Label>
                <Input type="number" min="0" max="23" value={editedRule.startHour ?? ''} onChange={(e) => setEditedRule({ ...editedRule, startHour: e.target.value ? parseInt(e.target.value) : null })} placeholder="0-23" />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Heure de Fin' : 'End Hour'}</Label>
                <Input type="number" min="0" max="23" value={editedRule.endHour ?? ''} onChange={(e) => setEditedRule({ ...editedRule, endHour: e.target.value ? parseInt(e.target.value) : null })} placeholder="0-23" />
              </div>
              <div>
                <Label>{language === 'fr' ? 'Priorité' : 'Priority'}</Label>
                <Input type="number" value={editedRule.priority} onChange={(e) => setEditedRule({ ...editedRule, priority: parseInt(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={editedRule.isActive} onCheckedChange={(checked: boolean) => setEditedRule({ ...editedRule, isActive: checked })} />
                <Label>{language === 'fr' ? 'Règle Active' : 'Active Rule'}</Label>
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setIsEditingRule(false); setIsAddingNewRule(false); }}>
              <X className="w-4 h-4 mr-2" />{language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button onClick={handleSaveRule}>
              <Check className="w-4 h-4 mr-2" />{language === 'fr' ? 'Sauvegarder' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Plan Confirmation */}
      <Dialog open={isDeletingPlan !== null} onOpenChange={(open) => { if (!open) setIsDeletingPlan(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Supprimer le Plan' : 'Delete Plan'}</DialogTitle>
            <DialogDescription>{language === 'fr' ? 'Cette action est définitive. Continuer ?' : 'This action cannot be undone. Continue?'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletingPlan(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => isDeletingPlan && handleDeletePlan(isDeletingPlan)}>{language === 'fr' ? 'Supprimer' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Rule Confirmation */}
      <Dialog open={isDeletingRule !== null} onOpenChange={(open) => { if (!open) setIsDeletingRule(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'fr' ? 'Supprimer la Règle' : 'Delete Rule'}</DialogTitle>
            <DialogDescription>{language === 'fr' ? 'Cette action est définitive. Continuer ?' : 'This action cannot be undone. Continue?'}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeletingRule(null)}>{language === 'fr' ? 'Annuler' : 'Cancel'}</Button>
            <Button className="bg-red-600 text-white hover:bg-red-700" onClick={() => isDeletingRule && handleDeleteRule(isDeletingRule)}>{language === 'fr' ? 'Supprimer' : 'Delete'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PricingTier Add/Edit Dialog */}
      <Dialog open={isAddingTier || isEditingTier} onOpenChange={(open) => { if (!open) { setIsAddingTier(false); setIsEditingTier(false); setSelectedTier(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditingTier ? (language === 'fr' ? 'Modifier le palier' : 'Edit tier') : (language === 'fr' ? 'Nouveau palier tarifaire' : 'New pricing tier')}</DialogTitle>
            <DialogDescription>
              {language === 'fr'
                ? 'Un palier définit un prix fixe pour une durée donnée (ex: 1h = 250 FCFA). Plage horaire optionnelle pour des tarifs nuit/jour.'
                : 'A tier defines a flat price for a given duration (e.g. 1h = 250 FCFA). Optional time window for night/day rates.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === 'fr' ? 'Nom (optionnel)' : 'Name (optional)'}</Label>
              <Input value={tierForm.name} onChange={(e) => setTierForm({ ...tierForm, name: e.target.value })} placeholder={language === 'fr' ? 'ex: Tarif nuit' : 'e.g. Night rate'} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{language === 'fr' ? 'Durée (minutes)' : 'Duration (minutes)'}</Label>
                <Input type="number" min="60" step="60" value={tierForm.durationMinutes}
                  onChange={(e) => setTierForm({ ...tierForm, durationMinutes: parseInt(e.target.value) || 60 })} />
                <p className="text-xs text-gray-500 mt-1">{Math.round(tierForm.durationMinutes / 60)}h</p>
              </div>
              <div>
                <Label>{language === 'fr' ? 'Prix (FCFA)' : 'Price (FCFA)'}</Label>
                <Input type="number" min="0" value={tierForm.price}
                  onChange={(e) => setTierForm({ ...tierForm, price: parseFloat(e.target.value) || 0 })} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={tierForm.hasTimeWindow} onCheckedChange={(checked: boolean) => setTierForm({ ...tierForm, hasTimeWindow: checked })} />
              <Label className="flex items-center gap-1">
                <Moon className="w-4 h-4" />
                {language === 'fr' ? 'Plage horaire spécifique' : 'Specific time window'}
              </Label>
            </div>
            {tierForm.hasTimeWindow && (
              <div className="grid grid-cols-2 gap-4 pl-8">
                <div>
                  <Label>{language === 'fr' ? 'Heure de début' : 'Start hour'}</Label>
                  <Input type="number" min="0" max="23" value={tierForm.dayStartHour}
                    onChange={(e) => setTierForm({ ...tierForm, dayStartHour: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>{language === 'fr' ? 'Heure de fin' : 'End hour'}</Label>
                  <Input type="number" min="0" max="23" value={tierForm.dayEndHour}
                    onChange={(e) => setTierForm({ ...tierForm, dayEndHour: parseInt(e.target.value) || 0 })} />
                </div>
                {tierForm.dayStartHour !== tierForm.dayEndHour && (
                  <p className="col-span-2 text-xs text-indigo-600">
                    {tierForm.dayStartHour > tierForm.dayEndHour
                      ? `Nuit : ${formatHour(tierForm.dayStartHour)} → ${formatHour(tierForm.dayEndHour)} (lendemain)`
                      : `Jour : ${formatHour(tierForm.dayStartHour)} → ${formatHour(tierForm.dayEndHour)}`}
                  </p>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch checked={tierForm.isActive} onCheckedChange={(checked: boolean) => setTierForm({ ...tierForm, isActive: checked })} />
              <Label>{language === 'fr' ? 'Actif' : 'Active'}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddingTier(false); setIsEditingTier(false); setSelectedTier(null); }}>
              {language === 'fr' ? 'Annuler' : 'Cancel'}
            </Button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={handleSaveTier}>
              {language === 'fr' ? 'Enregistrer' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
