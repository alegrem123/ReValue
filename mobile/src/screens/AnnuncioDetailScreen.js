import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { formatDate } from '../components/AnnuncioCard';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

const PLACEHOLDER = 'https://via.placeholder.com/720x420/ced4da/6c757d?text=RE-VALUE';

export function AnnuncioDetailScreen({ id, onBack }) {
  const [annuncio, setAnnuncio] = useState(null);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      const response = await api.get(`/api/v1/annunci/${encodeURIComponent(id)}`);
      setLoading(false);

      if (!response.ok) {
        setError(response.error || "Impossibile caricare l'annuncio.");
        return;
      }
      setAnnuncio(response.data);
    }

    load();
  }, [id]);

  async function prenota() {
    setBooking(true);
    const response = await api.post('/api/v1/prenotazioni', { annuncioId: id });
    setBooking(false);

    if (!response.ok) {
      Alert.alert('Prenotazione non riuscita', response.error || 'Riprova piu tardi.');
      return;
    }
    Alert.alert('Prenotazione confermata', 'Trovi la prenotazione nella tua area personale.');
  }

  return (
    <Screen title="Dettaglio annuncio" right={<Button title="Indietro" onPress={onBack} variant="secondary" />}>
      {loading ? <ActivityIndicator color={colors.green} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {annuncio ? (
        <View style={styles.card}>
          <Image source={{ uri: annuncio.oggetto?.foto?.[0] || PLACEHOLDER }} style={styles.image} />
          <View style={styles.body}>
            <Text style={styles.title}>{annuncio.titolo || 'Annuncio senza titolo'}</Text>
            <Text style={styles.meta}>Donatore: {annuncio.donatore?.nome || 'Utente'}</Text>
            <Text style={styles.description}>{annuncio.oggetto?.descrizione || 'Nessuna descrizione.'}</Text>
            <View style={styles.grid}>
              <Info label="Categoria" value={annuncio.oggetto?.categoria} />
              <Info label="Materiale" value={annuncio.oggetto?.materiale} />
              <Info label="Dimensione" value={annuncio.oggetto?.dimensioni} />
              <Info label="Scadenza" value={formatDate(annuncio.dataScadenza)} />
              <Info
                label="Posizione"
                value={
                  annuncio.latitudine != null && annuncio.longitudine != null
                    ? `${Number(annuncio.latitudine).toFixed(4)}, ${Number(annuncio.longitudine).toFixed(4)}`
                    : 'Non disponibile'
                }
              />
            </View>
            <Button
              title={annuncio.stato === 'DISPONIBILE' ? 'Prenota annuncio' : `Stato: ${annuncio.stato}`}
              onPress={prenota}
              loading={booking}
              disabled={annuncio.stato !== 'DISPONIBILE'}
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

function Info({ label, value }) {
  return (
    <View style={styles.info}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || 'Non indicato'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: {
    width: '100%',
    height: 230,
    backgroundColor: colors.border,
  },
  body: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    color: colors.muted,
  },
  description: {
    color: colors.text,
    lineHeight: 21,
  },
  grid: {
    gap: 10,
  },
  info: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 8,
  },
  infoLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  infoValue: {
    color: colors.text,
    marginTop: 2,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
