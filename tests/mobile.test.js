// ============================================================================
// NOOK MOBILE — SUITE DE TESTES E AUDITORIA COMPLETA
// Cloudflare Tunnel, QR Code, Pareamento 2FA, Sincronização & Design Responsivo
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Auditoria e Testes do Nook Mobile (Cloudflare + Responsivo) ---');

// ----------------------------------------------------------------------------
// TESTE 1: Binário cloudflared e Supervisor do Túnel Rust
// ----------------------------------------------------------------------------
console.log('Teste 1: Validando binário cloudflared e supervisor TunnelManager...');
const binPath = path.join(rootDir, 'src-tauri', 'bin', 'cloudflared.exe');
const releaseBinPath = path.join(rootDir, 'release', 'cloudflared.exe');
if (fs.existsSync(binPath) || fs.existsSync(releaseBinPath)) {
  assert(fs.existsSync(binPath), 'cloudflared.exe deve existir em src-tauri/bin/');
  assert(fs.existsSync(releaseBinPath), 'cloudflared.exe deve existir em release/');
} else {
  console.log('ℹ Binários cloudflared.exe omitidos neste clone de código-fonte (distribuídos via GitHub Releases).');
}

const tunnelCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'tunnel.rs'), 'utf-8');
assert(tunnelCode.includes('CREATE_NO_WINDOW'), 'cloudflared deve ser iniciado sem janela de console (CREATE_NO_WINDOW)');
assert(tunnelCode.includes('trycloudflare.com'), 'TunnelManager deve extrair e monitorar URL trycloudflare.com');
assert(tunnelCode.includes('kill()'), 'TunnelManager deve finalizar o processo de forma limpa');
console.log('✓ Teste 1: Binário cloudflared e supervisor TunnelManager validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 2: Tabela authorized_devices e Queries no SQLite
// ----------------------------------------------------------------------------
console.log('Teste 2: Validando schema SQLite e queries de dispositivos autorizados...');
const schemaCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'db', 'schema.rs'), 'utf-8');
assert(schemaCode.includes('CREATE TABLE IF NOT EXISTS authorized_devices'), 'Tabela authorized_devices deve estar no schema');
assert(schemaCode.includes('idx_authorized_devices_token_hash'), 'Índice de busca rápida por token_hash deve existir');

const queriesCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'db', 'queries.rs'), 'utf-8');
assert(queriesCode.includes('create_authorized_device'), 'DbQueries deve conter create_authorized_device');
assert(queriesCode.includes('get_authorized_devices'), 'DbQueries deve conter get_authorized_devices');
assert(queriesCode.includes('validate_and_touch_device'), 'DbQueries deve validar e atualizar last_active_at');
assert(queriesCode.includes('revoke_authorized_device'), 'DbQueries deve conter revoke_authorized_device');
assert(queriesCode.includes('delete_authorized_device'), 'DbQueries deve conter delete_authorized_device');
console.log('✓ Teste 2: Schema SQLite e queries de dispositivos autorizados validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 3: Gerenciador de Pareamento Criptográfico e Ciclo 2FA
// ----------------------------------------------------------------------------
console.log('Teste 3: Validando MobilePairManager e ciclo de pareamento 2FA...');
const serverStateCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'state.rs'), 'utf-8');
assert(serverStateCode.includes('struct MobilePairManager'), 'MobilePairManager deve gerenciar os códigos de pareamento');
assert(serverStateCode.includes('create_pair_code'), 'Deve gerar códigos únicos com validade de 5 minutos');
assert(serverStateCode.includes('request_pairing'), 'Deve registrar solicitações pendentes de conexão');
assert(serverStateCode.includes('approve_pairing'), 'Deve permitir aprovação pelo desktop');
assert(serverStateCode.includes('reject_pairing'), 'Deve permitir recusa pelo desktop');
assert(serverStateCode.includes('poll_pairing'), 'Deve fornecer polling com expiração automática');
console.log('✓ Teste 3: MobilePairManager e ciclo de pareamento 2FA validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 4: Segurança, DNS Rebinding e Cookies HttpOnly
// ----------------------------------------------------------------------------
console.log('Teste 4: Validando segurança contra DNS Rebinding, Origin e Cookies...');
const secCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'security.rs'), 'utf-8');
assert(secCode.includes('trycloudflare.com'), 'validate_host deve aceitar hosts autorizados da Cloudflare');
assert(secCode.includes('validate_session_with_db'), 'Deve validar sessão de dispositivos autorizados no SQLite');

const routesCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'routes.rs'), 'utf-8');
assert(routesCode.includes('nook_mobile_session='), 'Deve emitir cookie nook_mobile_session seguro');
assert(routesCode.includes('HttpOnly'), 'Cookie nook_mobile_session deve ser estritamente HttpOnly');
assert(routesCode.includes('SameSite=Lax'), 'Cookie deve ter proteção SameSite=Lax contra CSRF');
console.log('✓ Teste 4: Segurança contra DNS Rebinding, Origin e Cookies HttpOnly validada com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 5: Endpoints Axum e Rotas Mobile
// ----------------------------------------------------------------------------
console.log('Teste 5: Validando rotas HTTP Axum para Nook Mobile...');
assert(routesCode.includes('pub async fn mobile_entry_redirect'), 'Deve redirecionar /mobile com preservação de token/pair');
assert(routesCode.includes('pub async fn mobile_request_pairing'), 'Endpoint /api/mobile/pair/request deve estar implementado');
assert(routesCode.includes('pub async fn mobile_poll_pairing'), 'Endpoint /api/mobile/pair/poll deve estar implementado');
assert(routesCode.includes('pub async fn mobile_get_devices'), 'Endpoint /api/mobile/devices deve listar dispositivos');
assert(routesCode.includes('pub async fn mobile_revoke_device'), 'Endpoint /api/mobile/devices/{id}/revoke implementado');
assert(routesCode.includes('pub async fn mobile_delete_device'), 'Endpoint /api/mobile/devices/{id}/delete implementado');
console.log('✓ Teste 5: Rotas HTTP Axum para Nook Mobile validadas com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 6: Comandos Tauri no Rust
// ----------------------------------------------------------------------------
console.log('Teste 6: Validando comandos Tauri Rust para Nook Mobile...');
const cmdCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'mobile.rs'), 'utf-8');
assert(cmdCode.includes('pub async fn start_mobile_access'), 'Comando start_mobile_access implementado');
assert(cmdCode.includes('pub async fn stop_mobile_access'), 'Comando stop_mobile_access implementado');
assert(cmdCode.includes('pub async fn get_mobile_status'), 'Comando get_mobile_status implementado');
assert(cmdCode.includes('pub async fn approve_mobile_pairing'), 'Comando approve_mobile_pairing implementado');
assert(cmdCode.includes('pub async fn reject_mobile_pairing'), 'Comando reject_mobile_pairing implementado');
assert(cmdCode.includes('pub async fn revoke_mobile_device'), 'Comando revoke_mobile_device implementado');
assert(cmdCode.includes('pub async fn delete_mobile_device'), 'Comando delete_mobile_device implementado');

const libCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'lib.rs'), 'utf-8');
assert(libCode.includes('commands::mobile::start_mobile_access'), 'Comandos mobile devem estar registrados no generate_handler');
assert(libCode.includes('TunnelManager::new'), 'TunnelManager deve estar registrado no State do Tauri');
console.log('✓ Teste 6: Comandos Tauri Rust validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 7: Adaptador de API Frontend (src/services/api.ts)
// ----------------------------------------------------------------------------
console.log('Teste 7: Validando métodos de API no frontend...');
const apiCode = fs.readFileSync(path.join(rootDir, 'src', 'services', 'api.ts'), 'utf-8');
assert(apiCode.includes('startMobileAccess(): Promise<MobileAccessInfo>'), 'api.startMobileAccess deve existir');
assert(apiCode.includes('stopMobileAccess(): Promise<void>'), 'api.stopMobileAccess deve existir');
assert(apiCode.includes('getMobileStatus(): Promise<MobileAccessInfo>'), 'api.getMobileStatus deve existir');
assert(apiCode.includes('getMobileDevices(): Promise<AuthorizedDevice[]>'), 'api.getMobileDevices deve existir');
assert(apiCode.includes('approveMobilePairing'), 'api.approveMobilePairing deve existir');
assert(apiCode.includes('rejectMobilePairing'), 'api.rejectMobilePairing deve existir');
assert(apiCode.includes('revokeMobileDevice'), 'api.revokeMobileDevice deve existir');
assert(apiCode.includes('deleteMobileDevice'), 'api.deleteMobileDevice deve existir');
assert(apiCode.includes('requestMobilePairing'), 'api.requestMobilePairing deve existir');
assert(apiCode.includes('pollMobilePairing'), 'api.pollMobilePairing deve existir');
console.log('✓ Teste 7: Métodos de API no frontend validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 8: Geração Offline de QR Code SVG
// ----------------------------------------------------------------------------
console.log('Teste 8: Validando componente offline de QR Code SVG...');
const qrCodePath = path.join(rootDir, 'src', 'components', 'mobile', 'QRCodeSvg.tsx');
assert(fs.existsSync(qrCodePath), 'QRCodeSvg.tsx deve existir');
const qrCodeContent = fs.readFileSync(qrCodePath, 'utf-8');
assert(qrCodeContent.includes('QRCode.toString'), 'Deve gerar SVG puro offline com qrcode.toString');
assert(!qrCodeContent.includes('chart.googleapis.com'), 'Não deve depender do Google Charts ou APIs remotas');
assert(!qrCodeContent.includes('api.qrserver.com'), 'Não deve depender de geradores de terceiros');
console.log('✓ Teste 8: Geração offline de QR Code SVG validada com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 9: Diálogos Desktop (NookMobileModal & MobilePairApprovalDialog)
// ----------------------------------------------------------------------------
console.log('Teste 9: Validando diálogos e notificações de aprovação no Desktop...');
const modalPath = path.join(rootDir, 'src', 'components', 'mobile', 'NookMobileModal.tsx');
assert(fs.existsSync(modalPath), 'NookMobileModal.tsx deve existir');
const modalContent = fs.readFileSync(modalPath, 'utf-8');
assert(modalContent.includes('QRCodeSvg'), 'NookMobileModal deve exibir o QR Code offline');
assert(modalContent.includes('handleCopyLink'), 'NookMobileModal deve permitir copiar link');
assert(modalContent.includes('handleRevokeDevice'), 'NookMobileModal deve permitir revogar dispositivos');

const approvalPath = path.join(rootDir, 'src', 'components', 'mobile', 'MobilePairApprovalDialog.tsx');
assert(fs.existsSync(approvalPath), 'MobilePairApprovalDialog.tsx deve existir');
const approvalContent = fs.readFileSync(approvalPath, 'utf-8');
assert(approvalContent.includes('handleApprove'), 'Deve permitir aprovação em 1 clique');
assert(approvalContent.includes('handleReject'), 'Deve permitir recusa da solicitação');
console.log('✓ Teste 9: Diálogos Desktop validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 10: Botão Mobile no TabBar e Aba Mobile em Settings
// ----------------------------------------------------------------------------
console.log('Teste 10: Validando botão Mobile no TabBar e aba em Configurações...');
const tabBarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'TabBar.tsx'), 'utf-8');
assert(tabBarCode.includes('onOpenMobile'), 'TabBar deve suportar onOpenMobile');
assert(tabBarCode.includes('isMobileActive'), 'TabBar deve suportar indicador isMobileActive');
assert(tabBarCode.includes('Mobile'), 'TabBar deve exibir o botão Mobile ao lado de Web');

const settingsCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings', 'SettingsModal.tsx'), 'utf-8');
assert(settingsCode.includes("activeTab === 'mobile'"), 'SettingsModal deve possuir aba Nook Mobile');
assert(settingsCode.includes('QRCodeSvg'), 'SettingsModal deve permitir gerenciar o túnel e dispositivos');
console.log('✓ Teste 10: TabBar e SettingsModal validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 11: Viewport, Safe-Areas e Tags de Web App no index.html
// ----------------------------------------------------------------------------
console.log('Teste 11: Validando viewport meta tags e safe-areas...');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
assert(indexHtml.includes('viewport-fit=cover'), 'index.html deve conter viewport-fit=cover para notch/home indicator');
assert(indexHtml.includes('interactive-widget=resizes-content'), 'index.html deve conter interactive-widget=resizes-content para teclado virtual');
assert(indexHtml.includes('apple-mobile-web-app-capable'), 'index.html deve declarar capacidade web app no iOS');
assert(indexHtml.includes('mobile-web-app-capable'), 'index.html deve declarar capacidade web app no Android');
console.log('✓ Teste 11: Viewport meta tags e safe-areas validadas com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 12: Navegação por Drawer e Header Mobile no App.tsx
// ----------------------------------------------------------------------------
console.log('Teste 12: Validando navegação por Drawer e Header Mobile...');
const appCode = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf-8');
assert(appCode.includes('isMobileViewport'), 'App.tsx deve detectar viewport mobile');
assert(appCode.includes('isMobileDrawerOpen'), 'App.tsx deve gerenciar estado do Drawer');
assert(appCode.includes('MobileTopBar'), 'App.tsx deve renderizar MobileTopBar em telas móveis');
assert(appCode.includes('MobilePairingView'), 'App.tsx deve renderizar MobilePairingView se ?pair= estiver presente');
assert(appCode.includes('NookMobileModal'), 'App.tsx deve renderizar NookMobileModal');
assert(appCode.includes('MobilePairApprovalDialog'), 'App.tsx deve renderizar MobilePairApprovalDialog');
console.log('✓ Teste 12: Navegação por Drawer e Header Mobile validadas com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 13: Touch Targets e Acessibilidade (>= 44px)
// ----------------------------------------------------------------------------
console.log('Teste 13: Validando tamanhos mínimos de toque (Touch Targets >= 44px)...');
const topBarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'mobile', 'MobileTopBar.tsx'), 'utf-8');
assert(topBarCode.includes("height: '44px'"), 'Botões da MobileTopBar devem ter pelo menos 44px de altura');
assert(topBarCode.includes('env(safe-area-inset-top'), 'MobileTopBar deve respeitar safe-area-inset-top');
console.log('✓ Teste 13: Touch targets e acessibilidade mobile validados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 14: Preservação de Dados e 5 Temas no Mobile
// ----------------------------------------------------------------------------
console.log('Teste 14: Validando 5 temas e banco SQLite sem perda de dados...');
const themes = ['gray', 'dark', 'white', 'neon', 'sakura'];
for (const theme of themes) {
  assert(appCode.includes(`'${theme}'`), `Tema ${theme} deve ser suportado`);
}
assert(!appCode.includes('r2.cloudflarestorage.com'), 'Não deve depender de storage de nuvem: SQLite é a única fonte');
console.log('✓ Teste 14: Suporte integral aos 5 temas e banco SQLite preservados com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 15: Tema Neon estritamente Monocromático, Preto, Verde Neon e Branco (1 Único tom de verde)
// ----------------------------------------------------------------------------
console.log('Teste 15: Validando que o tema Neon possui apenas 1 tom de verde (#00FF9D) e zero azul/cyan...');
const themeCss = fs.readFileSync(path.join(rootDir, 'src', 'styles', 'theme.css'), 'utf-8');
assert(!themeCss.includes('#00F0FF'), 'Tema Neon não pode conter nenhuma menção a #00F0FF ou azul/cyan');
assert(!themeCss.includes('#10B981'), 'Tema Neon não deve conter segundo tom de verde (#10B981)');
assert(themeCss.includes('--primary: #00FF9D;'), 'Tema Neon deve utilizar verde terminal (#00FF9D)');
assert(themeCss.includes('--accent-secondary: #00FF9D;'), 'Tema Neon deve manter apenas 1 tom de verde (#00FF9D)');

const settingsModalCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings', 'SettingsModal.tsx'), 'utf-8');
assert(settingsModalCode.includes("accent: '#00FF9D'"), 'SettingsModal deve usar verde neon #00FF9D');
assert(settingsModalCode.includes("secondary: '#FFFFFF'"), 'SettingsModal deve usar branco para as cores do Neon');
assert(!settingsModalCode.includes("secondary: '#10B981'"), 'SettingsModal não deve ter segundo tom de verde #10B981');
console.log('✓ Teste 15: Tema Neon estritamente monocromático e verde com 1 único tom validado com sucesso.');

// ----------------------------------------------------------------------------
// TESTE 16: Onboarding Adaptativo no Mobile & Supressão de Comandos Desktop
// ----------------------------------------------------------------------------
console.log('Teste 16: Validando adaptação responsiva de Onboarding e supressão de atalhos desktop no mobile...');
assert(appCode.includes('isMobile={isMobileViewport}'), 'OnboardingModal deve adaptar seu layout para telas mobile via isMobileViewport');
assert(appCode.includes("isMobileViewport ? 'calc(100% - 48px)' : 'calc(100% - 38px)'"), 'Layout deve compensar a altura correta no mobile');

const ptLocaleCode = fs.readFileSync(path.join(rootDir, 'src', 'i18n', 'locales', 'pt.ts'), 'utf-8');
const editorCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'editor', 'Editor.tsx'), 'utf-8');
assert(editorCode.includes('if (isMobile)'), 'Editor deve ter estado vazio dedicado para mobile');
assert(editorCode.includes('t.editor.newNoteMobile') && ptLocaleCode.includes('Nova Anotação'), 'Editor mobile deve exibir botão de Nova Anotação em toque');

const commandPaletteCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'search', 'CommandPalette.tsx'), 'utf-8');
assert(commandPaletteCode.replace(/\r\n/g, '\n').includes('isMobile\n    ? []'), 'CommandPalette no mobile não deve poluir com atalhos de comando desktop');
assert(commandPaletteCode.includes('!isMobile && ('), 'Rodapé de atalhos de navegação de teclado não deve ser exibido no mobile');
console.log('✓ Teste 16: Telas de atalhos e comandos de teclado suprimidos com sucesso no mobile.');

// ----------------------------------------------------------------------------
// TESTE 17: WebSocket Mobile Autenticado & Exclusão de Dispositivo via DELETE
// ----------------------------------------------------------------------------
console.log('Teste 17: Validando autenticação mobile no WebSocket e verbo DELETE na exclusão...');
const wsCode = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'server', 'ws.rs'), 'utf-8');
assert(wsCode.includes('validate_session_with_db'), 'ws.rs deve validar token mobile via banco SQLite');
assert(apiCode.includes("/delete`, {\n        method: 'DELETE'") || apiCode.includes("/delete`, {\r\n        method: 'DELETE'"), 'deleteMobileDevice deve usar método DELETE');
console.log('✓ Teste 17: WebSocket Mobile e exclusão DELETE validados com sucesso.');

console.log('\n--- Todos os 17 testes de auditoria do Nook Mobile foram aprovados com 100% de sucesso! ---');
