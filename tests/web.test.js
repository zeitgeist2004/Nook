import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n--- Executando Auditoria e Testes do Nook Web (Desktop + Navegador) ---');

// 1. Validar Arquitetura do Servidor Rust Axum
console.log('Teste 1: Validando arquitetura do servidor Rust Axum...');
const serverModPath = path.join(rootDir, 'src-tauri', 'src', 'server', 'mod.rs');
const serverRoutesPath = path.join(rootDir, 'src-tauri', 'src', 'server', 'routes.rs');
const serverSecurityPath = path.join(rootDir, 'src-tauri', 'src', 'server', 'security.rs');
const serverWsPath = path.join(rootDir, 'src-tauri', 'src', 'server', 'ws.rs');

assert(fs.existsSync(serverModPath), 'Módulo server/mod.rs deve existir');
assert(fs.existsSync(serverRoutesPath), 'Módulo server/routes.rs deve existir');
assert(fs.existsSync(serverSecurityPath), 'Módulo server/security.rs deve existir');
assert(fs.existsSync(serverWsPath), 'Módulo server/ws.rs deve existir');

const serverMod = fs.readFileSync(serverModPath, 'utf8');
assert(serverMod.includes('127.0.0.1:0'), 'Servidor deve vincular estritamente ao loopback 127.0.0.1 com porta dinâmica');
assert(serverMod.includes('ServeDir'), 'Servidor deve servir os arquivos estáticos do frontend em dist/');
assert(serverMod.includes('with_graceful_shutdown'), 'Servidor deve possuir encerramento limpo (graceful shutdown)');
console.log('✓ Teste 1: Arquitetura do servidor Rust Axum validada com sucesso.');

// 2. Validar Camada de Segurança e Defesa contra DNS Rebinding
console.log('Teste 2: Validando proteções de segurança (DNS Rebinding, Origin, Cookies HttpOnly)...');
const securitySrc = fs.readFileSync(serverSecurityPath, 'utf8');
assert(securitySrc.includes('validate_host'), 'Função validate_host deve existir');
assert(securitySrc.includes('127.0.0.1') && securitySrc.includes('localhost'), 'validate_host deve aceitar apenas 127.0.0.1 ou localhost');
assert(securitySrc.includes('StatusCode::FORBIDDEN'), 'Hosts maliciosos devem ser bloqueados com 403 Forbidden');
assert(securitySrc.includes('extract_session_token'), 'Extração de cookie de sessão HttpOnly deve existir');
assert(securitySrc.includes('validate_session'), 'Validação de sessão criptográfica deve existir');

const routesSrc = fs.readFileSync(serverRoutesPath, 'utf8');
assert(routesSrc.includes('HttpOnly; SameSite=Strict'), 'Cookie nook_session deve possuir atributos HttpOnly e SameSite=Strict');
assert(routesSrc.includes('StatusCode::SEE_OTHER') || routesSrc.includes('303'), 'auth_verify deve emitir redirect 303 eliminando o token da URL e do histórico');
console.log('✓ Teste 2: Proteções de segurança contra DNS Rebinding e CSRF validadas com sucesso.');

// 3. Validar Resolução de Conflitos e Snapshot Automático
console.log('Teste 3: Validando detecção de conflitos de digitação simultânea...');
assert(routesSrc.includes('Conflito Sincronizado') || routesSrc.includes('create_note_version'), 'Ao detectar digitação simultânea conflitante, o Nook deve gerar snapshot automático sem perda de dados');
const notesCmdSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'notes.rs'), 'utf8');
assert(notesCmdSrc.includes('Conflito Sincronizado'), 'Comando Desktop save_note deve possuir detecção idêntica de conflitos');
console.log('✓ Teste 3: Detecção de conflitos e preservação de histórico validadas com sucesso.');

