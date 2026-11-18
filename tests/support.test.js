// ============================================================================
// NOOK — SUITE DE TESTES DO SISTEMA DE APOIO VOLUNTÁRIO (GITHUB SPONSORS)
// Valida: URL exclusiva, elegibilidade (7d + 5h), tempo ativo vs sono/idle,
// cooldown de 60d, limite de 2 convites, momentos proibidos, sync Desktop/Web,
// pontos de acesso discretos, acessibilidade prefers-reduced-motion e i18n.
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Suite de Testes do Sistema de Apoio Voluntário ---');

function loadTsModule(relPath) {
  const fullPath = path.join(rootDir, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const mod = { exports: {} };
  const localStorageStore = new Map();
  const sandbox = {
    module: mod,
    exports: mod.exports,
    require: () => ({}),
    localStorage: {
      getItem: (k) => (localStorageStore.has(k) ? localStorageStore.get(k) : null),
      setItem: (k, v) => localStorageStore.set(k, String(v)),
      removeItem: (k) => localStorageStore.delete(k),
    },
  };
  vm.runInNewContext(transpiled.outputText, sandbox, { filename: fullPath });
  return { exports: mod.exports, localStorageStore };
}

const { exports: supportUtils, localStorageStore } = loadTsModule('src/utils/supportUtils.ts');
const { exports: ptModule } = loadTsModule('src/i18n/locales/pt.ts');
const { exports: enModule } = loadTsModule('src/i18n/locales/en.ts');
const { exports: esModule } = loadTsModule('src/i18n/locales/es.ts');

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const BASE_NOW = 1_800_000_000_000;

function makeCalmCtx(overrides = {}) {
  const now = overrides.now ?? BASE_NOW + 10 * DAY_MS;
  return {
    now,
    sessionStartedAt: now - 120_000,
    msSinceLastInteraction: 15_000,
    msSinceLastTyping: 40_000,
    dismissedThisSession: false,
    isMobileViewport: false,
    isVisible: true,
    hasFocus: true,
    isSavingOrDirty: false,
    hasSyncError: false,
    hasBlockingModalOrFlow: false,
    ...overrides,
  };
}

// 1. URL oficial exclusiva + Rust/Frontend/Zero dependências extras
{
  const webRs = fs.readFileSync(path.join(rootDir, 'src-tauri/src/commands/web.rs'), 'utf8');
  const libRs = fs.readFileSync(path.join(rootDir, 'src-tauri/src/lib.rs'), 'utf8');
  const apiTs = fs.readFileSync(path.join(rootDir, 'src/services/api.ts'), 'utf8');
  const cargoToml = fs.readFileSync(path.join(rootDir, 'src-tauri/Cargo.toml'), 'utf8');
  const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));

  assert.strictEqual(
    supportUtils.OFFICIAL_SPONSORS_URL,
    'https://github.com/sponsors/zeitgeist2004',
    'URL oficial em supportUtils.ts incorreta'
  );
  assert(
    webRs.includes('pub const OFFICIAL_SPONSORS_URL: &str = "https://github.com/sponsors/zeitgeist2004";'),
    'Rust web.rs deve conter OFFICIAL_SPONSORS_URL exatamente igual'
  );
  assert(
    webRs.includes('pub fn open_sponsors_page() -> Result<String, String>'),
    'Comando open_sponsors_page deve existir sem parâmetro de URL arbitrária'
  );
  const openSponsorsBody = webRs.slice(webRs.indexOf('pub fn open_sponsors_page'));
  assert(
    !openSponsorsBody.includes('window.hide'),
    'open_sponsors_page não deve ocultar a janela do Nook'
  );
  assert(
    libRs.includes('commands::web::open_sponsors_page'),
    'lib.rs deve registrar open_sponsors_page no invoke_handler'
  );
  assert(
    apiTs.includes("const OFFICIAL_URL = 'https://github.com/sponsors/zeitgeist2004'") &&
      apiTs.includes("invoke<string>('open_sponsors_page')") &&
      apiTs.includes("window.open(OFFICIAL_URL, '_blank', 'noopener,noreferrer')"),
    'api.ts deve suportar Desktop (Tauri) e Web/Mobile mantendo a janela segura'
  );
  assert(!cargoToml.includes('tauri-plugin-opener'), 'Não deve adicionar tauri-plugin-opener desnecessariamente');
  assert(!pkgJson.dependencies['@stripe/stripe-js'], 'Não deve incluir SDK de pagamento');
  console.log('✓ Teste 1: URL oficial exclusiva (Desktop/Web), preservação da janela e zero SDKs extras.');
}

