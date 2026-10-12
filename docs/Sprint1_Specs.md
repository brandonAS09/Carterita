# Sprint 1: Autenticación, Fundación y Flujo Básico

**Objetivo del Sprint:** Implementar el sistema de cuentas de usuario, establecer la base de datos local (relacionada al usuario activo), permitir configurar un presupuesto inicial (F01), visualizar el saldo en el dashboard (F05) y registrar gastos de forma manual (F02). Esto valida la sesión de usuario, la persistencia de datos y el cálculo básico.

## Features Seleccionados
- **F00** - Autenticación (Login/Registro)
- **F01** - Onboarding y Configuración de Presupuesto
- **F02** - Registro de Gasto Manual
- **F05** - Dashboard y Resumen Principal

---

## 1. Esquema Técnico y Arquitectura (Sprint 1)

### Stack Recomendado para esta fase:
- **Base de Datos:** SQLite (Room en Android, `sqflite` / `drift` en Flutter). Se implementará un manejo de sesión almacenando el ID del usuario logueado.
- **Gestión del Estado:** Riverpod/Bloc (Flutter) o ViewModel + LiveData/StateFlow (Android) para asegurar que la UI reaccione a los estados de carga, error y éxito.

### Tablas Requeridas (Data Model del Sprint 1)
1. `Usuario`: `id`, `email`, `password_hash`, `nombre`.
2. `Presupuesto`: `id`, `usuario_id`, `monto_base`, `tipo_ciclo`, `moneda`, `fecha_inicio`.
3. `Transaccion`: `id`, `usuario_id`, `monto`, `fecha`, `concepto`, `categoria_id`.
4. `Categoria`: `id`, `nombre`, `icono` (Pre-pobladas).

### Lógica Core (Servicios a programar)
- **AuthService:** Manejo de registro local, encriptación de contraseña (hash), validación en login y persistencia del "estado de sesión".
- **BudgetService / Calculator:** 
  - *Input:* ID del usuario activo.
  - *Cálculo:* `limite_diario` = `monto_base` / días del ciclo. `gastos_hoy` = Suma de transacciones del día. `saldo_disponible_hoy` = `limite_diario` - `gastos_hoy`.

---

## 2. Criterios de Aceptación (Definition of Done) - Incluyendo Casos Negativos

### F00 - Autenticación (Login / Registro)
**Escenario 1: Registro y Login Exitoso (Happy Path)**
- **Dado** que el usuario está en la pantalla de Registro o Login.
- **Cuando** ingresa sus credenciales correctamente y presiona la acción principal.
- **Entonces** se debe mostrar un indicador de carga (spinner/loader) previniendo múltiples clics.
- **Y** tras procesar en la BD, la sesión se inicia y es redirigido a la siguiente pantalla (Onboarding o Dashboard).

**Escenario 2: Validaciones Previas y Botón Deshabilitado (Caso Negativo)**
- **Dado** que el usuario está en el formulario de Login o Registro.
- **Cuando** los campos están vacíos o el formato del email es incorrecto (ej. sin '@').
- **Entonces** el botón principal debe permanecer **deshabilitado**.
- **Y** al salir del campo incorrecto (onBlur), se debe mostrar texto de error debajo del input ("Email inválido", "Contraseña corta", etc.).

**Escenario 3: Credenciales Incorrectas (Caso Negativo)**
- **Dado** que el usuario intenta hacer Login.
- **Cuando** ingresa un email que no existe o una contraseña errónea.
- **Entonces** el indicador de carga finaliza.
- **Y** se muestra un mensaje de error (Snackbar / Toast): "Correo o contraseña incorrectos".

### F01 - Onboarding y Configuración de Presupuesto
**Escenario 1: Fallo al Guardar (Caso Negativo)**
- **Dado** que el usuario completa su presupuesto.
- **Cuando** presiona guardar y ocurre un error inesperado (ej. fallo de SQLite).
- **Entonces** el indicador de carga desaparece.
- **Y** se muestra un Dialog/Snackbar: "Ocurrió un error al guardar tu configuración. Inténtalo de nuevo."

### F02 - Registro de Gasto Manual
**Escenario 1: Guardado con feedback de carga y éxito**
- **Dado** que el usuario llenó los datos del gasto.
- **Cuando** presiona "Guardar".
- **Entonces** el botón cambia a estado de carga (loader).
- **Y** al terminar, el formulario se cierra y el Dashboard actualiza el saldo de inmediato.

**Escenario 2: Botón deshabilitado por campos vacíos (Caso Negativo)**
- **Dado** que el usuario está en la pantalla de Nuevo Gasto.
- **Cuando** el monto es $0, nulo, o el concepto está vacío.
- **Entonces** el botón "Guardar" se mantiene **deshabilitado** (bloqueando la acción hasta que haya datos válidos).

### F05 - Dashboard y Resumen Principal
**Escenario 1: Estado de carga al abrir (Skeleton / Loader)**
- **Dado** que el usuario entra a la aplicación ya logueado.
- **Cuando** la vista del Dashboard comienza a cargar los datos asíncronamente desde la BD.
- **Entonces** se debe mostrar un *Skeleton Loader* o *Shimmer effect* donde va el saldo y la lista, indicando que se está procesando.

**Escenario 2: Dashboard Vacío (Empty State - Caso Negativo/Edge)**
- **Dado** que el usuario entra al Dashboard y no tiene gastos registrados hoy.
- **Cuando** los datos cargan exitosamente.
- **Entonces** en lugar de una lista blanca o rota, debe mostrarse una ilustración amigable con el texto: "Aún no tienes gastos hoy. ¡Sigue así!".
