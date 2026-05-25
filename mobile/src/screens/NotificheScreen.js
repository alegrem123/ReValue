import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

const POLL_INTERVAL_MS = 30_000;

export function NotificheScreen({ onBack }) {
  const [notifiche, setNotifiche] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const pollRef                   = useRef(null);

  const loadNotifiche = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError('');
    const res = await api.get('/api/v1/notifiche/me');
    if (!silent) setLoading(false);
    if (!res.ok) {
      setError(res.error || 'Impossibile caricare le notifiche.');
      return;
    }
    setNotifiche(res.data?.notifiche ?? res.data?.data ?? res.data ?? []);
  }, []);

  useEffect(() => {
    loadNotifiche();
    pollRef.current = setInterval(() => loadNotifiche(true), POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [loadNotifiche]);

  async function marcaLetta(id) {
    await api.patch(`/api/v1/notifiche/${id}/letta`, {});
    setNotifiche((prev) =>
      prev.map((n) => (n._id === id ? { ...n, letta: true } : n))
    );
  }

  const nonLette = notifiche.filter((n) => !n.letta).length;

  return (
    <Screen
      title="Notifiche"
      subtitle={nonLette > 0 ? `${nonLette} non lette` : 'Tutto aggiornato'}
      right={onBack ? <Button title="Chiudi" variant="secondary" onPress={onBack} /> : null}
    >
      {error ? (
        <View style={styles.notice}>
          <Text style={styles.errorText}>{error}</Text>
          <Button title="Riprova" variant="secondary" onPress={() => loadNotifiche()} />
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={() => loadNotifiche()} />
        }
      >
        {loading && notifiche.length === 0 ? (
          <ActivityIndicator color={colors.green} style={{ marginTop: 32 }} />
        ) : null}
        {!loading && notifiche.length === 0 && !error ? (
          <Text style={styles.empty}>Nessuna notifica.</Text>
        ) : null}
        {notifiche.map((n) => (
          <NotificaRow key={n._id} notifica={n} onRead={() => marcaLetta(n._id)} />
        ))}
      </ScrollView>
    </Screen>
  );
}

function NotificaRow({ notifica, onRead }) {
  const unread = !notifica.letta;

  return (
    <View style={[styles.row, unread && styles.rowUnread]}>
      <View style={styles.rowContent}>
        <View style={styles.rowHeader}>
          <Text style={styles.tipo}>{labelTipo(notifica.tipo)}</Text>
          {unread && <View style={styles.dot} />}
        </View>
        <Text style={styles.testo}>{notifica.testo}</Text>
        <Text style={styles.data}>{fmtDate(notifica.data || notifica.createdAt)}</Text>
      </View>
      {unread ? (
        <Button title="✓" variant="secondary" onPress={onRead} />
      ) : null}
    </View>
  );
}

function labelTipo(tipo) {
  const map = {
    messaggio:    '💬 Messaggio',
    prenotazione: '📅 Prenotazione',
    scambio:      '🔄 Scambio',
    segnalazione: '🚨 Segnalazione',
    sistema:      'ℹ️ Sistema',
  };
  return map[tipo] || tipo || 'Notifica';
}

function fmtDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const styles = StyleSheet.create({
  list: {
    gap: 10,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  rowUnread: {
    borderColor: colors.green,
    backgroundColor: colors.greenXLight,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipo: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.greenDark,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  testo: {
    color: colors.text,
    lineHeight: 20,
    fontSize: 14,
  },
  data: {
    color: colors.muted,
    fontSize: 12,
  },
  notice: {
    gap: 8,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 32,
  },
  errorText: {
    color: colors.danger,
    fontWeight: '700',
  },
});
