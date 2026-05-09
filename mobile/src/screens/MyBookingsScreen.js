import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

const STATO_LABEL = {
  ATTIVA:     'Attiva',
  COMPLETATA: 'Completata',
  ANNULLATA:  'Annullata',
};

const STATO_COLOR = {
  ATTIVA:     colors.green,
  COMPLETATA: '#1565C0',
  ANNULLATA:  colors.danger,
};

function formatDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

function entroQuindiciMinuti(dataPrenotazione) {
  return Date.now() - new Date(dataPrenotazione).getTime() <= 15 * 60 * 1000;
}

export function MyBookingsScreen({ onOpenQRDisplay, onOpenQRScan }) {
  const [bookings, setBookings]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [filter, setFilter]       = useState('');
  const [error, setError]         = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await api.get('/api/prenotazioni/me');
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Impossibile caricare le prenotazioni.'); return; }
    setBookings(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function annulla(id) {
    Alert.alert('Annulla prenotazione', 'Sei sicuro? Puoi annullare solo entro 15 minuti.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Sì, annulla',
        style: 'destructive',
        onPress: async () => {
          const res = await api.delete(`/api/prenotazioni/${id}`);
          if (!res.ok) { Alert.alert('Errore', res.error || 'Impossibile annullare.'); return; }
          setBookings((prev) => prev.map((b) => b._id === id ? { ...b, stato: 'ANNULLATA' } : b));
        },
      },
    ]);
  }

  const visible = filter ? bookings.filter((b) => b.stato === filter) : bookings;

  return (
    <Screen title="Prenotazioni" subtitle="Le tue prenotazioni come acquirente." scroll={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.filters}>
        {['', 'ATTIVA', 'COMPLETATA', 'ANNULLATA'].map((s) => (
          <Button
            key={s || 'all'}
            title={STATO_LABEL[s] || 'Tutte'}
            variant={filter === s ? 'primary' : 'secondary'}
            onPress={() => setFilter(s)}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {!loading && visible.length === 0 ? (
          <Text style={styles.empty}>Nessuna prenotazione trovata.</Text>
        ) : null}

        {visible.map((b) => (
          <View key={b._id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.titolo}>{b.annuncio?.titolo || 'Annuncio rimosso'}</Text>
              <View style={[styles.badge, { backgroundColor: STATO_COLOR[b.stato] || colors.muted }]}>
                <Text style={styles.badgeText}>{STATO_LABEL[b.stato] || b.stato}</Text>
              </View>
            </View>

            <Text style={styles.meta}>
              Donatore: {b.donatore ? `${b.donatore.nome} ${b.donatore.cognome}` : '—'}
            </Text>
            <Text style={styles.meta}>{formatDate(b.dataPrenotazione)}</Text>

            {b.stato === 'ATTIVA' ? (
              <View style={styles.actions}>
                <Button
                  title="Mostra QR"
                  onPress={() => onOpenQRDisplay(b._id)}
                />
                <Button
                  title="Scansiona QR"
                  variant="secondary"
                  onPress={() => onOpenQRScan()}
                />
                {entroQuindiciMinuti(b.dataPrenotazione) ? (
                  <Button
                    title="Annulla"
                    variant="danger"
                    onPress={() => annulla(b._id)}
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  list: {
    gap: 12,
    paddingBottom: 112,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  titolo: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  actions: {
    gap: 8,
    marginTop: 4,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
  empty: {
    color: colors.muted,
    textAlign: 'center',
    marginTop: 24,
  },
});
