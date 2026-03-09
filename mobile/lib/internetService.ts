import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { toast } from '@/components/ui/Toast';
import { haptics } from '@/utils/haptics';
import { getTranslationSync } from '@/lib/mobile-i18n';

class InternetService {
  private static instance: InternetService;
  private isConnected: boolean = true;
  private listeners: ((connected: boolean) => void)[] = [];
  private actionListeners: ((connected: boolean) => void)[] = [];

  private constructor() {
    this.initialize();
  }

  static getInstance(): InternetService {
    if (!InternetService.instance) {
      InternetService.instance = new InternetService();
    }
    return InternetService.instance;
  }

  private initialize() {
    NetInfo.addEventListener((state: NetInfoState) => {
      const wasConnected = this.isConnected;
      this.isConnected = state.isConnected ?? false;

      if (wasConnected && !this.isConnected) {
        // Déconnexion
        toast.error(getTranslationSync('common.networkError'));
        haptics.error();
      } else if (!wasConnected && this.isConnected) {
        // Reconnexion
        toast.success(getTranslationSync('common.networkRestored'));
        haptics.success();
      }

      this.notifyListeners();
    });
  }

  public getStatus(): boolean {
    return this.isConnected;
  }

  public subscribe(listener: (connected: boolean) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  public subscribeToActions(listener: (connected: boolean) => void) {
    this.actionListeners.push(listener);
    return () => {
      this.actionListeners = this.actionListeners.filter(l => l !== listener);
    };
  }

  public checkConnection(): Promise<boolean> {
    return NetInfo.fetch().then(state => {
      this.isConnected = state.isConnected ?? false;
      this.notifyListeners();
      return this.isConnected;
    });
  }

  public requireConnection(): boolean {
    if (!this.isConnected) {
      toast.error(getTranslationSync('auth.internetRequired'));
      haptics.error();
      return false;
    }
    return true;
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.isConnected));
    this.actionListeners.forEach(listener => listener(this.isConnected));
  }
}

export const internetService = InternetService.getInstance();