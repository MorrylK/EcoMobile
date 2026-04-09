import React from 'react';
import { View, TouchableOpacity, Linking } from 'react-native';
import { ShieldAlert, LogOut, Phone, MessageSquare } from 'lucide-react-native';
import { Text } from '../ui/Text';
import { Button } from '../ui/Button';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getGlobalStyles } from '@/styles/globalStyles';
import { useMobileI18n } from '@/lib/mobile-i18n';
import { authService } from '@/services/authService';
import { useRouter } from 'expo-router';

export function MobileBlocked() {
  const { t } = useMobileI18n();
  const colorScheme = useColorScheme();
  const styles = getGlobalStyles(colorScheme);
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];
  const router = useRouter();

  const handleLogout = async () => {
    await authService.logout();
    router.replace('/(auth)/login');
  };

  const handleCallSupport = () => {
    Linking.openURL('tel:+237690601186'); // Numéro à adapter
  };

  const handleWhatsAppSupport = () => {
    Linking.openURL('whatsapp://send?phone=+237690601186&text=Bonjour, mon compte EcoMobile est bloqué.');
  };

  return (
    <View style={[styles.flex1, styles.alignCenter, styles.justifyCenter, styles.px24, { backgroundColor: colors.background }]}>
      <View style={[styles.p24, styles.roundedFull, { backgroundColor: '#fee2e2', marginBottom: 32 }]}>
        <ShieldAlert size={80} color="#dc2626" />
      </View>

      <Text variant="title" style={[styles.textCenter, styles.mb16, { color: '#dc2626' }]}>
        {t('auth.accountBlocked') || 'Compte bloqué !'}
      </Text>

      <Text variant="body" style={[styles.textCenter, styles.mb32, { color: colors.text, fontSize: 16, lineHeight: 24 }]}>
        {t('auth.blockedMessage') || 'Votre compte a été suspendu par un administrateur. Veuillez contacter le support technique pour résoudre ce problème.'}
      </Text>

      <View style={[styles.card, styles.p20, styles.mb32, { width: '100%', borderColor: '#f87171', borderWidth: 1, backgroundColor: colorScheme === 'dark' ? '#450a0a' : '#fef2f2' }]}>
        <Text variant="body" weight="semibold" style={[styles.mb12, { color: colors.text }]}>
          {t('auth.howToUnblock') || 'Comment débloquer votre compte ?'}
        </Text>
        <Text variant="caption" style={{ color: colors.text, lineHeight: 20 }}>
          {t('auth.unblockInstructions') || 'Contactez notre service client via les canaux ci-dessous en précisant votre adresse e-mail ou votre numéro de téléphone.'}
        </Text>
      </View>

      <View style={[styles.gap12, { width: '100%' }]}>
        <Button 
          variant="primary" 
          onPress={handleCallSupport}
          style={{ backgroundColor: '#16a34a' }}
        >
          <View style={[styles.row, styles.alignCenter, styles.gap8]}>
            <Phone size={20} color="white" />
            <Text color="white" weight="semibold">Appeler le support</Text>
          </View>
        </Button>

        <Button 
          variant="outline" 
          onPress={handleWhatsAppSupport}
          style={{ borderColor: '#25d366' }}
        >
          <View style={[styles.row, styles.alignCenter, styles.gap8]}>
            <MessageSquare size={20} color="#25d366" />
            <Text style={{ color: '#25d366' }} weight="semibold">WhatsApp Support</Text>
          </View>
        </Button>

        <TouchableOpacity 
          onPress={handleLogout}
          style={[styles.mt24, styles.row, styles.alignCenter, styles.justifyCenter, styles.gap8]}
        >
          <LogOut size={20} color={colors.text} />
          <Text style={{ color: colors.text }} weight="medium">
            Se déconnecter
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
