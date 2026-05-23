import { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/colors';

const PLACEHOLDER = 'https://via.placeholder.com/640x420/EDE8DF/6B7280?text=RE-VALUE';

export function formatDate(value) {
  if (!value) return 'N/D';
  return new Intl.DateTimeFormat('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function statoBadgeStyle(stato) {
  const map = {
    disponibile: { bg: colors.statoDisponibile,  tx: colors.statoDisponibileTx },
    prenotato:   { bg: colors.statoPrenotato,    tx: colors.statoPrenotatoTx   },
    scambiato:   { bg: colors.statoScambiato,    tx: colors.statoScambiatoTx   },
    scaduto:     { bg: colors.statoScaduto,      tx: colors.statoScadutoTx     },
    sospeso:     { bg: colors.statoSospeso,      tx: colors.statoSospesoTx     },
  };
  return map[(stato || '').toLowerCase()] || map.disponibile;
}

export function AnnuncioCard({ annuncio, onPress, actions }) {
  const scale     = useRef(new Animated.Value(1)).current;
  const imgScale  = useRef(new Animated.Value(1)).current;

  function handlePressIn() {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 0.97, useNativeDriver: true, speed: 40 }),
      Animated.spring(imgScale, { toValue: 1.04, useNativeDriver: true, speed: 30 }),
    ]).start();
  }
  function handlePressOut() {
    Animated.parallel([
      Animated.spring(scale,    { toValue: 1, useNativeDriver: true, speed: 25 }),
      Animated.spring(imgScale, { toValue: 1, useNativeDriver: true, speed: 20 }),
    ]).start();
  }

  const foto = annuncio.oggetto?.foto?.[0] || PLACEHOLDER;
  const stato = annuncio.stato || 'disponibile';
  const badgeStyle = statoBadgeStyle(stato);
  const crediti = annuncio.creditiRichiesti ?? annuncio.crediti ?? null;

  return (
    <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        <View style={styles.imgWrapper}>
          <Animated.Image
            source={{ uri: foto }}
            style={[styles.image, { transform: [{ scale: imgScale }] }]}
          />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={2}>
              {annuncio.titolo || 'Annuncio senza titolo'}
            </Text>
            <View style={[styles.badge, { backgroundColor: badgeStyle.bg }]}>
              <Text style={[styles.badgeText, { color: badgeStyle.tx }]}>{stato}</Text>
            </View>
          </View>
          <Text style={styles.meta}>
            {annuncio.oggetto?.categoria || 'Categoria non indicata'}
          </Text>
          <View style={styles.footer}>
            <Text style={styles.meta}>
              Scade: {formatDate(annuncio.dataScadenza)}
            </Text>
            {crediti != null ? (
              <Text style={styles.credits}>{crediti} cr.</Text>
            ) : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  cardWrap: {
    borderRadius: 16,
    // Shadow iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Shadow Android
    elevation: 3,
    backgroundColor: colors.surface,
  },
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  imgWrapper: {
    overflow: 'hidden',
    height: 200,
    width: '100%',
    backgroundColor: colors.sand,
  },
  image: {
    height: '100%',
    width: '100%',
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
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.2,
  },
  badge: {
    borderRadius: 50,
    paddingHorizontal: 9,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  meta: {
    color: colors.muted,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  credits: {
    color: colors.green,
    fontWeight: '800',
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
});
