import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { getStoredUser, getToken } from './src/api/client';
import { AnnuncioDetailScreen } from './src/screens/AnnuncioDetailScreen';
import { AuthScreen } from './src/screens/AuthScreen';
import { CatalogScreen } from './src/screens/CatalogScreen';
import { ChatListScreen } from './src/screens/ChatListScreen';
import { ChatScreen } from './src/screens/ChatScreen';
import { CreateAnnuncioScreen } from './src/screens/CreateAnnuncioScreen';
import { MyAnnunciScreen } from './src/screens/MyAnnunciScreen';
import { MyBookingsScreen } from './src/screens/MyBookingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { QRDisplayScreen } from './src/screens/QRDisplayScreen';
import { QRScanScreen } from './src/screens/QRScanScreen';
import { SwapSuccessScreen } from './src/screens/SwapSuccessScreen';
import { colors } from './src/theme/colors';

const tabs = [
  { key: 'catalog',   label: 'Catalogo' },
  { key: 'create',    label: 'Crea' },
  { key: 'mine',      label: 'Miei' },
  { key: 'bookings',  label: 'Prenot.' },
  { key: 'chat',      label: 'Chat' },
  { key: 'profile',   label: 'Profilo' },
];

export default function App() {
  const [booting, setBooting] = useState(true);
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('catalog');
  const [modal, setModal] = useState(null); // { name, params }
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    async function boot() {
      const [token, storedUser] = await Promise.all([getToken(), getStoredUser()]);
      if (token) setUser(storedUser || { nome: 'Utente' });
      setBooting(false);
    }
    boot();
  }, []);

  function handleCreated() {
    setRefreshKey((current) => current + 1);
    setTab('mine');
  }

  function closeModal() { setModal(null); }

  function renderContent() {
    if (!user) {
      return <AuthScreen onAuthenticated={setUser} />;
    }

    // Overlay screens (full-screen modals via state)
    if (modal?.name === 'annuncioDetail') {
      return <AnnuncioDetailScreen id={modal.params.id} onBack={closeModal} />;
    }
    if (modal?.name === 'qrDisplay') {
      return <QRDisplayScreen prenotazioneId={modal.params.prenotazioneId} onBack={closeModal} />;
    }
    if (modal?.name === 'qrScan') {
      return (
        <QRScanScreen
          onBack={closeModal}
          onSuccess={(crediti) => setModal({ name: 'swapSuccess', params: { crediti } })}
        />
      );
    }
    if (modal?.name === 'swapSuccess') {
      return (
        <SwapSuccessScreen
          crediti={modal.params.crediti}
          onDone={() => { closeModal(); setTab('bookings'); }}
        />
      );
    }
    if (modal?.name === 'chat') {
      return <ChatScreen conversazioneId={modal.params.id} onBack={closeModal} />;
    }

    // Tab screens
    if (tab === 'create') {
      return <CreateAnnuncioScreen onCreated={handleCreated} />;
    }
    if (tab === 'mine') {
      return (
        <MyAnnunciScreen
          refreshKey={refreshKey}
          onOpenAnnuncio={(id) => setModal({ name: 'annuncioDetail', params: { id } })}
        />
      );
    }
    if (tab === 'bookings') {
      return (
        <MyBookingsScreen
          onOpenQRDisplay={(prenotazioneId) => setModal({ name: 'qrDisplay', params: { prenotazioneId } })}
          onOpenQRScan={() => setModal({ name: 'qrScan', params: {} })}
        />
      );
    }
    if (tab === 'chat') {
      return (
        <ChatListScreen
          onOpenChat={(id) => setModal({ name: 'chat', params: { id } })}
        />
      );
    }
    if (tab === 'profile') {
      return (
        <ProfileScreen
          user={user}
          onLogout={() => {
            setUser(null);
            setTab('catalog');
            setModal(null);
          }}
        />
      );
    }

    return (
      <CatalogScreen
        refreshKey={refreshKey}
        onOpenAnnuncio={(id) => setModal({ name: 'annuncioDetail', params: { id } })}
      />
    );
  }

  if (booting) {
    return (
      <SafeAreaView style={styles.boot}>
        <StatusBar style="light" />
        <ActivityIndicator color={colors.surface} />
        <Text style={styles.bootText}>RE-VALUE</Text>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.app}>
      <StatusBar style="dark" />
      <View style={styles.content}>{renderContent()}</View>
      {user && !modal ? (
        <SafeAreaView style={styles.navSafe}>
          <View style={styles.nav}>
            {tabs.map((item) => {
              const active = item.key === tab;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setTab(item.key)}
                  style={[styles.navItem, active && styles.navItemActive]}
                >
                  <Text style={[styles.navText, active && styles.navTextActive]}>{item.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
  },
  boot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: colors.green,
  },
  bootText: {
    color: colors.surface,
    fontSize: 28,
    fontWeight: '900',
  },
  navSafe: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  nav: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderRadius: 8,
  },
  navItemActive: {
    backgroundColor: '#E7F3E8',
  },
  navText: {
    color: colors.muted,
    fontWeight: '800',
  },
  navTextActive: {
    color: colors.greenDark,
  },
});