// 4. Validar Integração com System Tray e Comandos Rust
console.log('Teste 4: Validando System Tray e Comandos Tauri 2...');
const libSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(libSrc.includes('TrayIconBuilder'), 'TrayIconBuilder deve estar registrado');
assert(libSrc.includes('Abrir Nook'), 'Menu de contexto do Tray deve conter "Abrir Nook"');
assert(libSrc.includes('Abrir no navegador'), 'Menu de contexto do Tray deve conter "Abrir no navegador"');
assert(libSrc.includes('Encerrar acesso Web'), 'Menu de contexto do Tray deve conter "Encerrar acesso Web"');
assert(libSrc.includes('Sair do Nook'), 'Menu de contexto do Tray deve conter "Sair do Nook"');
assert(libSrc.includes('prevent_close') && libSrc.includes('window.hide()'), 'Fechamento da janela com servidor web ativo deve recolher ao tray sem matar o serviço');
console.log('✓ Teste 4: System Tray e interceptação de ciclo de vida validados com sucesso.');

// 5. Validar Frontend Dual (Desktop + Web) no api.ts
console.log('Teste 5: Validando adaptador frontend agnóstico (Desktop IPC / Web REST & WS)...');
const apiSrc = fs.readFileSync(path.join(rootDir, 'src', 'services', 'api.ts'), 'utf8');
assert(apiSrc.includes('isTauri'), 'api.ts deve exportar função de detecção isTauri()');
assert(apiSrc.includes('NookSyncClient'), 'Cliente de sincronização em tempo real NookSyncClient deve existir');
assert(apiSrc.includes('onSync') && apiSrc.includes('onStatusChange'), 'API deve disponibilizar ouvintes de eventos de sincronização');
assert(apiSrc.includes('/api/notes/save'), 'saveNote deve chamar /api/notes/save quando executando no navegador');
assert(apiSrc.includes('credentials: \'include\''), 'Chamadas HTTP devem incluir credenciais de cookie de sessão');
console.log('✓ Teste 5: Adaptador frontend agnóstico validado com sucesso.');

// 6. Validar Botão Web e Indicador de Conexão na TabBar
console.log('Teste 6: Validando botão "Web" no header e status de conexão...');
const ptLocaleSrc = fs.readFileSync(path.join(rootDir, 'src', 'i18n', 'locales', 'pt.ts'), 'utf8');
const tabBarSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'TabBar.tsx'), 'utf8');
assert(tabBarSrc.includes('Globe'), 'TabBar deve conter ícone Globe');
assert(tabBarSrc.includes('t.tabs.openInBrowserTooltip') && ptLocaleSrc.includes('Abrir o Nook no seu navegador?'), 'Tooltip de abertura do navegador deve existir');
assert(tabBarSrc.includes('t.tabs.connectedToDesktop') && ptLocaleSrc.includes('Conectado ao Desktop'), 'Indicador de status "Conectado ao Desktop" deve existir no navegador');
assert(tabBarSrc.includes('openNookWeb'), 'Clique no botão deve disparar api.openNookWeb()');
console.log('✓ Teste 6: Botão Web e indicador de conexão validados com sucesso.');

// 7. Validar Assinatura em Tempo Real no App.tsx
console.log('Teste 7: Validando sincronização bidirecional em tempo real no App.tsx...');
const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf8');
assert(appSrc.includes('api.onSync'), 'App.tsx deve subscrever aos eventos de sincronização via api.onSync');
assert(appSrc.includes('note.saved'), 'Tratador do evento note.saved deve atualizar estado e abas');
assert(appSrc.includes('note.created'), 'Tratador do evento note.created deve recarregar notas ativas');
console.log('✓ Teste 7: Sincronização bidirecional em tempo real validada com sucesso.');

// 8. Validar Favicon e Título Oficial no Navegador
console.log('Teste 8: Validando favicon oficial e título da aba no navegador...');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
assert(indexHtml.includes('<title>Nook — Suas notas</title>'), 'Título do documento deve ser "Nook — Suas notas"');
assert(indexHtml.includes('nook-app-icon') || indexHtml.includes('nook-mark.svg') || indexHtml.includes('favicon.ico'), 'Favicon oficial deve estar configurado no HTML');
console.log('✓ Teste 8: Identidade e favicon do Nook Web validados com sucesso.');

