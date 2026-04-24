import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateKind = 'native' | 'ota';
type UpdateState =
  | 'checking'
  | 'idle'
  | 'native_available'
  | 'ota_available'
  | 'downloading'
  | 'error';

interface AppVersionManifest {
  nativeVersion: string;
  minNativeVersion: string;
  apkUrl: string | null;
  changelog: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compare semver strings. Returns true if a > b. */
function semverGt(a: string, b: string): boolean {
  const parse = (s: string) => s.split('.').map(Number);
  const [aMaj, aMin, aPat] = parse(a);
  const [bMaj, bMin, bPat] = parse(b);
  if (aMaj !== bMaj) return aMaj > bMaj;
  if (aMin !== bMin) return aMin > bMin;
  return aPat > bPat;
}


const cacheDir = (FileSystem as any).cacheDirectory;
const API_BASE: string = (Constants.expoConfig?.extra?.apiUrl as string);

async function fetchVersionManifest(): Promise<AppVersionManifest | null> {
  try {
    const res = await fetch(`${API_BASE}/public/app-version`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json() as any;
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Vérifie au démarrage s'il existe une mise à jour :
 *  1. Mise à jour native (APK) — téléchargement automatique + installation
 *  2. Mise à jour OTA (JS bundle) — via expo-updates
 * Affiche un écran BLOQUANT tant que l'opération n'est pas terminée.
 * En mode développement, tout est ignoré.
 */
export function UpdateChecker() {
  const [state, setState] = useState<UpdateState>('checking');
  const [kind, setKind] = useState<UpdateKind | null>(null);
  const [progress, setProgress] = useState(0);          // 0–100
  const [errorMsg, setErrorMsg] = useState('');
  const [manifest, setManifest] = useState<AppVersionManifest | null>(null);
  const [showCheckingUI, setShowCheckingUI] = useState(false);
  const downloadRef = useRef<ReturnType<typeof FileSystem.createDownloadResumable> | null>(null);

  useEffect(() => {
    // Afficher le statut "Vérification" seulement si ça prend plus de 500ms
    const timer = setTimeout(() => {
      if (state === 'checking') setShowCheckingUI(true);
    }, 500);

    // En mode dev, on skip tout (sauf si Updates.isEnabled est forcé)
    if (__DEV__ || !Updates.isEnabled) {
      setState('idle');
      clearTimeout(timer);
      return;
    }

    void checkForUpdates().finally(() => {
      clearTimeout(timer);
    });
  }, []);

  // ── Orchestration principale ─────────────────────────────────────────────

  const checkForUpdates = async () => {
    // 1) Vérifier la version native
    const currentNative: string =
      (Constants.expoConfig?.extra?.nativeVersion as string) ?? '1.0.0';

    const versionManifest = await fetchVersionManifest();

    if (versionManifest?.apkUrl && Platform.OS === 'android') {
      const serverMin = versionManifest.minNativeVersion ?? versionManifest.nativeVersion;
      if (semverGt(serverMin, currentNative)) {
        // Mise à jour native obligatoire
        setManifest(versionManifest);
        setKind('native');
        setState('native_available');
        return;
      }
    }

    // 2) Vérifier OTA (JS bundle)
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        setKind('ota');
        setState('ota_available');
      } else {
        setState('idle');
      }
    } catch {
      // Serveur OTA injoignable → ne pas bloquer
      setState('idle');
    }
  };

  // ── Mise à jour native (APK) ─────────────────────────────────────────────

  const handleNativeUpdate = async () => {
    if (!manifest?.apkUrl) return;

    setState('downloading');
    setProgress(0);
    setErrorMsg('');

    const localUri = (cacheDir ?? '') + 'ecomobile_update.apk';

    try {
      // Supprimer un éventuel APK précédent
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) await FileSystem.deleteAsync(localUri, { idempotent: true });

      // Téléchargement avec suivi de progression
      downloadRef.current = FileSystem.createDownloadResumable(
        manifest.apkUrl,
        localUri,
        {},
        ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
          if (totalBytesExpectedToWrite > 0) {
            setProgress(Math.round((totalBytesWritten / totalBytesExpectedToWrite) * 100));
          }
        }
      );

      const result = await downloadRef.current.downloadAsync();
      if (!result?.uri) throw new Error('Téléchargement échoué');

      // Obtenir l'URI de contenu Android (nécessaire pour installer un APK)
      const contentUri = await FileSystem.getContentUriAsync(result.uri);

      // Lancer l'installateur Android automatiquement
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        type: 'application/vnd.android.package-archive',
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      });

