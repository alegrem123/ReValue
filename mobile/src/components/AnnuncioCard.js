import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const PLACEHOLDER = 'https://via.placeholder.com/640x420/ced4da/6c757d?text=RE-VALUE';

export function formatDate(value) {
  if (!value) return 'Data non disponibile';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

export function AnnuncioCard({ annuncio, onPress, actions }) {
  const foto = annuncio.oggetto?.foto?.[0] || PLACEHOLDER;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image source={{ uri: foto }} style={styles.image} />
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>{annuncio.titolo || 'Annuncio senza titolo'}</Text>
          {annuncio.stato ? <Text style={styles.badge}>{annuncio.stato}</Text> : null}
        </View>
        <Text style={styles.meta}>{annuncio.oggetto?.categoria || 'Categoria non indicata'}</Text>
        <Text style={styles.meta}>Scadenza: {formatDate(annuncio.dataScadenza)}</Text>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>
    </Pressable>
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
  pressed: {
    opacity: 0.78,
  },
  image: {
    height: 190,
    width: '100%',
    backgroundColor: colors.border,
  },
  body: {
    padding: 14,
    gap: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#E7F3E8',
    color: colors.greenDark,
    fontSize: 11,
    fontWeight: '800',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  meta: {
    color: colors.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