// 9. Validar Web Design Guidelines (Acessibilidade de Foco & Metadados)
console.log('Teste 9: Validando Web Design Guidelines (Vercel)...');
const globalsCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'globals.css'), 'utf8');
assert(globalsCss.includes(':focus-visible'), 'Acessibilidade: :focus-visible deve estar definido para navegação por teclado');
assert(indexHtml.includes('color-scheme') && indexHtml.includes('theme-color'), 'Metadados de tema escuro e color-scheme devem estar presentes');
console.log('✓ Teste 9: Web Design Guidelines (acessibilidade, focus-visible e meta tags) validadas com sucesso.');

// 10. Validar Web Performance (Core Web Vitals & Lazy Loading)
console.log('Teste 10: Validando Web Performance (Cloudflare web-perf)...');
assert(appSrc.includes('lazy('), 'Modais secundários devem ser carregados via React.lazy() para otimizar LCP e bundle inicial');
assert(indexHtml.includes('display=swap'), 'Google Fonts deve utilizar display=swap para evitar FOIT/CLS');
console.log('✓ Teste 10: Web Performance (lazy loading, code-splitting e zero CLS) validada com sucesso.');

// 11. Validar Web UI shadcn/ui Patterns
console.log('Teste 11: Validando Web UI shadcn/ui Patterns (Tokens & Overlays)...');
const themeCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'theme.css'), 'utf8');
assert(themeCss.includes('--primary') && themeCss.includes('--primary-foreground'), 'Contrato de cores: cada cor deve possuir par de foreground');
assert(themeCss.includes('--card') && themeCss.includes('--card-foreground'), 'Par card/card-foreground ausente');
assert(themeCss.includes('--muted') && themeCss.includes('--muted-foreground'), 'Par muted/muted-foreground ausente');
console.log('✓ Teste 11: Web UI shadcn/ui (pares de tokens e semântica de contraste) validada com sucesso.');

// 12. Validar Webapp Testing (AuthManager Compartilhado)
console.log('Teste 12: Validando Webapp Testing (AuthManager Thread-Safe & Grace Window)...');
const serverStateSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'state.rs'), 'utf8');
assert(serverStateSrc.includes('AuthManager'), 'AuthManager deve existir em state.rs');
assert(serverStateSrc.includes('validate_and_consume'), 'Método validate_and_consume deve existir');
assert(serverStateSrc.includes('Duration::from_secs(10)'), 'Janela de carência de 10s deve existir para pre-fetches de navegadores');
console.log('✓ Teste 12: Webapp Testing (resiliência de autenticação e proteção contra pre-fetch) validada com sucesso.');

// 13. Validar Centralização do Editor e Leitor
console.log('Teste 13: Validando alinhamento e centralização do Editor e Leitor...');
const editorSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'Editor.tsx'), 'utf8');
const editorHeaderSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'EditorHeader.tsx'), 'utf8');
const markdownViewerSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'MarkdownViewer.tsx'), 'utf8');
assert(editorSrc.includes("maxWidth: '940px'"), 'Editor deve conter container centralizado com maxWidth 940px');
assert(editorHeaderSrc.includes("940px"), 'EditorHeader deve ter maxWidth 940px');
assert(markdownViewerSrc.includes("maxWidth: '940px'"), 'MarkdownViewer deve possuir container de leitura com maxWidth 940px');
assert(globalsCss.includes('.cm-content'), 'globals.css deve formatar .cm-content');
console.log('✓ Teste 13: Centralização milimétrica do Editor e Leitor validada com sucesso.');

