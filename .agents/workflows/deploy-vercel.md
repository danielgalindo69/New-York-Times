---
description: Cómo desplegar NYT Explorer en Vercel con Proxy de Seguridad
---

Para desplegar esta aplicación de forma segura (sin exponer tu API Key), sigue estos pasos:

1. **Subir cambios a GitHub**
   Asegúrate de que tu repositorio tenga la carpeta `api/` y el archivo `vercel.json` en la raíz.
   ```bash
   git add .
   git commit -m "Preparando PWA y Proxy de Seguridad para Vercel"
   git push origin main
   ```

2. **Crear Proyecto en Vercel**
   - Ve a [vercel.com/new](https://vercel.com/new) e importa tu repositorio de GitHub.

3. **Configurar Variables de Entorno (¡PASO CRÍTICO!)**
   - En la sección **Environment Variables** antes del deploy, añade:
     - **Key**: `NYT_API_KEY`
     - **Value**: `[Aquí pega tu API Key real del New York Times]`
   - Haz clic en **Add**.

4. **Desplegar**
   - Haz clic en el botón **Deploy**. Vercel detectará automáticamente que es una aplicación estática con funciones de servidor (Serverless Functions).

5. **Verificar PWA**
   - Una vez el deploy termine, abre la URL que te da Vercel.
   - Chrome mostrará el icono de "Instalar" (⊕) en la barra de direcciones.
   - En móviles, podrás guardarlo como una App real en la pantalla de inicio.

6. **Manejo de Errores**
   - Si la app muestra "Error de Configuración", verifica en la pestaña **Settings > Environment Variables** de Vercel que el nombre sea exactamente `NYT_API_KEY`.