// 2. Novo usuário não recebe convite antecipado
{
  const newUser = supportUtils.createInitialSupportPreferences(BASE_NOW);
  assert.strictEqual(newUser.showInvitesSetting, true);
  assert.strictEqual(newUser.neverShowAgain, false);
  assert.strictEqual(newUser.invitesShownCount, 0);

  // Mesmo com 6 dias e 10h ativas
  const day6Prefs = { ...newUser, activeUsageMs: 10 * HOUR_MS };
  assert.strictEqual(
    supportUtils.canShowSupportInvite(day6Prefs, makeCalmCtx({ now: BASE_NOW + 6 * DAY_MS })),
    false,
    'Não pode exibir antes de 7 dias'
  );

  // Mesmo com 14 dias e 4h59 ativos
  const lowUsagePrefs = { ...newUser, activeUsageMs: 5 * HOUR_MS - 1_000 };
  assert.strictEqual(
    supportUtils.canShowSupportInvite(lowUsagePrefs, makeCalmCtx({ now: BASE_NOW + 14 * DAY_MS })),
    false,
    'Não pode exibir antes de 5 horas de uso ativo acumulado'
  );
  console.log('✓ Teste 2: Novo usuário respeita critérios mínimos de 7 dias + 5h ativas.');
}

// 3. Elegibilidade cumprida (7d + 5h + momento calmo)
{
  const eligiblePrefs = {
    ...supportUtils.createInitialSupportPreferences(BASE_NOW),
    activeUsageMs: 5 * HOUR_MS,
  };
  assert.strictEqual(
    supportUtils.canShowSupportInvite(eligiblePrefs, makeCalmCtx({ now: BASE_NOW + 7 * DAY_MS })),
    true,
    'Deve ficar elegível aos 7 dias + 5h de uso ativo em momento calmo'
  );
  console.log('✓ Teste 3: Elegibilidade validada aos 7 dias + 5 horas de uso ativo em momento calmo.');
}

// 4. Tempo ativo real vs ocioso, janela minimizada/sem foco e salto de sono do SO
{
  assert.strictEqual(
    supportUtils.computeActiveDeltaMs({
      elapsedMs: 60_000,
      isVisible: false,
      hasFocus: true,
      msSinceLastInteraction: 1_000,
    }),
    0,
    'Janela minimizada/oculta não conta tempo ativo'
  );
  assert.strictEqual(
    supportUtils.computeActiveDeltaMs({
      elapsedMs: 60_000,
      isVisible: true,
      hasFocus: false,
      msSinceLastInteraction: 1_000,
    }),
    0,
    'Janela sem foco não conta tempo ativo'
  );
  assert.strictEqual(
    supportUtils.computeActiveDeltaMs({
      elapsedMs: 60_000,
      isVisible: true,
      hasFocus: true,
      msSinceLastInteraction: 121_000,
    }),
    0,
    'Inatividade > 2 minutos não conta tempo ativo'
  );
  assert.strictEqual(
    supportUtils.computeActiveDeltaMs({
      elapsedMs: 8 * HOUR_MS,
      isVisible: true,
      hasFocus: true,
      msSinceLastInteraction: 5_000,
    }),
    supportUtils.MAX_TICK_SLICE_MS,
    'Salto de hibernação/sono do SO deve ser limitado para nunca inflar horas ativas'
  );
  assert.strictEqual(
    supportUtils.computeActiveDeltaMs({
      elapsedMs: 45_000,
      isVisible: true,
      hasFocus: true,
      msSinceLastInteraction: 10_000,
    }),
    45_000,
    'Segmento ativo normal deve somar exatamente o intervalo'
  );
  console.log('✓ Teste 4: Tempo ativo filtra inatividade > 2min, foco/visibilidade e hibernação.');
}