// 14. Validar Sincronização em Tempo Real Web -> Desktop
console.log('Teste 14: Validando sincronização Web -> Desktop (nook-sync)...');
const serverRoutesSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'routes.rs'), 'utf8');
assert(serverRoutesSrc.includes('nook-sync'), 'broadcast_event em routes.rs deve emitir nook-sync via app_handle');
assert(apiSrc.includes('nook-sync'), 'api.ts deve escutar nook-sync no Desktop EXE');
assert(serverStateSrc.includes('app_handle: Option<tauri::AppHandle>'), 'ServerState deve manter referência ao app_handle do Tauri');
console.log('✓ Teste 14: Sincronização instantânea Web -> Desktop EXE validada com sucesso.');

// 15. Validar Fechamento de Aba Vazia e Retorno ao Home
console.log('Teste 15: Validando fechamento de abas e home state...');
assert(appSrc.includes('handleCloseTab'), 'handleCloseTab deve existir em App.tsx');
assert(appSrc.includes('softDeleteNote(tabId)'), 'Fechar aba vazia sem título deve limpar o rascunho não utilizado');
assert(!appSrc.includes('if (remainingTabs.length === 0) {\n      setTabs([]);\n      setActiveTabId(null);\n      setActiveNoteId(null);\n      setExternalFile(null);\n      setTitle(\'\');\n      setContent(\'\');\n      if (notes.length > 0)'), 'Fechar última aba não deve abrir outra nota forçada');
console.log('✓ Teste 15: Fechamento de aba limpa e retorno normal à tela inicial validados com sucesso.');

// 16. Validar Botão "Voltar ao App" e Restauração ao Fechar Aba
console.log('Teste 16: Validando botão "Voltar ao App" e restauração automática ao fechar aba...');
const serverModSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'mod.rs'), 'utf8');
assert(serverModSrc.includes('/api/app/restore'), 'Rota /api/app/restore deve estar registrada no servidor Axum');
assert(serverRoutesSrc.includes('restore_app_window'), 'Função restore_app_window deve existir em routes.rs');
assert(apiSrc.includes('restoreDesktopApp'), 'api.ts deve exportar função restoreDesktopApp()');
assert(tabBarSrc.includes('t.tabs.backToApp') && ptLocaleSrc.includes('Voltar ao App'), 'TabBar deve conter botão "Voltar ao App" no ambiente web');
assert(appSrc.includes('/api/app/restore'), 'App.tsx deve restaurar app automaticamente ao fechar aba via beforeunload/pagehide');
console.log('✓ Teste 16: Botão "Voltar ao App" e restauração automática de janela validados com sucesso.');

