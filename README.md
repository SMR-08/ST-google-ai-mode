# Google AI Mode MCP para SillyTavern

Extensión de SillyTavern que descubre las tools de `Google-AI-MCP/server/mcp.mjs` mediante MCP y las registra dinámicamente como function tools. No contiene nombres, modelos ni esquemas de tools hardcodeados.

## Componentes

- `index.js`, `settings.html`, `manifest.json`: extensión web.
- `server.mjs`: puente HTTP → MCP stdio. Descubrimiento `GET /tools`, ejecución `POST /call`, salud `GET /health`.
- CORS abierto (`*`), token obligatorio salvo `/health` y preflight.

## Backend

Requisitos: Node.js 20+, el proyecto Google-AI-MCP y su backend funcionando.

```bash
cd /home/mht/Documentos/SillyTavern-Google-AI-Mode
npm install
npm start
```

Por defecto lee el MCP y el token de `../Google-AI-MCP` y escucha en `127.0.0.1:32152`. Configuración opcional:

- `GOOGLE_AI_MODE_MCP`: ruta a `server/mcp.mjs`.
- `GOOGLE_AI_MODE_TOKEN_FILE`: archivo con el token.
- `ST_GOOGLE_AI_MODE_TOKEN`: token explícito; tiene prioridad sobre el archivo.
- `ST_GOOGLE_AI_MODE_HOST`, `ST_GOOGLE_AI_MODE_PORT`.
- `ST_GOOGLE_AI_MODE_TIMEOUT_MS` (900000 por defecto).
- `ST_GOOGLE_AI_MODE_CORS_ORIGIN` (`*` por defecto).

Despliegue actual: servicio systemd `google-ai-mode-st-bridge.service`, publicado solo dentro de Tailscale como `http://100.64.0.13:32152`. IP VPN: `100.64.0.13`; puerto: `32152`.

Si SillyTavern se abre por HTTPS, el navegador bloqueará esta URL HTTP por mixed-content; en ese caso hace falta publicar el puente mediante HTTPS en el mismo dominio de SillyTavern o usar SillyTavern por HTTP dentro de la VPN. CORS no elimina esa restricción.

## SillyTavern

Instala esta carpeta como `public/scripts/extensions/third-party/SillyTavern-Google-AI-Mode` (o mediante el instalador de extensiones si el repo tiene remoto Git). Recarga SillyTavern y abre **Extensions → Google AI Mode MCP**:

1. URL: `http://100.64.0.13:32152`.
2. Token: contenido de `/home/mht/Documentos/Google-AI-MCP/.run/bridge-token` en el equipo backend.
3. Pulsa **Guardar y descubrir tools** y selecciona las permitidas.
4. Activa **Enable function calling** en **AI Response Configuration**. Function Calling solo funciona con APIs/modelos compatibles de Chat Completion.

El navegador debe poder resolver `equipo.vpn.dns` y acceder a la tailnet. No copies el token al repo.

## Verificación

```bash
npm run check
npm test
curl -fsS http://100.64.0.13:32152/health
```

La prueba levanta un puente temporal, comprueba preflight CORS, rechazo sin token, inventario MCP real y una llamada real a `google_ai_mode_status`.