// 5. "Agora não", cooldown de 60 dias e limite máximo de 2 convites
{
  let prefs = {
    ...supportUtils.createInitialSupportPreferences(BASE_NOW),
    activeUsageMs: 6 * HOUR_MS,
  };
  const firstShownAt = BASE_NOW + 10 * DAY_MS;
  prefs = supportUtils.applyInviteShown(prefs, firstShownAt);
  prefs = supportUtils.applyInviteLater(prefs, firstShownAt);
  assert.strictEqual(prefs.invitesShownCount, 1);

  // Dia +59: bloqueado pelo cooldown de 60 dias
  assert.strictEqual(
    supportUtils.canShowSupportInvite(prefs, makeCalmCtx({ now: firstShownAt + 59 * DAY_MS })),
    false,
    'Não deve reexibir antes de 60 dias'
  );

  // Dia +60 (sessão ativa -> false se dismissedThisSession, true em nova sessão)
  assert.strictEqual(
    supportUtils.canShowSupportInvite(
      prefs,
      makeCalmCtx({ now: firstShownAt + 60 * DAY_MS, dismissedThisSession: true })
    ),
    false,
    'Dispensado na sessão atual nunca reaparece na mesma sessão'
  );
  assert.strictEqual(
    supportUtils.canShowSupportInvite(prefs, makeCalmCtx({ now: firstShownAt + 60 * DAY_MS })),
    true,
    'Em nova sessão após 60 dias pode exibir o segundo convite'
  );

  // Segunda e última exibição
  const secondShownAt = firstShownAt + 60 * DAY_MS;
  prefs = supportUtils.applyInviteShown(prefs, secondShownAt);
  assert.strictEqual(prefs.invitesShownCount, 2);

  // Mesmo após 365 dias: nunca mais
  assert.strictEqual(
    supportUtils.canShowSupportInvite(prefs, makeCalmCtx({ now: secondShownAt + 365 * DAY_MS })),
    false,
    'Limite máximo de 2 exibições automáticas é permanente'
  );
  console.log('✓ Teste 5: "Agora não" aplica cooldown de 60 dias e limite máximo de 2 exibições.');
}

// 6. "Não mostrar novamente" / "Já apoiei" e persistência local
{
  let prefs = {
    ...supportUtils.createInitialSupportPreferences(BASE_NOW),
    activeUsageMs: 20 * HOUR_MS,
  };
  prefs = supportUtils.applyInviteNever(prefs);
  assert.strictEqual(prefs.neverShowAgain, true);
  assert.strictEqual(prefs.showInvitesSetting, false);
  assert.strictEqual(
    supportUtils.canShowSupportInvite(prefs, makeCalmCtx({ now: BASE_NOW + 100 * DAY_MS })),
    false,
    'Opt-out permanente deve bloquear convites automáticos para sempre'
  );

  supportUtils.saveLocalSupportPreferences(prefs);
  assert(localStorageStore.has(supportUtils.SUPPORT_PREFS_STORAGE_KEY));
  const reloaded = supportUtils.loadLocalSupportPreferences();
  assert.strictEqual(reloaded.existed, true);
  assert.strictEqual(reloaded.prefs.neverShowAgain, true);
  console.log('✓ Teste 6: Opt-out ("Não mostrar novamente" / "Já apoiei") persiste corretamente.');
}

