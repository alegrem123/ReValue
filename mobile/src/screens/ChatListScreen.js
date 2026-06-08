import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, getUserId } from '../api/client';
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

function conversationTime(conv) {
  return new Date(conv.ultimoMessaggio?.timestamp || conv.updatedAt || conv.createdAt || 0).getTime();
}

function dedupeConversations(convs, myId) {
  const byKey = new Map();
  convs.forEach((conv) => {
    const altri = (conv.partecipanti || []).filter((p) => p._id !== myId).map((p) => p._id).sort();
    const annuncioId = conv.prenotazione?.annuncio?._id || conv.prenotazione?.annuncio || conv.annuncio?._id || '';
    const key = `${altri.join('-') || conv._id}:${annuncioId}`;
    const previous = byKey.get(key);
    if (!previous || conversationTime(conv) > conversationTime(previous)) {
      byKey.set(key, conv);
    }
  });
  return Array.from(byKey.values()).sort((a, b) => conversationTime(b) - conversationTime(a));
}

export function ChatListScreen({ onOpenChat }) {
  const [convs, setConvs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [myId, setMyId]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const res = await api.get('/api/v1/conversazioni/me');
    setLoading(false);
    if (!res.ok) { setError(res.error || 'Impossibile caricare le conversazioni.'); return; }
    setConvs(res.data || []);
  }, []);

  useEffect(() => { load(); getUserId().then(setMyId); }, [load]);

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

        {dedupeConversations(convs, myId).map((c) => {
          const altri = (c.partecipanti || []).filter((p) => p._id !== myId);
          const nomeAltro = altri[0] ? `${altri[0].nome} ${altri[0].cognome}` : 'Utente';
          const annuncio = c.prenotazione?.annuncio?.titolo || c.annuncio?.titolo || '';

          return (
            <Pressable key={c._id} onPress={() => onOpenChat(c._id)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.nome}>{nomeAltro}</Text>
                  {annuncio ? <Text style={styles.annuncio} numberOfLines={1}>{annuncio}</Text> : null}
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
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10, paddingBottom: 112 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  cardPressed: { opacity: 0.75 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  flex: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 6 },
  nome: { fontWeight: '700', color: colors.text, fontSize: 15 },
  annuncio: { color: colors.greenDark, fontSize: 12, fontWeight: '700' },
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
