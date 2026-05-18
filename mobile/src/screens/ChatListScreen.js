import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { colors } from '../theme/colors';

function formatDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export function ChatListScreen({ onOpenChat }) {
  const [convs, setConvs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await api.get('/api/v1/conversazioni/me');
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Impossibile caricare le conversazioni.'); return; }
    setConvs(res.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <Screen title="Messaggi" subtitle="Chat con donatori e acquirenti." scroll={false}>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        {loading && convs.length === 0 ? <ActivityIndicator color={colors.green} /> : null}
        {!loading && convs.length === 0 && !error ? (
          <Text style={styles.empty}>Nessuna conversazione.</Text>
        ) : null}

        {convs.map((c) => {
          const altri = (c.partecipanti || []).filter((p) => p._id !== c._me);
          const nomeAltro = altri[0] ? `${altri[0].nome} ${altri[0].cognome}` : 'Utente';

          return (
            <View key={c._id} style={styles.card}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.nome}>{nomeAltro}</Text>
                  {c.ultimoMessaggio ? (
                    <Text style={styles.preview} numberOfLines={1}>
                      {c.ultimoMessaggio.testo}
                    </Text>
                  ) : (
                    <Text style={styles.preview}>Nessun messaggio</Text>
                  )}
                </View>
                <View style={styles.right}>
                  <Text style={styles.time}>{formatDate(c.ultimoMessaggio?.timestamp)}</Text>
                  {c.nonLetti > 0 ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{c.nonLetti}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Button
                title="Apri chat"
                variant="secondary"
                onPress={() => onOpenChat(c._id)}
              />
            </View>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 12, paddingBottom: 112 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 6 },
  nome: { fontWeight: '700', color: colors.text, fontSize: 15 },
  preview: { color: colors.muted, fontSize: 13 },
  time: { color: colors.muted, fontSize: 12 },
  badge: {
    backgroundColor: colors.green,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  error: { color: colors.danger, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 24 },
});
