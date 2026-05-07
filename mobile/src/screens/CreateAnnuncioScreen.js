import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '../api/client';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../theme/colors';

const initialForm = {
  titolo: '',
  descrizione: '',
  categoria: '',
  materiale: '',
  dimensioni: 'medio',
  dataScadenza: '',
  latitudine: '',
  longitudine: '',
};

export function CreateAnnuncioScreen({ onCreated }) {
  const [form, setForm] = useState(initialForm);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);

  function setField(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function pickPhotos() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso necessario', 'Abilita l accesso alle foto per aggiungere immagini.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      allowsMultipleSelection: true,
      base64: true,
      quality: 0.7,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      selectionLimit: 5,
    });

    if (result.canceled) return;

    const selected = result.assets
      .slice(0, 5)
      .map((asset) => `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`);
    setPhotos(selected);
  }

  async function useCurrentLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permesso necessario', 'Abilita la posizione per compilare le coordinate.');
      return;
    }

    const position = await Location.getCurrentPositionAsync({});
    setForm((current) => ({
      ...current,
      latitudine: position.coords.latitude.toFixed(6),
      longitudine: position.coords.longitude.toFixed(6),
    }));
  }

  function buildPayload() {
    return {
      titolo: form.titolo.trim(),
      dataScadenza: new Date(form.dataScadenza).toISOString(),
      latitudine: form.latitudine ? Number(form.latitudine) : undefined,
      longitudine: form.longitudine ? Number(form.longitudine) : undefined,
      oggetto: {
        categoria: form.categoria.trim(),
        descrizione: form.descrizione.trim(),
        dimensioni: form.dimensioni,
        materiale: form.materiale.trim(),
        foto: photos,
      },
    };
  }

  async function submit() {
    if (!form.titolo || !form.descrizione || !form.categoria || !form.dataScadenza) {
      Alert.alert('Campi mancanti', 'Titolo, descrizione, categoria e scadenza sono obbligatori.');
      return;
    }

    setLoading(true);
    const response = await api.post('/api/annunci', buildPayload());
    setLoading(false);

    if (!response.ok) {
      Alert.alert('Pubblicazione non riuscita', response.error || 'Controlla i dati inseriti.');
      return;
    }

    setForm(initialForm);
    setPhotos([]);
    Alert.alert('Annuncio pubblicato', 'Il tuo annuncio e ora disponibile nel catalogo.');
    onCreated?.();
  }

  return (
    <Screen title="Nuovo annuncio" subtitle="Pubblica un oggetto da recuperare.">
      <TextField label="Titolo" value={form.titolo} onChangeText={(value) => setField('titolo', value)} />
      <TextField
        label="Descrizione"
        value={form.descrizione}
        multiline
        onChangeText={(value) => setField('descrizione', value)}
      />
      <TextField label="Categoria" value={form.categoria} onChangeText={(value) => setField('categoria', value)} />
      <TextField label="Materiale" value={form.materiale} onChangeText={(value) => setField('materiale', value)} />
      <TextField
        label="Dimensione"
        value={form.dimensioni}
        placeholder="piccolo, medio, grande, molto grande"
        onChangeText={(value) => setField('dimensioni', value)}
      />
      <TextField
        label="Scadenza"
        value={form.dataScadenza}
        placeholder="2026-06-30T18:00"
        autoCapitalize="none"
        onChangeText={(value) => setField('dataScadenza', value)}
      />
      <View style={styles.row}>
        <TextField
          label="Latitudine"
          value={form.latitudine}
          keyboardType="numeric"
          onChangeText={(value) => setField('latitudine', value)}
          style={styles.half}
        />
        <TextField
          label="Longitudine"
          value={form.longitudine}
          keyboardType="numeric"
          onChangeText={(value) => setField('longitudine', value)}
          style={styles.half}
        />
      </View>
      <Button title="Usa posizione attuale" variant="secondary" onPress={useCurrentLocation} />
      <Button title={`Seleziona foto (${photos.length}/5)`} variant="secondary" onPress={pickPhotos} />
      <View style={styles.photos}>
        {photos.map((photo, index) => (
          <Pressable key={`${photo.slice(0, 24)}-${index}`} onPress={() => setPhotos(photos.filter((_, i) => i !== index))}>
            <Image source={{ uri: photo }} style={styles.photo} />
          </Pressable>
        ))}
      </View>
      <Button title="Pubblica annuncio" onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  half: {
    flex: 1,
  },
  photos: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  photo: {
    width: 76,
    height: 76,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
});
