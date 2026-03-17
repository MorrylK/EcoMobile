import { Bike, Users, DollarSign, AlertTriangle, Activity, TrendingUp, MapPin, Battery, Loader2 } from 'lucide-react';
import { Card } from '../../ui/card';
import { BikeMap } from '../Bikes/BikeMap';
import { Badge } from '../../ui/badge';
import { useTranslation } from '../../../lib/i18n';
import { useState, useEffect } from 'react';
import { adminService } from '../../../services/api/admin.service';
import { ridesService } from '../../../services/api/ride.service';
import { bikeService } from '../../../services/api/bike.service';
import { toast } from 'sonner';
import React from 'react';

export function Dashboard() {
  const { t, language } = useTranslation();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [recentIncidents, setRecentIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      try {
        const completeData = await adminService.getDashboardComplete();
        
        setDashboardData({
          totalUsers: completeData.stats.users.total,
          totalBikes: completeData.stats.bikes.total,
          totalRides: completeData.stats.rides.total,
          totalRevenue: completeData.stats.revenue.total,
          activeUsers: completeData.stats.users.recent,
          availableBikes: completeData.stats.bikes.byStatus.AVAILABLE || 0,
          activeRides: completeData.stats.rides.active,
          ongoingRides: completeData.stats.rides.active,
          revenueToday: 0,
          userGrowth: 0,
          bikeUtilization: 0,
          avgTripDuration: 0,
          popularZones: [],
          maintenanceBikes: completeData.stats.bikes.byStatus.MAINTENANCE || 0,
          weeklyGrowth: {
            users: 0,
            rides: 0,
            revenue: 0
          },
          recentActivity: [],
          gpsData: completeData.gpsData
        });

        setRecentTrips(completeData.recentTrips || []);
        setRecentIncidents(completeData.recentIncidents || []);
      } catch (error) {
        console.warn('Dashboard complete endpoint not available, using fallback');
        const [dashboardResponse, tripsResponse, incidentsResponse, realtimePositions] = await Promise.all([
          adminService.getDashboardStats(),
          ridesService.getAllRides({ limit: 10, status: 'IN_PROGRESS' }),
          adminService.getIncidents({ limit: 5, status: 'OPEN' }),
          bikeService.getRealtimePositions()
        ]);

        setDashboardData({
          ...dashboardResponse,
          gpsData: {
            total: realtimePositions.length,
            online: realtimePositions.filter(bike => bike.isOnline).length,
            offline: realtimePositions.filter(bike => !bike.isOnline).length
          }
        });

        if (tripsResponse && tripsResponse.rides) {
          setRecentTrips(tripsResponse.rides);
        }

        if (incidentsResponse && incidentsResponse.incidents) {
          setRecentIncidents(incidentsResponse.incidents);
        }
      }

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error(t('dashboard.error'));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      'IN_PROGRESS': { label: language === 'fr' ? 'En cours' : 'Active', variant: 'default' },
      'COMPLETED': { label: language === 'fr' ? 'Terminé' : 'Completed', variant: 'secondary' },
      'OPEN': { label: language === 'fr' ? 'En attente' : 'Pending', variant: 'outline' },
      'IN_PROGRESS_INCIDENT': { label: language === 'fr' ? 'Traitement' : 'In Progress', variant: 'default' }
    };
    const config = variants[status] || { label: status, variant: 'outline' };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-green-600 mx-auto mb-4 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">{t('dashboard.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: t('dashboard.availableBikes'),
      value: dashboardData?.bikes?.byStatus?.AVAILABLE || 0,
      total: dashboardData?.bikes?.total || 0,
      icon: Bike,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      change: t('dashboard.changeSinceYesterday')
    },
    {
      title: t('dashboard.activeUsers'),
      value: (dashboardData?.users?.recent || 0).toString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      change: t('dashboard.changeThisWeek')
    },
    {
      title: t('dashboard.todayRevenue'),
      value: `${(dashboardData?.revenue?.total || 0).toLocaleString()} FCFA`,
      icon: DollarSign,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      change: t('dashboard.changeVsYesterday')
    },
    {
      title: t('dashboard.pendingIncidents'),
      value: recentIncidents.length.toString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      change: t('dashboard.requiresAttention')
    }
  ];

  return (
    <div className="p-4 md:p-8 space-y-6 pb-12 w-full">
      <div>
        <h1 className="text-green-600">{t('dashboard.title')}</h1>
        <p className="text-gray-600">{t('dashboard.overview')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{stat.title}</p>
                  <p className="text-gray-900 mb-2">
                    {stat.total ? `${stat.value}/${stat.total}` : stat.value}
                  </p>
                  <p className="text-xs text-gray-500">{stat.change}</p>
                </div>
                <div className={`${stat.bgColor} ${stat.color} p-3 rounded-lg`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Map Section - S'assurer que la carte est visible et défilable */}
      <Card className="p-6">
        <BikeMap />
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Trips */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-blue-600" />
            <h3>{t('dashboard.activeTrips')}</h3>
          </div>
          <div className="space-y-3">
            {recentTrips.length > 0 ? recentTrips.map((trip) => (
              <div key={trip.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm">{trip.userName}</p>
                    <p className="text-xs text-gray-500">{trip.bikeName}</p>
                  </div>
                  {getStatusBadge(trip.status)}
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Activity className="w-3 h-3" />
                    {trip.distance ? `${trip.distance} km` : '--'}
                  </span>
                  <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    {trip.duration ? `${trip.duration} min` : '--'}
                  </span>
                </div>
              </div>
            )) : (
              <p className="text-center text-gray-500 py-8">
                {language === 'fr' ? 'Aucun trajet en cours' : 'No active trips'}
              </p>
            )}
          </div>
        </Card>

        {/* Recent Incidents */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3>{t('dashboard.recentIncidents')}</h3>
          </div>
          <div className="space-y-3">
            {recentIncidents.length > 0 ? recentIncidents.map((incident) => (
              <div key={incident.id} className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm">{incident.user?.firstName} {incident.user?.lastName}</p>
                    <p className="text-xs text-gray-500">{incident.bike?.code}</p>
                  </div>
                  {getStatusBadge(incident.status)}
                </div>
                <p className="text-xs text-gray-600 mb-2">{incident.description}</p>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline">{incident.type}</Badge>
                </div>
              </div>
            )) : (
              <p className="text-center text-gray-500 py-8">
                {language === 'fr' ? 'Aucun signalement récent' : 'No recent incidents'}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 text-purple-600 p-3 rounded-lg">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {language === 'fr' ? 'Trajets Complétés' : 'Completed Trips'}
              </p>
              <p className="text-gray-900">{dashboardData?.rides?.total || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="bg-green-50 text-green-600 p-3 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {language === 'fr' ? 'Total Utilisateurs' : 'Total Users'}
              </p>
              <p className="text-gray-900">{dashboardData?.users?.total || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 text-blue-600 p-3 rounded-lg">
              <Battery className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Trajets Actifs</p>
              <p className="text-gray-900">{dashboardData?.rides?.active || 0}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="bg-orange-50 text-orange-600 p-3 rounded-lg">
              <Bike className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Vélos</p>
              <p className="text-gray-900">{dashboardData?.bikes?.total || 0}</p>
            </div>
          </div>
        </Card>
      </div>
      
      {/* Padding en bas pour s'assurer que tout est visible */}
      <div className="h-8"></div>
    </div>
  );
}