# Plan de Pruebas de Sincronización y Consistencia

Este documento describe los escenarios de prueba necesarios para validar el correcto funcionamiento de la arquitectura de sincronización en tiempo real y la consistencia entre los distintos módulos de la aplicación.

---

## Escenario 1: Creación de Alquiler desde Lecturas
**Objetivo**: Validar que al dar de alta un contrato de alquiler desde la sección de Lecturas, los datos se propaguen instantáneamente al resto de las pantallas (Alquileres, Máquinas, Clientes) y se persistan en Turso.

### Pasos:
1. Iniciar sesión en la aplicación.
2. Ir al módulo **Área Técnica** -> **Lecturas**.
3. Hacer clic en **"Nuevo Alquiler"** (arriba a la derecha).
4. Completar el formulario:
   - Elegir o crear un Cliente nuevo (ej: "Empresa de Prueba S.A.").
   - Seleccionar un equipo disponible (ej: S/N `CNB8M5Z98L`).
   - Asignar un plan de abono.
5. Hacer clic en **"Confirmar Alquiler"**.
6. Cambiar a la pestaña **Alquileres**.

### Resultados Esperados:
- El nuevo contrato figura inmediatamente en el listado de **Alquileres**.
- El equipo seleccionado cambia su estado a **"Alquilada"** de forma inmediata.
- Aparece una notificación Toast verde abajo a la derecha: *"Guardado en la base de datos"*.
- (Opcional) Al revisar la consola del navegador, se ve una petición POST exitosa a `/api/sync/process`.

---

## Escenario 2: Sincronización de Estados en Tiempo Real (Cross-Device)
**Objetivo**: Verificar que los cambios realizados en un dispositivo móvil o terminal alternativa impacten de inmediato (máximo 5 segundos) en otra pantalla abierta.

### Pasos:
1. Abrir la aplicación en la **PC** (Dispositivo A) e ingresar a la pestaña **Área Técnica**.
2. Abrir la aplicación en el **Celular** (Dispositivo B) e iniciar sesión con la misma cuenta.
3. En el **Celular** (Dispositivo B):
   - Seleccionar un ticket técnico activo.
   - Modificar su estado de "Nuevo" a "En Proceso" o "Resuelto".
   - Guardar los cambios.
4. Observar el listado de tickets en la **PC** (Dispositivo A) sin recargar la página.

### Resultados Esperados:
- En el Dispositivo B (Celular) se muestra el Toast verde de confirmación de guardado.
- En el Dispositivo A (PC), el estado del ticket se actualiza visualmente en un lapso de **máximo 5 segundos** (ciclo de polling de 5s sin caché intermedio).

---

## Escenario 3: Comportamiento Tolerante a Fallos (Modo Offline)
**Objetivo**: Validar que la aplicación no pierda datos ante microcortes de conexión y se recupere de forma elegante mostrando avisos correspondientes al usuario.

### Pasos:
1. Iniciar sesión en la app.
2. Desconectar el Wi-Fi / cable de red de la PC (o activar Modo Avión en el celular).
3. Intentar realizar una acción de guardado (por ejemplo, cargar el contador final de una lectura en la pestaña **Lecturas**).
4. Observar la interfaz de usuario.
5. Conectar nuevamente la red.

### Resultados Esperados:
- Al intentar guardar sin conexión, la interfaz responde de inmediato (sigue optimista).
- Aparece un Toast amarillo: *"Sin conexión - Los cambios se guardarán cuando vuelva la conexión."*.
- El cambio queda registrado en la cola de sincronización con estado `pending` en `localStorage` (no se pierde).
- Al volver a tener internet, la cola se procesa automáticamente en segundo plano, se aplica el cambio en Turso y el Toast cambia a verde: *"Guardado en la base de datos"*.
- El resto de los dispositivos pasan a recibir la actualización.
