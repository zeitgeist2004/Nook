// ============================================================================
// NOOK — SUITE DE TESTES DO RELEASE UPGRADE (TEMAS, BACKUP/CACHE, ONBOARDING EN, AUTO-UPDATE)
// Valida idioma padrão 'en' sem quebrar perfis antigos, onboarding multilíngue em 3 etapas,
// refino visual equilibrado Neon/Sakura, frequência/retenção/limpeza de backups & cache,
// e arquitetura segura de auto-update via GitHub Releases (@tauri-apps/plugin-updater).
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

console.log('--- Executando Suite de Testes do Nook Release Upgrade ---');

function loadTsModule(relPath, stubs = {}) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `Arquivo TS ausente: ${relPath}`);
  const tsSource = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
    },
  }).outputText;

  const module = { exports: {} };
  const customRequire = (reqPath) => {
    if (stubs[reqPath]) return stubs[reqPath];
    if (reqPath === 'react') {
      return {
        createContext: (def) => ({ Provider: () => null, _defaultValue: def }),
        useContext: () => ({}),
        useMemo: (fn) => fn(),
        useState: (init) => [init, () => {}],
        useEffect: () => {},
        useRef: (init) => ({ current: init }),
        createElement: () => null,
      };
    }
    throw new Error(`Unexpected module require("${reqPath}") while testing ${relPath}`);
  };
  const fn = new vm.Script(`(function(exports, module, require) { ${transpiled} })`).runInThisContext();
  fn(module.exports, module, customRequire);
  return module.exports;
}

// ============================================================================
// 1. Idioma padrão EN para novas instalações + normalização multilíngue
// ============================================================================
{
  const ptMod = loadTsModule('src/i18n/locales/pt.ts');
  const enMod = loadTsModule('src/i18n/locales/en.ts');
  const esMod = loadTsModule('src/i18n/locales/es.ts');

  const i18nMod = loadTsModule('src/i18n/index.tsx', {
    './locales/pt': ptMod,
    './locales/en': enMod,
    './locales/es': esMod,
  });

  assert.strictEqual(i18nMod.DEFAULT_LANGUAGE, 'en', 'DEFAULT_LANGUAGE deve ser "en" para novas instalações');
  assert.strictEqual(i18nMod.normalizeLanguage(undefined), 'en');
  assert.strictEqual(i18nMod.normalizeLanguage(''), 'en');
  assert.strictEqual(i18nMod.normalizeLanguage('fr-FR'), 'en');
  assert.strictEqual(i18nMod.normalizeLanguage('pt'), 'pt');
  assert.strictEqual(i18nMod.normalizeLanguage('pt-BR'), 'pt');
  assert.strictEqual(i18nMod.normalizeLanguage('es'), 'es');
  assert.strictEqual(i18nMod.normalizeLanguage('es-419'), 'es');

  // Garantir que settings.rs preserva instalações antigas com notas antes da adição do idioma padrão EN
  const settingsRs = fs.readFileSync(path.join(rootDir, 'src-tauri/src/commands/settings.rs'), 'utf8');
  assert(settingsRs.includes('.unwrap_or_else(|| "en".to_string())'), 'settings.rs deve usar "en" como fallback padrão');
  assert(settingsRs.includes('SELECT COUNT(*) FROM notes') && settingsRs.includes('collections'), 'get_initial_tray_language deve preservar perfis existentes em PT quando não há preferência salva');

  // App.tsx não deve reabrir onboarding em usuários que já têm perfil local/dados ao atualizar versão
  const appSrc = fs.readFileSync(path.join(rootDir, 'src/app/App.tsx'), 'utf8');
  assert(
    appSrc.includes('hadPreExistingProfileRef.current') &&
      appSrc.includes('activeNotes.length > 0 || colls.length > 0'),
    'App.tsx deve reconhecer perfis/bibliotecas existentes ao atualizar versão sem forçar onboarding completo'
  );
  console.log('✓ Teste 1: Idioma padrão English (EN) para novas instalações e preservação de usuários existentes validados.');
}

