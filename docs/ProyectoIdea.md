# Descripción del proyecto

### Objetivo General
Desarrollar una aplicación móvil de gestión financiera personal, utilizando captura por voz y reconocimiento óptico de caracteres, con un sistema de presupuestos dinámicos y adaptables a cualquier perfil de usuario.

### El problema
A veces se suele abandonar las apps de finanzas es la molestia al registrar datos manualmente. La Solución: Un modelo de "Registro en 2 segundos" que integra el hardware del dispositivo para interpretar dictados de voz rápidos o escanear tickets físicos. El algoritmo local extrae automáticamente el monto y sugiere la categoría del gasto, haciendo el seguimiento financiero de forma rápida.

### 2. Funcionalidades Core
Para que la herramienta sea completa, integrará la siguiente arquitectura personalizable:
- **Motor Multimodal:** Soporte para registro manual, dictado por voz y escáner de recibos.
- **Ciclos Flexibles y Multimoneda:** Configuración de presupuestos diarios, semanales o mensuales, con ajustes globales del símbolo de moneda local.
- **Algoritmo Inteligente:** Recálculo automático del saldo disponible si el usuario gasta menos de su límite diario.
- **Ahorro Gamificado:** Asignación automática de los fondos excedentes a metas financieras personalizadas.

### 3. Alcance y Stack Tecnológico
Para garantizar la viabilidad técnica del proyecto, el proyecto tiene un alcance delimitado:
- **Restricciones:** Operará de manera estrictamente local y offline. No se conectará a cuentas bancarias reales por seguridad.
- **Base de Datos:** Uso de una base de datos local (como SQLite u otro) para la persistencia de la información y asegurar una alta velocidad de lectura. 
- **Integraciones:** Uso de bibliotecas nativas para el procesamiento de voz a texto y Google ML Kit para la extracción de texto en imágenes.

### 4. Plan de Trabajo (Fsaes de Desarrollo)
- **Fase de Diseño y UI:** Creación de las pantallas principales, el panel de presupuesto y la navegación de la aplicación.
- **Fase de Base de Datos:** Creación de tablas (Gastos, Categorías, Metas) e implementación de la lógica CRUD.
- **Fase de Sensores:** Integración de la cámara para el scaner y el micrófono para el reconocimiento de voz.
- **Fase de Pruebas y Ajustes:** Pruebas de captura de datos y corrección de errores antes de la presentación final.
