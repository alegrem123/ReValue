import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, setStoredUser, setToken } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { registerForPushNotificationsAsync } from '../services/pushRegistration';
import { colors } from '../theme/colors';

export function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    nome: '',
    cognome: '',
    email: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function submit() {
    setError('');
    setLoading(true);

    const endpoint = isRegister ? '/api/v1/auth/register' : '/api/v1/auth/login';
    const body = isRegister
      ? form
      : { email: form.email.trim(), password: form.password };
    const response = await api.post(endpoint, body, { auth: false });

    setLoading(false);
    if (!response.ok) {
      setError(response.error || 'Accesso non riuscito.');
      return;
    }

    await setToken(response.data.token);
    await setStoredUser(response.data.user);
    void registerForPushNotificationsAsync();
    onAuthenticated(response.data.user);
  }

  return (
    <Screen
      title="RE-VALUE"
      subtitle="Dai nuova vita ai tuoi oggetti. Accedi per pubblicare, prenotare e usare i crediti."
      variant="gradient"
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isRegister ? 'Crea il tuo account' : 'Accedi'}</Text>
        <Text style={styles.cardSubtitle}>
          {isRegister ? 'Unisciti alla community locale' : 'Bentornato nella community'}
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {isRegister ? (
          <View style={styles.row}>
            <TextField
              label="Nome"
              value={form.nome}
              onChangeText={(value) => setField('nome', value)}
              style={styles.half}
            />
            <TextField
              label="Cognome"
              value={form.cognome}
              onChangeText={(value) => setField('cognome', value)}
              style={styles.half}
            />
          </View>
        ) : null}
        <TextField
          label="Email"
          value={form.email}
          autoCapitalize="none"
          keyboardType="email-address"
          onChangeText={(value) => setField('email', value)}
        />
        <TextField
          label="Password"
          value={form.password}
          secureTextEntry
          onChangeText={(value) => setField('password', value)}
        />
        <Button title={isRegister ? 'Registrati' : 'Accedi'} onPress={submit} loading={loading} fullWidth />
        <Button
          title={isRegister ? 'Ho già un account' : 'Crea un account'}
          variant="secondary"
          fullWidth
          onPress={() => {
            setError('');
            setMode(isRegister ? 'login' : 'register');
          }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 5,
    marginHorizontal: 4,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: 0,
  },
  cardSubtitle: {
    marginTop: -8,
    color: colors.muted,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  error: {
    color: colors.danger,
    fontWeight: '700',
  },
});