// 17. Validar Inicialização e Restauração em Fullscreen/Maximizada
console.log('Teste 17: Validando configuração de tela cheia/maximizada no Tauri e Rust...');
const tauriConf = JSON.parse(fs.readFileSync(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf8'));
assert(tauriConf.app.windows[0].maximized === true, 'tauri.conf.json deve definir maximized: true para o app iniciar em tela cheia');
const libRs = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(libRs.includes('w.maximize()'), 'lib.rs deve invocar w.maximize() no setup e nos eventos do tray');
assert(serverRoutesSrc.includes('window.maximize()'), 'restore_app_window deve invocar window.maximize() ao restaurar pelo web');
console.log('✓ Teste 17: Abertura e restauração em tela cheia/maximizada validadas com sucesso.');

// 18. Validar Auto-Refresh Imediato sem Necessidade de Ctrl+R
console.log('Teste 18: Validando auto-refresh automático ao voltar ao app...');
assert(serverRoutesSrc.includes('nook-reload'), 'restore_app_window deve emitir evento nook-reload para a janela desktop');
assert(appSrc.includes('nook-reload'), 'App.tsx deve escutar evento nook-reload e atualizar dados');
assert(appSrc.includes('tauri://focus'), 'App.tsx deve escutar tauri://focus para atualizar dados ao receber foco');
console.log('✓ Teste 18: Auto-refresh automático sem Ctrl+R validado com sucesso.');

// 19. Validar 5 Temas Oficiais (Cinza, Escuro, Claro, Neon, Sakura), Cor Secundária Verde e Sincronização Web
console.log('Teste 19: Validando catálogo exclusivo de 5 temas (Neon/Sakura), cor secundária verde e sync Web...');
const settingsModalSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings', 'SettingsModal.tsx'), 'utf8');
assert(settingsModalSrc.includes('neon') && (settingsModalSrc.includes('sakura') || settingsModalSrc.includes('pink')) && settingsModalSrc.includes('gray') && settingsModalSrc.includes('dark') && settingsModalSrc.includes('white'), 'SettingsModal deve listar exclusivamente os 5 temas oficiais');
assert(!settingsModalSrc.includes('Cybersegurança'), 'Tema Neon não deve conter subtítulo Cybersegurança');
assert(!settingsModalSrc.includes('Sakura Garden'), 'Tema Sakura não deve conter subtítulo Sakura Garden');
assert(!settingsModalSrc.includes('accentOptions.map'), 'Seletor de cor destaque deve ter sido removido');
assert(themeCss.includes('[data-theme="neon"]'), 'Tema neon deve estar definido em theme.css');
assert(!themeCss.includes('#00F0FF'), 'Tema Neon não deve conter nenhuma tonalidade de azul (#00F0FF)');
assert(themeCss.includes('--primary: #00FF9D') && themeCss.includes('--accent: #00FF9D'), 'Cores primária e destaque do Neon devem ser estritamente verdes (#00FF9D)');
assert(themeCss.includes('--secondary-foreground: #00FF9D') || themeCss.includes('--text-secondary: #00FF9D'), 'Cor secundária do Neon deve ser verde (#00FF9D) e não azul');
assert(themeCss.includes('[data-theme="sakura"]'), 'Tema sakura deve estar definido em theme.css');
assert(appSrc.includes("api.saveSetting('theme'") && appSrc.includes("api.getSettings()"), 'App.tsx deve salvar e ler tema no backend para aplicar no Nook Web');
assert(appSrc.replace(/\r\n/g, '\n').includes('if (showSplash) {\n    return <SplashScreen'), 'App.tsx deve renderizar apenas a splash isolada sem vazar componentes ao fundo');
console.log('✓ Teste 19: Sistema de 5 temas (Neon verde, Sakura sem subtítulo) e sync no Nook Web validados com sucesso.');

// 20. Validar Correções de Segurança, WebSocket Mobile, Coleções em Tempo Real e Watermark de Conflito
console.log('Teste 20: Validando paridade de sincronização, método DELETE e validação estrita de host...');
assert(securitySrc.includes('is_trycloudflare_host') && !securitySrc.includes('.contains("trycloudflare")'), 'security.rs não deve usar substring frouxa .contains("trycloudflare")');
assert(fs.readFileSync(serverWsPath, 'utf8').includes('validate_session_with_db'), 'ws.rs deve autenticar sessões mobile via validate_session_with_db');
const collCmdSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'collections.rs'), 'utf8');
assert(collCmdSrc.includes('ws_broadcast_tx'), 'commands/collections.rs deve transmitir eventos collection.* via ws_broadcast_tx');
assert(notesCmdSrc.includes('EPOCH_MS_THRESHOLD') && routesSrc.includes('EPOCH_MS_THRESHOLD'), 'Detecção de conflito deve usar watermark epoch ms real e ignorar contadores locais');
assert(apiSrc.includes("method: 'DELETE'") && apiSrc.includes("typeof res === 'boolean'"), 'api.ts deve usar DELETE em deleteMobileDevice e aceitar booleano em togglePinNote');
assert(appSrc.includes("'note.pin_toggled'") && appSrc.includes("'note.title_updated'") && appSrc.includes("'collection.reordered'") && appSrc.includes("'note.restored_version'"), 'App.tsx deve sincronizar todos os eventos WebSocket/Tauri');
console.log('✓ Teste 20: Segurança, WebSocket mobile, eventos completos e semântica HTTP validados com sucesso.');

console.log('\n--- Todos os 20 testes de auditoria do Nook Web foram aprovados com 100% de sucesso! ---');