      // L'utilisateur voit le dialogue d'installation natif Android
      // Si il annule, on revient à l'écran d'update pour qu'il puisse réessayer
      setState('native_available');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Erreur lors du téléchargement');
      setState('error');
    }
  };

  // ── Mise à jour OTA ──────────────────────────────────────────────────────

  const handleOtaUpdate = async () => {
    setState('downloading');
    setErrorMsg('');
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      // reloadAsync redémarre le bundle — le code suivant n'est jamais atteint
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Erreur lors de la mise à jour');
      setState('error');
    }
  };

  // ── Handler bouton ───────────────────────────────────────────────────────

  const handleAction = async () => {
    if (kind === 'native') {
      await handleNativeUpdate();
    } else if (kind === 'ota') {
      await handleOtaUpdate();
    }
  };

  // ── Rendu ────────────────────────────────────────────────────────────────

  if (state === 'idle') return null;
  
  if (state === 'checking') {
    if (!showCheckingUI) return null;
    return (
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator color="#16a34a" size="large" />
          <Text style={[styles.title, { marginTop: 20 }]}>
            Vérification des mises à jour...
          </Text>
        </View>
      </View>
    );
  }

  const isNative = kind === 'native';
  const isDownloading = state === 'downloading';
  const isError = state === 'error';

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        {/* Icône */}
        <View style={styles.iconCircle}>
          <Text style={styles.iconArrow}>{isNative ? '⬇' : '↑'}</Text>
        </View>

        {/* Titre */}
        <Text style={styles.title}>
          {isNative ? 'Mise à jour requise' : 'Nouvelle version disponible'}
        </Text>

        {/* Description */}
        <Text style={styles.description}>
          {isNative
            ? "Une nouvelle version de l'application est disponible. Elle sera téléchargée et installée automatiquement."
            : "Une mise à jour du contenu est disponible. Vos données sont conservées."}
        </Text>

        {/* Changelog natif */}
        {isNative && manifest?.changelog ? (
          <Text style={styles.changelog}>{manifest.changelog}</Text>
        ) : null}

        {/* Note données OTA */}
        {!isNative && (
          <Text style={styles.dataNotice}>
            Vos données (trajets, solde, paramètres) sont conservées lors d'une mise à jour.
          </Text>
        )}

        {/* Erreur */}
        {isError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Progression du téléchargement */}
        {isDownloading ? (
          <View style={styles.progressContainer}>
            {isNative ? (
              <>
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {progress < 100 ? `Téléchargement… ${progress}%` : 'Installation en cours…'}
                </Text>
              </>
            ) : (
              <View style={styles.progressRow}>
                <ActivityIndicator color="#16a34a" size="small" />
                <Text style={styles.progressText}>Téléchargement en cours…</Text>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleAction} activeOpacity={0.85}>
            <Text style={styles.buttonText}>
              {isError
                ? 'Réessayer'
                : isNative
                  ? 'Télécharger et installer'
                  : 'Mettre à jour maintenant'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Mention obligatoire pour mise à jour native */}
        {isNative && !isDownloading && (
          <Text style={styles.mandatoryNote}>
            Cette mise à jour est obligatoire pour continuer à utiliser l'application.
          </Text>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: '#f0fdf4',
    zIndex: 9999,
    elevation: 999,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#dcfce7',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
  },
  iconArrow: { fontSize: 32, color: '#16a34a', fontWeight: '700' },
  title: {
    fontSize: 20, fontWeight: '700', color: '#111827',
    textAlign: 'center', marginBottom: 12,
  },
  description: {
    fontSize: 14, color: '#374151',
    textAlign: 'center', lineHeight: 22, marginBottom: 12,
  },
  changelog: {
    fontSize: 13, color: '#6b7280', fontStyle: 'italic',
    textAlign: 'center', lineHeight: 20, marginBottom: 12,
    backgroundColor: '#f9fafb', borderRadius: 8, padding: 10, width: '100%',
  },
  dataNotice: {
    fontSize: 12, color: '#6b7280',
    textAlign: 'center', lineHeight: 18, marginBottom: 24, fontStyle: 'italic',
  },
  errorBox: {
    backgroundColor: '#fee2e2', borderRadius: 8,
    padding: 12, marginBottom: 16, width: '100%',
  },
  errorText: { fontSize: 13, color: '#dc2626', textAlign: 'center' },
  progressContainer: { width: '100%', marginBottom: 8 },
  progressBar: {
    height: 8, backgroundColor: '#d1fae5', borderRadius: 4,
    overflow: 'hidden', marginBottom: 8,
  },
  progressFill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 4 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  progressText: { fontSize: 14, color: '#6b7280', textAlign: 'center' },
  button: {
    backgroundColor: '#16a34a', borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32,
    width: '100%', alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  mandatoryNote: {
    fontSize: 11, color: '#9ca3af', textAlign: 'center',
    marginTop: 16, lineHeight: 16,
  },
});