// 7. Usuário existente + Sincronização Desktop <-> Web (merge seguro)
{
  const migratedLocal = supportUtils.createInitialSupportPreferences(BASE_NOW);
  // Mesmo em um app antigo recém-atualizado, não dispara na hora
  assert.strictEqual(
    supportUtils.canShowSupportInvite(migratedLocal, makeCalmCtx({ now: BASE_NOW + 100_000 })),
    false,
    'Usuário recém-migrado não recebe convite imediato após atualização'
  );

  const desktop = {
    firstUsedAt: BASE_NOW,
    activeUsageMs: 6 * HOUR_MS,
    invitesShownCount: 1,
    lastInviteShownAt: BASE_NOW + 12 * DAY_MS,
    neverShowAgain: false,
    showInvitesSetting: true,
    completedActionsCount: 5,
  };
  const webRemote = {
    firstUsedAt: BASE_NOW + 5 * DAY_MS,
    activeUsageMs: 3 * HOUR_MS,
    invitesShownCount: 1,
    lastInviteShownAt: BASE_NOW + 14 * DAY_MS,
    neverShowAgain: true,
    showInvitesSetting: false,
    completedActionsCount: 8,
  };
  const merged = supportUtils.mergeSupportPreferences(desktop, webRemote, true);
  assert.strictEqual(merged.firstUsedAt, BASE_NOW, 'Deve manter o firstUsedAt mais antigo');
  assert.strictEqual(merged.activeUsageMs, 6 * HOUR_MS, 'Deve preservar maior uso ativo');
  assert.strictEqual(merged.completedActionsCount, 8);
  assert.strictEqual(merged.lastInviteShownAt, BASE_NOW + 14 * DAY_MS);
  assert.strictEqual(merged.neverShowAgain, true, 'Opt-out sincronizado do Web respeitado no Desktop');
  console.log('✓ Teste 7: Migração não destrutiva e merge Desktop <-> Web evitam duplicidade e perda de preferências.');
}

// 8. Todos os momentos proibidos do convite automático (§9)
{
  const readyPrefs = {
    ...supportUtils.createInitialSupportPreferences(BASE_NOW),
    activeUsageMs: 10 * HOUR_MS,
  };
  const blockedScenarios = [
    ['Viewport mobile', { isMobileViewport: true }],
    ['Grace inicialização (<60s)', { sessionStartedAt: BASE_NOW + 10 * DAY_MS - 30_000 }],
    ['Durante digitação ativa (<25s)', { msSinceLastTyping: 12_000 }],
    ['Durante interação recente (<8s)', { msSinceLastInteraction: 3_000 }],
    ['Janela oculta', { isVisible: false }],
    ['Janela sem foco', { hasFocus: false }],
    ['Salvamento pendente/erro', { isSavingOrDirty: true }],
    ['Erro de sincronização', { hasSyncError: true }],
    ['Modal / voz / paleta / ferramenta aberta', { hasBlockingModalOrFlow: true }],
  ];

  for (const [label, override] of blockedScenarios) {
    assert.strictEqual(
      supportUtils.canShowSupportInvite(readyPrefs, makeCalmCtx(override)),
      false,
      `Momento proibido não bloqueado: ${label}`
    );
  }
  console.log('✓ Teste 8: Todos os 9 momentos proibidos (digitação, modais, erro, mobile, inicialização, foco) bloqueiam o convite.');
}

