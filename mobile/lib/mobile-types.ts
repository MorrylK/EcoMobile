/* eslint-disable @typescript-eslint/array-type */

export interface MobileUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  avatar?: string;
  language: 'fr' | 'en';
  wallet?: {
    id: string;
    balance: number;
    currency: string;
  };
  verificationStatus: {
    email: boolean;
    phone: boolean;
    identity: boolean;
  };
  createdAt: string;
}

export interface Bike {
  id: string;
  code: string;
  model: string;
  status: 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'UNAVAILABLE';
  batteryLevel: number;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  equipment?: Record<string, any>;
  qrCode: string;
  gpsDeviceId?: string;
  pricingPlan?: PricingPlan;
  currentPricing?: {
    displayPrice: number;
    durationHours: number;
    isNight: boolean;
    isFallback: boolean;
    unlockFee: number;
  };
  lastMaintenanceAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PricingPlan {
  id: string;
  name: string;
  hourlyRate: number;
  dailyRate?: number;
  weeklyRate?: number;
  monthlyRate?: number;
  minimumHours: number;
  discount: number;
  isActive: boolean;
}

export interface Ride {
  id: string;
  userId: string;
  bikeId: string;
  bike?: Bike;
  startTime: string;
  endTime?: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude?: number;
  endLongitude?: number;
  distance?: number;
  duration?: number;
  cost?: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  gpsTrack?: Array<{ latitude: number; longitude: number; timestamp: string }>;
  createdAt: string;
  updatedAt: string;
}

export interface RideStats {
  totalRides: number;
  totalDistance: number;
  totalDuration: number;
  totalCost: number;
  averageDistance: number;
  averageDuration: number;
}

export interface Reservation {
  id: string;
  bikeId: string;
  bikeName: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'active' | 'expired' | 'used' | 'cancelled';
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
}

export interface Payment {
  id: string;
  userId: string;
  type: 'ride' | 'wallet-topup' | 'refund';
  amount: number;
  currency: string;
  method: 'orange-money' | 'mobile-money' | 'wallet';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  reference: string;
  details?: {
    rideId?: string;
    phoneNumber?: string;
    transactionId?: string;
  };
}

export interface Incident {
  id: string;
  userId: string;
  bikeId?: string;
  rideId?: string;
  type: 'technical' | 'accident' | 'theft' | 'damage' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  images: string[];
  status: 'reported' | 'investigating' | 'resolved' | 'closed';
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
  refundAmount?: number;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'ride' | 'payment' | 'incident' | 'promotion' | 'system';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
  timestamp?: string;
}

// API Integration types
export interface GPSApiConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  endpoints: {
    login: string;
    getLastPosition: string;
    getCar: string;
    [key: string]: string;
  };
}

export interface PaymentApiConfig {
  name: string;
  provider: 'orange-money' | 'mobile-money';
  baseUrl: string;
  apiKey: string;
  merchantId: string;
  endpoints: {
    initiate: string;
    verify: string;
    refund: string;
    [key: string]: string;
  };
}