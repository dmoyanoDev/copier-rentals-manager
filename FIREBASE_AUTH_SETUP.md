# Configuración de Seguridad y Firebase Auth para M&S Tecnología Digital

Esta guía explica cómo activar el proveedor de inicio de sesión **Correo electrónico y contraseña** en tu consola de Firebase para habilitar el sistema de logins y recuperación de contraseñas seguros.

---

## 1. Activar Proveedor en Firebase Console

1. Entra a tu consola de Firebase: **[console.firebase.google.com](https://console.firebase.google.com/)** y abre tu proyecto (`MS-Digital`).
2. En el menú de la izquierda, haz clic en **Authentication**.
3. Ve a la pestaña **Sign-in method** (Método de inicio de sesión).
4. Haz clic en **Agregar proveedor** (o *Comenzar* si es la primera vez que entras).
5. Selecciona la opción **Correo electrónico y contraseña** (Email/Password).
6. Activa el interruptor principal de **Habilitar** (deja deshabilitada la opción de *"Vínculo por correo electrónico"*).
7. Haz clic en **Guardar**.

---

## 2. Configurar el Primer Usuario

Para poder iniciar sesión por primera vez tras conectar Firebase en tu aplicación web:
1. Dentro de la sección **Authentication**, ve a la pestaña **Users** (Usuarios).
2. Haz clic en el botón **Agregar usuario**.
3. Introduce los datos del administrador maestro:
   - **Correo electrónico**: `dmoyano@mstecnologia.com.ar`
   - **Contraseña**: `jUEVES2389$`
4. Haz clic en **Agregar usuario**.

> [!NOTE]
> Una vez que te loguees en la aplicación y presiones **Subir Base de Datos Local a la Nube**, el sistema creará automáticamente los perfiles de Firestore correspondientes y registrará a los operadores adicionales en la nube de forma segura.

---

## 3. Comprobar Recuperación de Contraseña Real
Una vez activado el proveedor, si un usuario olvida su contraseña:
1. Hará clic en *"Restablecer contraseña"* en la pantalla de login.
2. Ingresará su correo `dmoyano@mstecnologia.com.ar` y presionará Buscar.
3. Firebase enviará de forma **100% segura y automática** un correo electrónico real de parte de Google con un enlace para que el usuario pueda escribir su nueva clave de acceso de manera privada y directa.

---

## 4. Configurar Reglas de Seguridad en Firestore (PRODUCCIÓN)
Para evitar que personas ajenas o atacantes lean o modifiquen tu base de datos:
1. En Firebase Console, ve a **Firestore Database** en el menú de la izquierda.
2. Ve a la pestaña **Reglas** (Rules).
3. Reemplaza el código actual por las siguientes reglas restrictivas que solo permiten lectura y escritura a usuarios autenticados:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. Haz clic en **Publicar** (Publish).

Con esta regla, tus datos están protegidos contra accesos no autorizados y son 100% seguros.
