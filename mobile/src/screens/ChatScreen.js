import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { api, getUserId } from '../api/client';
import { colors } from '../theme/colors';

const POLL_MS = 5000;

function formatTime(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', { hour: '2-digit', minute: '2-digit' }).format(d);
}

export function ChatScreen({ conversazioneId, onBack }) {
  const [messaggi, setMessaggi] = useState([]);
  const [testo, setTesto]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [myId, setMyId]         = useState(null);
  const myIdRef                 = useRef(null);
  const flatRef                 = useRef(null);
  const pollRef                 = useRef(null);

  const load = useCallback(async () => {
    const res = await api.get(`/api/v1/conversazioni/${conversazioneId}/messaggi?limit=50`);
    if (!res.ok) return;
    const lista = res.data?.data?.messaggi || res.data?.messaggi || [];
    setMessaggi(lista);
    const currentId = myIdRef.current;
    const unread = lista.filter((m) => {
      const mid = m.mittente?._id || m.mittente;
      return mid?.toString() !== currentId?.toString() && !m.letto && m._id;
    });
    if (unread.length > 0) {
      Promise.all(unread.map((m) => api.patch(`/api/v1/messaggi/${m._id}/letto`, {}))).catch(() => {});
    }
  }, [conversazioneId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const id = await getUserId();
      if (id) { myIdRef.current = id; setMyId(id); }
      await load();
      setLoading(false);
    }
    init();
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  async function invia() {
    if (!testo.trim()) return;
    setSending(true);
    const res = await api.post(`/api/v1/conversazioni/${conversazioneId}/messaggi`, { testo });
    setSending(false);
    if (!res.ok) return;
    setTesto('');
    await load();
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function isMio(msg) {
    const mid = msg.mittente?._id || msg.mittente;
    const id = myIdRef.current || myId;
    return mid?.toString() === id?.toString();
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chat</Text>
      </View>

      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.green} />
        </View>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        <FlatList
          ref={flatRef}
          data={messaggi}
          keyExtractor={(m) => m._id || String(m.timestamp)}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mio = isMio(item);
            return (
              <View style={[styles.bubble, mio ? styles.bubbleMio : styles.bubbleAltro]}>
                <Text style={styles.bubbleText}>{item.testo}</Text>
                <View style={styles.bubbleFooter}>
                  <Text style={styles.bubbleTime}>{formatTime(item.timestamp)}</Text>
                  {mio ? (
                    <Text style={[styles.tick, item.letto ? styles.tickLetto : styles.tickInviato]}>
                      ✓✓
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          }}
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={testo}
            onChangeText={setTesto}
            placeholder="Scrivi un messaggio..."
            placeholderTextColor={colors.muted}
            multiline
            returnKeyType="send"
            onSubmitEditing={invia}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!testo.trim() || sending) && styles.sendBtnDisabled]}
            onPress={invia}
            disabled={!testo.trim() || sending}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  loadingWrap: {
    paddingVertical: 8,
    alignItems: 'center',
  },

  // Messages
  messageList: {
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingBottom: 16,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#dee2e6',
    alignSelf: 'flex-start',
  },
  bubbleMio: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  bubbleAltro: {
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  bubbleTime: {
    fontSize: 11,
    color: colors.muted,
  },
  tick: { fontSize: 12, fontWeight: '700' },
  tickInviato: { color: colors.muted },
  tickLetto:   { color: colors.green },

  // Input
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.cream,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.35 },
});
