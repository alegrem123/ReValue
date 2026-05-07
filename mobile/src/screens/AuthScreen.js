import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api, setStoredUser, setToken } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
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

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
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
    onAuthenticated(response.data.user);
  }

  return (
    <Screen
      title="RE-VALUE"
      subtitle="Accedi all'app per pubblicare annunci, prenotare oggetti e seguire il tuo wallet."
    >
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isRegister ? 'Crea account' : 'Accedi'}</Text>
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
        <Button title={isRegister ? 'Registrati' : 'Accedi'} onPress={submit} loading={loading} />
        <Button
          title={isRegister ? 'Ho già un account' : 'Crea un account'}
          variant="secondary"
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
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
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
