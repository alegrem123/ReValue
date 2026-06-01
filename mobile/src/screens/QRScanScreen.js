import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../theme/colors';

export function QRScanScreen({ onSuccess, onBack }) {
  const [codice, setCodice]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function valida() {
    if (!codice.trim()) { setError('Inserisci il codice QR.'); return; }
    setLoading(true);
    setError('');
    const res = await api.post('/api/v1/qr/valida', { codice: codice.trim() });
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Codice non valido o scaduto.'); return; }
    const crediti = res.data?.creditiAssegnati ?? 50;
    const prenotazioneId = res.data?.prenotazione ?? null;
    onSuccess(crediti, prenotazioneId);
  }

  return (
    <Screen
      title="Scansiona QR"
      subtitle="Inserisci il codice mostrato dal donatore per certificare il ritiro fisico."
      right={<Button title="Indietro" variant="secondary" onPress={onBack} />}
    >
      <View style={styles.card}>
        <TextField
          label="Codice QR"
          value={codice}
          onChangeText={setCodice}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Incolla o digita il codice..."
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Valida codice" onPress={valida} loading={loading} />
      </View>

      <View style={styles.hint}>
        <Text style={styles.hintText}>
          Chiedi al donatore di aprire il QR dalla prenotazione ricevuta, poi inserisci il codice mostrato.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
  hint: {
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
    padding: 14,
  },
  hintText: {
    color: colors.greenDark,
    lineHeight: 20,
    fontSize: 13,
  },
});