// ============================================================================
// 2. Onboarding multilíngue animado em 3 etapas com zero jargão técnico
// ============================================================================
{
  const onboardingSrc = fs.readFileSync(path.join(rootDir, 'src/components/onboarding/OnboardingModal.tsx'), 'utf8');
  for (const phrase of [
    'Welcome to Nook',
    'Boas-vindas ao Nook',
    'Te damos la bienvenida a Nook',
    'Choose your language',
    'Escolha seu idioma',
    'Elige tu idioma',
  ]) {
    assert(onboardingSrc.includes(phrase), `Texto de carrossel ausente no OnboardingModal: "${phrase}"`);
  }

  for (const key of [
    't.onboarding.quickNotesTitle',
    't.onboarding.projectsTitle',
    't.onboarding.searchTitle',
    't.onboarding.startWritingCta',
  ]) {
    assert(onboardingSrc.includes(key), `Chave de onboarding minimalista ausente: ${key}`);
  }

  // Sem jargão técnico na seção welcome do carrossel
  const welcomeSection = onboardingSrc.slice(onboardingSrc.indexOf('3-STAGE MULTILINGUAL FIRST-RUN ONBOARDING'));
  for (const forbidden of ['Cloudflare', 'WebSocket', 'SQLite', 'Minisign', 'localhost']) {
    assert(!welcomeSection.includes(forbidden), `Onboarding de boas-vindas não deve exibir termo técnico "${forbidden}"`);
  }
  console.log('✓ Teste 2: Onboarding multilíngue (EN/PT/ES), carrossel vivo e 3 essenciais minimalistas validados.');
}

// ============================================================================
// 3. Refino visual Neon & Sakura com máscara de leitura e miniaturas ricas
// ============================================================================
{
  const backdropSrc = fs.readFileSync(path.join(rootDir, 'src/components/themes/ThemeBackdrop.tsx'), 'utf8');
  assert(backdropSrc.includes('hasActiveNote'), 'ThemeBackdrop deve adaptar opacidade/composição entre tela vazia e edição ativa');
  assert(backdropSrc.includes('nook-neon-composition-mask'), 'Neon deve usar máscara central de legibilidade durante escrita');
  assert(backdropSrc.includes('nook-sakura-composition-mask'), 'Sakura deve usar máscara central de legibilidade durante escrita');
  assert(backdropSrc.includes('SakuraBlossom'), 'Sakura deve desenhar flores de cinco pétalas em pontos equilibrados');
  assert(!backdropSrc.includes('requestAnimationFrame'), 'ThemeBackdrop deve permanecer puramente declarativo e livre de timers JS');

  const appSrc = fs.readFileSync(path.join(rootDir, 'src/app/App.tsx'), 'utf8');
  assert(appSrc.includes('<ThemeBackdrop') && appSrc.includes('hasActiveNote={'), 'App.tsx deve passar hasActiveNote ao ThemeBackdrop');

  const settingsSrc = fs.readFileSync(path.join(rootDir, 'src/components/settings/SettingsModal.tsx'), 'utf8');
  assert(settingsSrc.includes("themeOption.id === 'sakura'") && settingsSrc.includes("themeOption.id === 'neon'"), 'Miniaturas de Aparência devem renderizar preview fiel de Neon e Sakura');
  console.log('✓ Teste 3: Temas Neon & Sakura com composição equilibrada e proteção ao contraste de escrita validados.');
}

