import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }: any) {
    const [name, setName] = useState('');

    const handleLogin = async () => {
        if (!name.trim()) {
            Alert.alert('Escribe tu nombre', 'Por favor ingresa tu nombre para continuar.');
            return;
        }

        try {
            await AsyncStorage.setItem('userName', name.trim());
            navigation.replace('Menu');
        } catch (error) {
            console.error('Error guardando el nombre:', error);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.titulo}>Proyecto movil</Text>
                <Text style={styles.subtitulo}>Finanzas pros</Text>

                <TextInput
                    style={styles.input}
                    placeholder="Nombre de usuario"
                    placeholderTextColor="#8E8E93"
                    value={name}
                    onChangeText={setName}
                />

                <TouchableOpacity style={styles.boton} onPress={handleLogin}>
                    <Text style={styles.textoBoton}>Comenzar</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212'
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        padding: 20
    },
    titulo: {
        color: '#00FF88',
        fontSize: 36,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10
    },
    subtitulo: {
        color: '#FFFFFF',
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 40
    },
    input: {
        backgroundColor: '#1E1E1E',
        color: '#FFF',
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    boton: {
        backgroundColor: '#00FF88',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center'
    },
    textoBoton: {
        color: '#121212',
        fontSize: 16,
        fontWeight: 'bold'
    }
});