// 9. Pontos de acesso discretos na UI, busca Ctrl+K e card não-modal acessível
{
  const settingsCode = fs.readFileSync(path.join(rootDir, 'src/components/settings/SettingsModal.tsx'), 'utf8');
  const sidebarCode = fs.readFileSync(path.join(rootDir, 'src/components/sidebar/Sidebar.tsx'), 'utf8');
  const onboardingCode = fs.readFileSync(path.join(rootDir, 'src/components/onboarding/OnboardingModal.tsx'), 'utf8');
  const commandCode = fs.readFileSync(path.join(rootDir, 'src/components/search/CommandPalette.tsx'), 'utf8');
  const cardCode = fs.readFileSync(path.join(rootDir, 'src/components/support/SupportInviteCard.tsx'), 'utf8');
  const cssCode = fs.readFileSync(path.join(rootDir, 'src/styles/globals.css'), 'utf8');
  const appCode = fs.readFileSync(path.join(rootDir, 'src/app/App.tsx'), 'utf8');

  // Settings
  assert(settingsCode.includes('t.support.aboutCardTitle') && settingsCode.includes('t.support.aboutInvitesToggleTitle'));
  assert(settingsCode.includes('t.support.aboutAlreadySupportedBtn'));

  // Sidebar footer
  assert(sidebarCode.includes('t.support.sidebarButton') && sidebarCode.includes('t.support.sidebarTooltip'));

  // Help / Shortcuts
  assert(onboardingCode.includes('t.support.helpButton'));

  // CommandPalette keywords & system placement
  assert(commandCode.includes("id: 'cmd-support-nook'") && commandCode.includes("category: 'system'"));
  assert(commandCode.includes('a.keywords'));
  for (const locale of [ptModule.pt, enModule.en, esModule.es]) {
    const kw = locale.support.commandKeywords.toLowerCase();
    for (const term of ['apoiar', 'apoie o nook', 'github sponsors', 'contribuir']) {
      assert(kw.includes(term), `Termo "${term}" ausente nas keywords do CommandPalette`);
    }
  }
  // Verificar que todas as notas/buscas continuam acima de comandos system
  assert(
    commandCode.indexOf('searchResults.map') < commandCode.indexOf('filteredActions.filter'),
    'Notas encontradas devem aparecer antes dos comandos de sistema no CommandPalette'
  );

  // Non-modal card & mascot + prefers-reduced-motion
  assert(!cardCode.includes('aria-modal'), 'SupportInviteCard não pode ser modal');
  assert(!cardCode.includes('autoFocus'), 'SupportInviteCard não pode roubar foco');
  assert(cardCode.includes('nook-idle-open.png') && cardCode.includes('nook-idle-blink.png'));
  assert(cssCode.includes('.nook-support-invite-card') && cssCode.includes('nookSupportMascotSingleBlink'));
  assert(
    cssCode.includes('@media (prefers-reduced-motion: reduce)') &&
      cssCode.includes('.nook-support-invite-card[data-state=\'exiting\']'),
    'globals.css deve cobrir prefers-reduced-motion para o card de apoio'
  );

  // Nenhum conteúdo de nota rastreado ou feature travada
  assert(!appCode.includes('Pro Version') && !appCode.includes('nook_pro'));
  console.log('✓ Teste 9: Configurações, Sidebar, Ajuda, CommandPalette, Card não-modal e prefers-reduced-motion validados.');
}

// 10. Tradução completa PT / EN / ES para módulo support
{
  const ptSupport = ptModule.pt.support;
  const enSupport = enModule.en.support;
  const esSupport = esModule.es.support;
  const keys = Object.keys(ptSupport);
  assert(keys.length >= 20);
  for (const k of keys) {
    assert(typeof ptSupport[k] === 'string' && ptSupport[k].trim().length > 0, `PT missing support.${k}`);
    assert(typeof enSupport[k] === 'string' && enSupport[k].trim().length > 0, `EN missing support.${k}`);
    assert(typeof esSupport[k] === 'string' && esSupport[k].trim().length > 0, `ES missing support.${k}`);
  }
  console.log('✓ Teste 10: Textos de apoio validados nos 3 idiomas (PT / EN / ES).');
}

console.log('\n--- Todos os testes do Sistema de Apoio Voluntário passaram com 100% de sucesso! ---');
