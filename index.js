import { renderExtensionTemplateAsync } from '../../../extensions.js';

const EXTENSION_DIR_NAME = 'ST-google-ai-mode';
const MODULE_NAME = 'google_ai_mode_mcp';
const EXTENSION_PATH = (function() {
    try {
        const url = import.meta.url;
        const match = url.match(/\/scripts\/extensions\/(.*?)\/[^\/]+$/);
        if (match && match[1]) return match[1];
    } catch {}
    return `third-party/${EXTENSION_DIR_NAME}`;
})();
const defaults = Object.freeze({ url: '', token: '', enabled: true, tools: {} });
let tools = [];
const registered = new Set();

function settings() {
    const { extensionSettings } = SillyTavern.getContext();
    extensionSettings[MODULE_NAME] ||= structuredClone(defaults);
    for (const [key, value] of Object.entries(defaults)) {
        if (!Object.hasOwn(extensionSettings[MODULE_NAME], key)) extensionSettings[MODULE_NAME][key] = structuredClone(value);
    }
    return extensionSettings[MODULE_NAME];
}

async function api(path, options = {}) {
    const config = settings();
    const base = config.url.trim().replace(/\/+$/, '');
    if (!base || !config.token) throw new Error('Configura la URL y el token del puente MCP');
    const url = new URL(`${base}${path}`);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('La URL debe usar HTTP o HTTPS');
    const response = await fetch(url, {
        ...options,
        headers: { 'x-api-token': config.token, 'content-type': 'application/json', ...options.headers },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw new Error(payload?.error || `HTTP ${response.status}`);
    return payload;
}

function resultText(result) {
    let text;
    if (result?.structuredContent !== undefined) text = JSON.stringify(result.structuredContent);
    else if (Array.isArray(result?.content)) {
        text = result.content.map(item => item.type === 'text' ? item.text : `[${item.type}: ${item.mimeType || 'sin tipo'}]`).join('\n');
    } else text = JSON.stringify(result);
    return result?.isError ? `Error MCP:\n${text}` : text;
}

function registerTools() {
    const context = SillyTavern.getContext();
    if (!context.registerFunctionTool || !context.unregisterFunctionTool) return;
    for (const name of registered) context.unregisterFunctionTool(name);
    registered.clear();
    const config = settings();
    if (!config.enabled) return;
    for (const tool of tools) {
        if (!config.tools[tool.name]) continue;
        context.registerFunctionTool({
            name: tool.name,
            displayName: tool.title || tool.name,
            description: tool.description || tool.name,
            parameters: tool.inputSchema || { type: 'object', properties: {} },
            action: async args => resultText(await api('/call', {
                method: 'POST',
                body: JSON.stringify({ name: tool.name, arguments: args || {} }),
            })),
            formatMessage: () => `Ejecutando ${tool.title || tool.name}`,
        });
        registered.add(tool.name);
    }
}

function renderTools() {
    const container = document.getElementById('gam_mcp_tools');
    container.replaceChildren();
    const config = settings();
    for (const tool of tools) {
        const label = document.createElement('label');
        label.className = 'checkbox_label gam_mcp_tool';
        label.title = tool.description || '';
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = config.tools[tool.name] === true;
        input.addEventListener('change', () => {
            config.tools[tool.name] = input.checked;
            SillyTavern.getContext().saveSettingsDebounced();
            registerTools();
        });
        const text = document.createElement('span');
        text.textContent = tool.title || tool.name;
        label.append(input, text);
        container.append(label);
    }
}

async function refreshTools() {
    const status = document.getElementById('gam_mcp_status');
    const button = document.getElementById('gam_mcp_save');
    button.disabled = true;
    status.textContent = 'Descubriendo tools…';
    try {
        const discovered = (await api('/tools')).tools;
        if (!Array.isArray(discovered) || discovered.some(tool => typeof tool.name !== 'string')) throw new Error('Respuesta tools/list inválida');
        tools = discovered;
        const config = settings();
        config.tools = Object.fromEntries(tools.map(tool => [tool.name, config.tools[tool.name] !== false]));
        renderTools();
        registerTools();
        SillyTavern.getContext().saveSettingsDebounced();
        status.textContent = `${tools.length} tools; ${registered.size} activas.`;
    } catch (error) {
        status.textContent = error.message;
        toastr.error(error.message, 'Google AI Mode MCP');
    } finally {
        button.disabled = false;
    }
}

jQuery(async () => {
    const html = await renderExtensionTemplateAsync(EXTENSION_PATH, 'settings');
    $('#extensions_settings2').append(html);
    const config = settings();
    $('#gam_mcp_url').val(config.url).on('input', event => { config.url = event.target.value; });
    $('#gam_mcp_token').val(config.token).on('input', event => { config.token = event.target.value; });
    $('#gam_mcp_enabled').prop('checked', config.enabled).on('change', event => {
        config.enabled = event.target.checked;
        SillyTavern.getContext().saveSettingsDebounced();
        registerTools();
    });
    $('#gam_mcp_save').on('click', () => { SillyTavern.getContext().saveSettingsDebounced(); void refreshTools(); });
    if (config.url && config.token) void refreshTools();
});