// ============================================================================
// 4. Lógica de agenda do Updater (24h, offline, disabled) & higiene de segredos
// ============================================================================
{
  const updaterMod = loadTsModule('src/services/updater.ts', {
    '@tauri-apps/api/app': { getVersion: async () => '1.0.0' },
    '@tauri-apps/plugin-updater': { check: async () => null },
    '@tauri-apps/plugin-process': { relaunch: async () => {} },
    './api': { isTauri: () => false },
  });

  const ONE_HOUR = 60 * 60 * 1000;
  const now = 1_760_000_000_000;

  assert.strictEqual(
    updaterMod.shouldRunScheduledUpdateCheck(now, null, true, false),
    false,
    'Updater nunca deve tentar rede quando offline'
  );
  assert.strictEqual(
    updaterMod.shouldRunScheduledUpdateCheck(now, null, false, true),
    false,
    'Updater deve respeitar autoUpdateCheckEnabled=false'
  );
  assert.strictEqual(
    updaterMod.shouldRunScheduledUpdateCheck(now, null, true, true),
    true,
    'Updater deve permitir checagem inicial quando online e habilitado'
  );
  assert.strictEqual(
    updaterMod.shouldRunScheduledUpdateCheck(now, now - 12 * ONE_HOUR, true, true),
    false,
    'Updater deve aguardar janela de 24h entre verificações automáticas'
  );
  assert.strictEqual(
    updaterMod.shouldRunScheduledUpdateCheck(now, now - updaterMod.UPDATE_CHECK_INTERVAL_MS, true, true),
    true,
    'Updater deve executar após completar 24h'
  );

  // Verificação estática de configuração do Tauri & Workflow GitHub
  const tauriConf = JSON.parse(fs.readFileSync(path.join(rootDir, 'src-tauri/tauri.conf.json'), 'utf8'));
  assert.strictEqual(tauriConf.identifier, 'com.lumina.notes', 'Bundle identifier com.lumina.notes nunca deve ser alterado');
  assert.strictEqual(tauriConf.bundle?.createUpdaterArtifacts, true, 'createUpdaterArtifacts precisa ser true');
  assert(
    Array.isArray(tauriConf.plugins?.updater?.endpoints) &&
      tauriConf.plugins.updater.endpoints.some((u) => u.includes('github.com/zeitgeist2004/Nook/releases/latest/download/latest.json')),
    'Endpoint oficial do GitHub Releases ausente em tauri.conf.json'
  );
  assert(
    typeof tauriConf.plugins?.updater?.pubkey === 'string' && tauriConf.plugins.updater.pubkey.length > 20,
    'Chave pública Minisign ausente em tauri.conf.json'
  );

  // Nenhuma chave privada dentro do repositório
  const releaseYml = fs.readFileSync(path.join(rootDir, '.github/workflows/release.yml'), 'utf8');
  assert(releaseYml.includes('${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}'), 'Workflow deve ler assinatura exclusivamente de GitHub Secrets');
  assert(!releaseYml.includes('untrusted comment: minisign secret key'), 'Chave privada Minisign nunca deve existir em release.yml');
  assert(!fs.existsSync(path.join(rootDir, 'src-tauri/nook.key')), 'Arquivo de chave privada nunca deve estar dentro do repositório');

  // Web/Mobile read-only status sem rota de auto-update
  const routesRs = fs.readFileSync(path.join(rootDir, 'src-tauri/src/server/routes.rs'), 'utf8');
  assert(routesRs.includes('build_id') && routesRs.includes('CARGO_PKG_VERSION'), 'routes.rs deve expor build_id e version em /api/status');
  assert(!routesRs.includes('/api/updater/install'), 'Servidor Web/Mobile não deve expor comandos destrutivos de instalação de update');
  console.log('✓ Teste 4: Agendamento diário do Updater, integridade com.lumina.notes e isolamento Web/Mobile validados.');
}

// ============================================================================
// 5. Gerenciamento de Backups (Frequência, Retenção, Limpeza) & Settings UI
// ============================================================================
{
  const settingsSrc = fs.readFileSync(path.join(rootDir, 'src/components/settings/SettingsModal.tsx'), 'utf8');
  const apiSrc = fs.readFileSync(path.join(rootDir, 'src/services/api.ts'), 'utf8');

  for (const token of [
    "activeTab === 'language'",
    "activeTab === 'about'",
    'autoBackupEnabled',
    'backupFrequency',
    'backupRetentionDays',
    'deleteAutoBackups',
    'clearAppCache',
    'RELEASES_PAGE_URL',
  ]) {
    assert(settingsSrc.includes(token), `Integração esperada ausente em SettingsModal.tsx: ${token}`);
  }

  for (const apiFn of [
    'getAutoBackupsSummary',
    'deleteAutoBackups',
    'getCacheStats',
    'clearAppCache',
    'getServerStatus',
  ]) {
    assert(apiSrc.includes(apiFn), `Método de API ausente em src/services/api.ts: ${apiFn}`);
  }
  console.log('✓ Teste 5: UI e API de Idioma, Backups Inteligentes, Limpeza de Cache e Sobre o Nook validados.');
}

console.log('\n--- Todos os 5 testes do Nook Release Upgrade passaram com 100% de sucesso! ---');
