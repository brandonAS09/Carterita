# Criterios de Aceptación y Pruebas (SDD)

*Este documento definirá el comportamiento esperado de cada Feature (F01, F02, etc.) utilizando escenarios de prueba formales para guiar el desarrollo y saber exactamente cuándo una funcionalidad está "terminada" (Definition of Done).*

## F03 - Registro de Gasto por Voz

**Escenario 1: Registro exitoso por voz con extracción correcta de monto**
- **Dado (Given)** que el usuario está en la pantalla principal (Dashboard) y presiona el botón del micrófono
- **Cuando (When)** el usuario dicta una frase como "Compré un café por 60 pesos"
- **Entonces (Then)** la aplicación debe transcribir el texto usando las bibliotecas nativas de voz
- **Y (And)** el algoritmo debe extraer exitosamente el monto "60" 
- **Y (And)** asignar una categoría sugerida (ej. "Alimentos/Bebidas") basada en el contexto
- **Y (And)** el sistema debe guardar la transacción localmente y actualizar el presupuesto diario disponible.

## F04 - Registro de Gasto por Escáner (OCR)

**Escenario 1: Escaneo de ticket físico con extracción de total**
- **Dado (Given)** que el usuario elige agregar un gasto por medio de escáner
- **Cuando (When)** el usuario toma una foto de un recibo legible
- **Entonces (Then)** Google ML Kit debe procesar la imagen
- **Y (And)** debe extraer y pre-llenar automáticamente el monto total del ticket en la vista previa del gasto
- **Y (And)** permitir al usuario confirmar o ajustar el monto antes de guardar.

*(Los escenarios para las demás funcionalidades se redactarán y refinarán aquí antes de iniciar su programación correspondiente).*
