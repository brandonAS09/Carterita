import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Mic, Camera, TrendingUp, Wallet, LogOut } from 'lucide-react-native';

export default function MenuScreen({ navigation }: any) {
    const [userName, setUserName] = useState('');

    const datosPrueba = {
        limiteDiario: 200.00,
        gastadoHoy: 80.00,
        disponible: 120.00,
    };

    const objetivoPrueba = {
        titulo: "Salida de Fin de Semana",
        dineroActual: 450,
        objetivo: 1200
    };

    const transaccionesPrueba = [
        { id: 1, titulo: "Tacos con la novia", categoria: "Salidas", total: 80.00 },
        { id: 2, titulo: "Cafecito", categoria: "Antojos", total: 45.00 }
    ];

    useEffect(() => {
        loadUser();
    }, []);

    const loadUser = async () => {
        const storedName = await AsyncStorage.getItem('userName');
        if (storedName) {
            setUserName(storedName);
        }
    };

    const handleLogout = async () => {
        await AsyncStorage.removeItem('userName');
        navigation.replace('Login');
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#121212" />
            <ScrollView contentContainerStyle={styles.scrollContent}>

                <View style={styles.header}>
                    <View>
                        <Text style={styles.saludo}>Bienvenido, {userName || 'Usuario'}!</Text>
                        <Text style={styles.titulo}>Proyecto movil</Text>
                    </View>
                    <TouchableOpacity onPress={handleLogout} style={styles.botonSalir}>
                        <LogOut color="#FF5252" size={24} />
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardLabel}>DISPONIBLE PARA HOY</Text>
                    <Text style={styles.cardTotal}>${datosPrueba.disponible.toFixed(2)}</Text>

                    <View style={styles.contenedorProgreso}>
                        <View style={[styles.barraProgreso, { width: `${(datosPrueba.gastadoHoy / datosPrueba.limiteDiario) * 100}%` }]} />
                    </View>
                    <Text style={styles.textoProgreso}>
                        Has gastado ${datosPrueba.gastadoHoy.toFixed(2)} de tu límite diario (${datosPrueba.limiteDiario.toFixed(2)})
                    </Text>
                </View>

                <View style={styles.metaCard}>
                    <View style={styles.metaHeader}>
                        <TrendingUp color="#00FF88" size={20} />
                        <Text style={styles.metaTitulo}>Meta actual: {objetivoPrueba.titulo}</Text>
                    </View>
                    <Text style={styles.totalMeta}>${objetivoPrueba.dineroActual} /${objetivoPrueba.objetivo} MXN</Text>
                </View>

                <Text style={styles.TituloSeccion}>Registro Rápido</Text>
                <View style={styles.containerAccion}>
                    <TouchableOpacity style={styles.botonAccion} activeOpacity={0.8}>
                        <Mic color="#121212" size={28} />
                        <Text style={styles.textoAccion}>Voz</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.botonAccion, styles.botonCamara]} activeOpacity={0.8}>
                        <Camera color="#121212" size={28} />
                        <Text style={styles.textoAccion}>Escanear</Text>
                    </TouchableOpacity>
                </View>

                <Text style={styles.TituloSeccion}>Últimos Gastos de Hoy</Text>
                {transaccionesPrueba.map((tx) => (
                    <View key={tx.id} style={styles.contenedorGasto}>
                        <View style={styles.iconoGasto}>
                            <Wallet color="#00FF88" size={20} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.tituloGasto}>{tx.titulo}</Text>
                            <Text style={styles.categoriaGasto}>{tx.categoria}</Text>
                        </View>
                        <Text style={styles.totalGasto}>-${tx.total.toFixed(2)}</Text>
                    </View>
                ))}

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212'
    },
    scrollContent: {
        padding: 20
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        marginTop: 10
    },
    saludo: {
        color: '#00FF88',
        fontSize: 14,
        fontWeight: '600'
    },
    titulo: {
        color: '#FFFFFF',
        fontSize: 28,
        fontWeight: 'bold',
        marginTop: 2
    },
    botonSalir: {
        backgroundColor: '#1E1E1E',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    card: {
        backgroundColor: '#1E1E1E',
        borderRadius: 20,
        padding: 24,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2A2A2A'
    },
    cardLabel: {
        color: '#8E8E93',
        fontSize: 12,
        letterSpacing: 1,
        fontWeight: '600'
    },
    cardTotal: {
        color: '#00FF88',
        fontSize: 42,
        fontWeight: 'bold',
        marginVertical: 8
    },
    contenedorProgreso: {
        height: 8,
        backgroundColor: '#2A2A2A',
        borderRadius: 4,
        marginTop: 12,
        overflow: 'hidden'
    },
    barraProgreso: {
        height: '100%',
        backgroundColor: '#00FF88'
    },
    textoProgreso: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 8
    },
    metaCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 16,
        padding: 16,
        marginBottom: 28
    },
    metaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    metaTitulo: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500'
    },
    totalMeta: {
        color: '#8E8E93',
        fontSize: 12,
        marginTop: 6,
        marginLeft: 28
    },
    TituloSeccion: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 16
    },
    containerAccion: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 28
    },
    botonAccion: {
        flex: 1,
        backgroundColor: '#00FF88',
        borderRadius: 16,
        padding: 18,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8
    },
    botonCamara: {
        backgroundColor: '#00E5FF'
    },
    textoAccion: {
        color: '#121212',
        fontWeight: 'bold',
        fontSize: 14
    },
    contenedorGasto: {
        backgroundColor: '#1E1E1E',
        borderRadius: 14,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 10
    },
    iconoGasto: {
        backgroundColor: '#2A2A2A',
        padding: 10,
        borderRadius: 10
    },
    tituloGasto: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: '500'
    },
    categoriaGasto: {
        color: '#8E8E93',
        fontSize: 12
    },
    totalGasto: {
        color: '#FF5252',
        fontWeight: 'bold',
        fontSize: 15
    },
});