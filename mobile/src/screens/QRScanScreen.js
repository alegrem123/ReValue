import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

function normalizeCreditiAccreditati(value) {
  if (value && typeof value === 'object') {
    return value.acquirente ?? value.donatore ?? 50;
  }
  return value ?? 50;
}

export function QRScanScreen({ onSuccess, onBack }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanned, setScanned] = useState(false);

  async function valida(codice) {
    if (loading || scanned) return;
    setScanned(true);
    setLoading(true);
    setError('');
    const res = await api.post('/api/v1/qr/valida', { codice });
    setLoading(false);
    if (!res.ok) {
      setScanned(false);
      setError(res.error || 'Codice non valido o scaduto.');
      return;
    }
    const crediti = normalizeCreditiAccreditati(res.data?.creditiAssegnati);
    const prenotazioneId = res.data?.prenotazione ?? null;
    onSuccess(crediti, prenotazioneId);
  }

  if (!permission) {
    return (
      <Screen title="Scansiona QR" right={<Button title="Indietro" variant="secondary" size="compact" onPress={onBack} />}>
        <Text style={styles.hintText}>Caricamento permessi fotocamera...</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen title="Scansiona QR" right={<Button title="Indietro" variant="secondary" size="compact" onPress={onBack} />}>
        <Text style={styles.hintText}>Serve il permesso fotocamera per scansionare il QR.</Text>
        <Button title="Abilita fotocamera" onPress={requestPermission} fullWidth />
      </Screen>
    );
  }

  return (
    <Screen title="Scansiona QR" right={<Button title="Indietro" variant="secondary" size="compact" onPress={onBack} />}>
      <View style={styles.scanner}>
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={scanned ? undefined : ({ data }) => valida(data)}
        />
      </View>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Button title="Scansiona di nuovo" size="compact" onPress={() => setScanned(false)} />
        </View>
      ) : null}
      {loading ? <Text style={styles.hintText}>Validazione in corso...</Text> : null}
      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Punta la fotocamera sul QR Code mostrato dal donatore per certificare il ritiro.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scanner: {
    height: 320,
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.green,
  },
  errorBox: {
    gap: 10,
    alignItems: 'center',
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
    textAlign: 'center',
  },
  hint: {
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    padding: 14,
  },
  hintText: {
    color: colors.greenDark,
    lineHeight: 20,
    fontSize: 13,
    textAlign: 'center',
  },
});
