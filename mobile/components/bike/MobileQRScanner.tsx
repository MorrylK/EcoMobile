/* eslint-disable @typescript-eslint/no-unused-vars */
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Text } from '@/components/ui/Text';
import { toast } from '@/components/ui/Toast';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { bikeService } from '@/services/bikeService';
import type { Bike } from '@/services/bikeService';
import { getGlobalStyles } from '@/styles/globalStyles';
import { haptics } from '@/utils/haptics';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Hash, ScanLine, Type, Zap } from 'lucide-react-native';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';

interface MobileQRScannerProps {
  onBikeFound: (bike: Bike) => void;
  onBack: () => void;
}

export function MobileQRScanner({ onBikeFound, onBack }: MobileQRScannerProps) {
  const { t, language } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const [manualCode, setManualCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [activeTab, setActiveTab] = useState('scan');
  const [isSearching, setIsSearching] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const handleScan = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        toast.error(t('qr.cameraPermissionDenied'));
        return;
      }
    }
    setScanned(false);
    setIsScanning(true);
    haptics.light();
  };

  const handleBarcodeScanned = async ({ data }: { type: string; data: string }) => {
    if (scanned || isSearching) return;
    setScanned(true);
    setIsScanning(false);

    try {
      setIsSearching(true);
      const bike = await bikeService.getBikeByCode(data.trim());

      if (bike.status === 'AVAILABLE') {
        haptics.success();
        toast.success(t('qr.bikeFound'));
        onBikeFound(bike);
      } else {
        haptics.error();
        toast.error(t('qr.bikeUnavailable'));
      }
    } catch (error) {
      haptics.error();
      toast.error(t('qr.invalidCode'));
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSubmit = async () => {
    if (!manualCode.trim()) {
      toast.error(t('qr.enterCode'));
      return;
    }

    try {
      setIsSearching(true);
      const bike = await bikeService.getBikeByCode(manualCode.trim());

      if (bike.status === 'AVAILABLE') {
        haptics.success();
        toast.success(t('qr.bikeFound'));
        onBikeFound(bike);
      } else {
        haptics.error();
        toast.error(t('qr.bikeUnavailable'));
      }
    } catch (error) {
      haptics.error();
      toast.error(t('qr.invalidCode'));
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <MobileHeader title={t('qr.title')} showBack onBack={onBack} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContentPadded, { gap: 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList style={{ marginBottom: 24 }}>
            <TabsTrigger value="scan" style={styles.row}>
              <ScanLine size={18} color={colors.text} />
              <Text style={styles.ml8}>
                {t('qr.scan')}
              </Text>
            </TabsTrigger>
            <TabsTrigger value="manual" style={styles.row}>
              <Type size={18} color={colors.text} />
              <Text style={styles.ml8}>
                {t('qr.manual')}
              </Text>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scan" style={{ gap: 24 }}>
            <View
              style={[
                {
                  aspectRatio: 1,
                  backgroundColor: '#111827',
                  overflow: 'hidden'
                },
                styles.alignCenter,
                styles.justifyCenter,
                styles.rounded12
              ]}
            >
              {isScanning ? (
                <CameraView
                  style={StyleSheet.absoluteFillObject}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={handleBarcodeScanned}
                >
                  <View style={[StyleSheet.absoluteFillObject, styles.alignCenter, styles.justifyCenter]}>
                    <View
                      style={{
                        width: 200,
                        height: 200,
                        borderWidth: 2,
                        borderColor: '#10b981',
                        borderRadius: 12
                      }}
                    />
                    <Text color="white" size="sm" style={[styles.textCenter, { marginTop: 16 }]}>
                      {t('qr.instructions')}
                    </Text>
                  </View>
                </CameraView>
              ) : (
                <View style={[styles.alignCenter, { gap: 16, padding: 32 }]}>
                  <ScanLine size={64} color="#9ca3af" />
                  <Text
                    color="#9ca3af"
                    style={[styles.textCenter, { lineHeight: 20 }]}
                    size="md"
                  >
                    {t('qr.tapToScan')}
                  </Text>
                </View>
              )}
            </View>

            <Button
              onPress={isScanning ? () => setIsScanning(false) : handleScan}
              variant="primary"
              fullWidth
              style={{ height: 56 }}
            >
              <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
                <ScanLine size={20} color="white" />
                <Text style={styles.ml8} color="white" size="lg">
                  {isScanning ? t('qr.stopScanning') : t('qr.startScanning')}
                </Text>
              </View>
            </Button>
          </TabsContent>

          <TabsContent value="manual" style={{ gap: 24 }}>
            <View style={[styles.card, { padding: 24 }]}>
              <View style={{ gap: 24 }}>
                <View style={{ gap: 12 }}>
                  <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={styles.textCenter}>
                    {t('qr.bikeCode')}
                  </Text>
                  <Input
                    value={manualCode}
                    onChangeText={setManualCode}
                    placeholder="BIKE001"
                    style={{
                      height: 56,
                      fontSize: 18,
                      textAlign: 'center',
                      letterSpacing: 2
                    }}
                  />
                </View>

                <Button
                  onPress={handleManualSubmit}
                  disabled={isSearching || !manualCode.trim()}
                  variant="primary"
                  fullWidth
                  style={{ height: 56 }}
                >
                  <View style={[styles.row, styles.gap4, styles.alignCenter, styles.justifyCenter]}>
                    <Zap size={20} color="white" />
                    <Text style={styles.ml8} color="white" size="lg">
                      {isSearching ? t('common.loading') : t('common.confirm')}
                    </Text>
                  </View>
                </Button>
              </View>
            </View>

            <View style={[styles.card, { padding: 20, backgroundColor: colorScheme === 'light' ? '#f9fafb' : '#374151' }]}>
              <Text variant="body" color={colorScheme === 'light' ? '#111827' : '#f9fafb'} style={{ marginBottom: 16, textAlign: 'center' }}>
                {t('qr.howToFind')}
              </Text>
              <View style={{ gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Hash size={18} color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} />
                  <Text size="md" color={colorScheme === 'light' ? '#6b7280' : '#9ca3af'} style={{ flex: 1 }}>
                    {t('qr.findSticker')}
                  </Text>
                </View>
              </View>
            </View>
          </TabsContent>
        </Tabs>
      </ScrollView>
    </View>
  );
}
