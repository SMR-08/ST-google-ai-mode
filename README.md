# Google AI Mode MCP para SillyTavern

Extensión de SillyTavern que descubre las tools de `Google-AI-MCP/server/mcp.mjs` mediante MCP y las registra dinámicamente como function tools. No contiene nombres, modelos ni esquemas de tools hardcodeados.

## Componentes

- `index.js`, `settings.html`, `manifest.json`: extensión web.
- `server.mjs`: puente HTTP → MCP stdio. Descubrimiento `GET /tools`, ejecución `POST /call`, salud `GET /health`.
- CORS abierto (`*`), token obligatorio salvo `/health` y preflight.

## Backend

Requisitos: Node.js 20+, el proyecto Google-AI-MCP y su backend funcionando.

```bash
git clone <repo-url> ST-google-ai-mode
cd ST-google-ai-mode
npm install
npm start
```

Por defecto lee el MCP y el token de `../Google-AI-MCP` y escucha en `127.0.0.1:32152`. Configuración opcional por variables de entorno:

- `GOOGLE_AI_MODE_MCP`: ruta a `server/mcp.mjs`.
- `GOOGLE_AI_MODE_TOKEN_FILE`: archivo con el token.
- `ST_GOOGLE_AI_MODE_TOKEN`: token explícito; tiene prioridad sobre el archivo.
- `ST_GOOGLE_AI_MODE_HOST`, `ST_GOOGLE_AI_MODE_PORT`.
- `ST_GOOGLE_AI_MODE_TIMEOUT_MS` (900000 por defecto).
- `ST_GOOGLE_AI_MODE_CORS_ORIGIN` (`*` por defecto).

## SillyTavern

Instala la extensión en SillyTavern mediante el instalador de extensiones ("Install from URL") o clonando el repo dentro de `public/scripts/extensions/third-party/ST-google-ai-mode`. Recarga SillyTavern y abre **Extensions → Google AI Mode MCP**:

1. URL: dirección accesible del puente (ej. `http://<IP_O_DOMINIO>:32152`).
2. Token: token configurado en el puente / backend.
3. Pulsa **Guardar y descubrir tools** y selecciona las permitidas.
4. Activa **Enable function calling** en **AI Response Configuration**. Function Calling requiere una API/modelo de Chat Completion compatible.

Aviso: Si SillyTavern se sirve mediante HTTPS, el navegador bloqueará peticiones HTTP al puente por mixed-content; el puente debe exponerse bajo HTTPS o usar SillyTavern por HTTP.

## Verificación

```bash
npm run check
npm test
curl -fsS http://localhost:32152/health
```

La prueba levanta un puente temporal, comprueba preflight CORS, rechazo sin token, inventario MCP real y una llamada real a `google_ai_mode_status`.
