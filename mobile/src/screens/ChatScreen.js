import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { api, getStoredUser } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
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
  const flatRef = useRef(null);
  const pollRef = useRef(null);

  const load = useCallback(async () => {
    const res = await api.get(`/api/conversazioni/${conversazioneId}/messaggi?limit=50`);
    if (!res.ok) return;
    const lista = res.data?.data?.messaggi || res.data?.messaggi || [];
    setMessaggi(lista);
  }, [conversazioneId]);

  useEffect(() => {
    async function init() {
      setLoading(true);
      const user = await getStoredUser();
      if (user) setMyId(user._id || user.id);
      await load();
      setLoading(false);
    }
    init();
    // Polling ogni 5s (RNF7: latenza 1-3s in condizioni normali)
    pollRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(pollRef.current);
  }, [load]);

  async function invia() {
    if (!testo.trim()) return;
    setSending(true);
    const res = await api.post(`/api/conversazioni/${conversazioneId}/messaggi`, { testo });
    setSending(false);
    if (!res.ok) return;
    setTesto('');
    await load();
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  }

  function isMio(msg) {
    const mid = msg.mittente?._id || msg.mittente;
    return mid?.toString() === myId?.toString();
  }

  return (
    <Screen
      title="Chat"
      right={<Button title="Indietro" variant="secondary" onPress={onBack} />}
      scroll={false}
    >
      {loading ? <ActivityIndicator color={colors.green} /> : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={120}
      >
        <FlatList
          ref={flatRef}
          data={messaggi}
          keyExtractor={(m) => m._id || m.timestamp}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mio = isMio(item);
            return (
              <View style={[styles.bubble, mio ? styles.bubbleMio : styles.bubbleAltro]}>
                <Text style={[styles.bubbleText, mio && styles.bubbleTextMio]}>
                  {item.testo}
                </Text>
                <Text style={[styles.bubbleTime, mio && styles.bubbleTimeMio]}>
                  {formatTime(item.timestamp)}
                </Text>
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
            <Text style={styles.sendBtnText}>{'→'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messageList: { gap: 10, paddingBottom: 12 },
  bubble: {
    maxWidth: '80%',
    borderRadius: 14,
    padding: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: 'flex-start',
    gap: 3,
  },
  bubbleMio: {
    alignSelf: 'flex-end',
    backgroundColor: colors.green,
    borderColor: colors.green,
  },
  bubbleText: { color: colors.text, lineHeight: 20 },
  bubbleTextMio: { color: '#fff' },
  bubbleTime: { fontSize: 11, color: colors.muted, alignSelf: 'flex-end' },
  bubbleTimeMio: { color: 'rgba(255,255,255,0.7)' },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-end',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: colors.surface,
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
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
