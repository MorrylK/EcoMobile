import React, { useEffect, useState } from 'react';
import { useI18n } from '../../lib/i18n';
import { useCompanyInfo } from '../../hooks/useCompanyInfo';
import { companyService } from '../../services/api/company.service';
import { Button } from '../ui/button';
import { ImageWithFallback } from '../figma/ImageWithFallback';

interface DownloadAppProps {
  onNavigateToMobile?: () => void;
}

export function DownloadApp({ onNavigateToMobile }: DownloadAppProps) {
  const { t } = useI18n();
  const { companyName, isLoading } = useCompanyInfo();

  const displayName = isLoading ? 'FreeBike' : (companyName || 'FreeBike');
  const [dynamicDownloadUrl, setDynamicDownloadUrl] = useState<string | null>(null);

  const appStoreBadgeUrl = "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg";
  const googlePlayBadgeUrl = "https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png";

  const envDownloadUrl = (import.meta as any).env.VITE_APP_DOWNLOAD_URL || '';
  const downloadUrl = dynamicDownloadUrl || envDownloadUrl;
  const appName = (import.meta as any).env.VITE_APP_NAME || 'FreeBike';

  useEffect(() => {
    const loadAppVersion = async () => {
      try {
        const version = await companyService.getAppVersion();
        if (version.apkUrl) {
          setDynamicDownloadUrl(version.apkUrl);
        }
      } catch (error) {
        console.error('Failed to fetch dynamic app version:', error);
      }
    };
    loadAppVersion();
  }, []);

  const handleDownloadAPK = async () => {
    if (!downloadUrl) {
      alert('Lien de téléchargement non configuré');
      return;
    }

    try {
      const response = await fetch(downloadUrl, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-cache',
      });

      if (!response.ok) {
        throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';

      const blob = await response.blob();

      const cleanAppName = appName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const fileName = `${cleanAppName}.apk`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.href = url;
      link.download = fileName;
      link.style.display = 'none';
      
      document.body.appendChild(link);
      
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);

    } catch (error) {
      if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `${appName.replace(/[^a-zA-Z0-9-_]/g, '_')}.apk`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => {
          window.open(downloadUrl, '_blank');
        }, 100);
      } else {
        alert(`Erreur lors du téléchargement: ${error instanceof Error ? error.message : 'Erreur inconnue'}\n\nVeuillez réessayer ou contacter le support.`);
      }
    }
  };

  return (
    <section id="download" className="py-20 bg-gradient-to-br from-green-600 to-green-700 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left Content */}
          <div>
            <h2 className="text-4xl md:text-5xl text-white mb-6" style={{ fontWeight: 700 }}>
              {t('download.title').replace('FreeBike', displayName)}
            </h2>
            <p className="text-xl text-green-50 mb-8">
              {t('download.subtitle').replace('FreeBike', displayName)}
            </p>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                </div>
                <div className="text-white">{t('download.features.0')}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                </div>
                <div className="text-white">{t('download.features.1')}</div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <div className="w-2 h-2 bg-green-600 rounded-full" />
                </div>
                <div className="text-white">{t('download.features.2')}</div>
              </div>
            </div>

            {/* Download Buttons */}
            <div className="flex flex-col sm:flex-row gap-4">
              {downloadUrl ? (
                <Button
                  size="lg"
                  onClick={handleDownloadAPK}
                  className="bg-black hover:bg-gray-900 bg-transparent hover:bg-transparent text-white px-6 py-6"
                  aria-label="Download APK"
                >
                  <img 
                    src={googlePlayBadgeUrl}
                    alt="Get it on Google Play"
                    className="h-16"
                  />
                </Button>
              ) : (
                <>
                  <Button
                    size="lg"
                    onClick={onNavigateToMobile}
                    className="bg-black hover:bg-gray-900 bg-transparent hover:bg-transparent text-white px-6 py-6"
                    aria-label="Download on the App Store"
                  >
                    <img 
                      src={appStoreBadgeUrl}
                      alt="Download on the App Store"
                      className="h-12"
                    />
                  </Button>
                  
                  <Button
                    size="lg"
                    onClick={onNavigateToMobile}
                    className="bg-black hover:bg-gray-900 bg-transparent hover:bg-transparent text-white px-6 py-6"
                    aria-label="Get it on Google Play"
                  >
                    <img 
                      src={googlePlayBadgeUrl}
                      alt="Get it on Google Play"
                      className="h-16"
                    />
                  </Button>
                </>
              )}
            </div>

            {/* QR Code Info */}
            <div className="mt-8 p-4 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
              <p className="text-green-50 text-sm">
                {t('download.qrInfo')}
              </p>
            </div>
          </div>

          {/* Right Content - Phone Mockup */}
          <div className="relative">
            <div className="relative mx-auto max-w-sm">
              <div className="bg-white rounded-3xl shadow-2xl p-4">
                <ImageWithFallback
                  src="https://images.unsplash.com/photo-1614020661483-d2bb855eee1d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2JpbGUlMjBhcHAlMjBwaG9uZXxlbnwxfHx8fDE3NTkyMjUzMTZ8MA&ixlib=rb-4.1.0&q=80&w=1080"
                  alt={`${displayName} Mobile App`}
                  className="w-full rounded-2xl"
                />
              </div>
              
              {/* Floating Badge */}
              <div className="absolute -top-4 -right-4 bg-yellow-400 text-gray-900 px-4 py-2 rounded-full shadow-lg" style={{ fontWeight: 600 }}>
                {t('download.badge')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}