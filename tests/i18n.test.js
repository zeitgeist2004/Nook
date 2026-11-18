// ============================================================================
// NOOK — SUITE DE TESTES DE INTERNACIONALIZAÇÃO (PT-BR / EN / ES)
// Valida paridade 100% das chaves, placeholders, ausência de textos misturados
// e integração reativa completa no Frontend e Backend Rust/Tauri.
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

console.log('--- Executando Suite de Testes de Internacionalização (PT / EN / ES) ---');

function loadLocaleObject(relPath, exportName) {
  const fullPath = path.join(rootDir, relPath);
  assert(fs.existsSync(fullPath), `Arquivo de idioma ausente: ${relPath}`);
  const tsSource = fs.readFileSync(fullPath, 'utf8');
  const transpiled = ts.transpileModule(tsSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const module = { exports: {} };
  const fn = new vm.Script(`(function(exports, module) { ${transpiled} })`).runInThisContext();
  fn(module.exports, module);
  const dict = module.exports[exportName];
  assert(dict && typeof dict === 'object', `Export "${exportName}" inválido em ${relPath}`);
  return dict;
}

function flattenDictionary(obj, prefix = '') {
  const entries = new Map();
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      for (const [k, v] of flattenDictionary(val, fullKey)) {
        entries.set(k, v);
      }
    } else {
      entries.set(fullKey, val);
    }
  }
  return entries;
}

function extractPlaceholders(str) {
  const matches = str.match(/\{(\w+)\}/g) || [];
  return Array.from(new Set(matches)).sort();
}

// 1. Load compiled locale dictionaries
const pt = loadLocaleObject('src/i18n/locales/pt.ts', 'pt');
const en = loadLocaleObject('src/i18n/locales/en.ts', 'en');
const es = loadLocaleObject('src/i18n/locales/es.ts', 'es');

const ptMap = flattenDictionary(pt);
const enMap = flattenDictionary(en);
const esMap = flattenDictionary(es);

console.log(`✓ Teste 1: Dicionários carregados (PT=${ptMap.size} chaves, EN=${enMap.size} chaves, ES=${esMap.size} chaves).`);

// 2. Verify exact 100% key parity across PT, EN, and ES
assert.strictEqual(enMap.size, ptMap.size, `Quantidade de chaves difere entre PT (${ptMap.size}) e EN (${enMap.size})`);
assert.strictEqual(esMap.size, ptMap.size, `Quantidade de chaves difere entre PT (${ptMap.size}) e ES (${esMap.size})`);

for (const key of ptMap.keys()) {
  assert(enMap.has(key), `Chave ausente em EN: ${key}`);
  assert(esMap.has(key), `Chave ausente em ES: ${key}`);
}
console.log('✓ Teste 2: Paridade estrita de 100% das chaves validada entre PT, EN e ES.');

// 3. Verify every value is a non-empty string & placeholders match across all 3 languages
for (const [key, ptVal] of ptMap.entries()) {
  const enVal = enMap.get(key);
  const esVal = esMap.get(key);

  assert.strictEqual(typeof ptVal, 'string', `Valor não-string em PT (${key})`);
  assert.strictEqual(typeof enVal, 'string', `Valor não-string em EN (${key})`);
  assert.strictEqual(typeof esVal, 'string', `Valor não-string em ES (${key})`);

  assert(ptVal.trim().length > 0, `Valor vazio em PT (${key})`);
  assert(enVal.trim().length > 0, `Valor vazio em EN (${key})`);
  assert(esVal.trim().length > 0, `Valor vazio em ES (${key})`);

  const ptPlaceholders = extractPlaceholders(ptVal);
  const enPlaceholders = extractPlaceholders(enVal);
  const esPlaceholders = extractPlaceholders(esVal);

  assert.deepStrictEqual(
    enPlaceholders,
    ptPlaceholders,
    `Placeholders divergentes em EN para ${key}: esperado ${JSON.stringify(ptPlaceholders)}, obtido ${JSON.stringify(enPlaceholders)}`
  );
  assert.deepStrictEqual(
    esPlaceholders,
    ptPlaceholders,
    `Placeholders divergentes em ES para ${key}: esperado ${JSON.stringify(ptPlaceholders)}, obtido ${JSON.stringify(esPlaceholders)}`
  );
}
console.log('✓ Teste 3: Todos os textos não estão vazios e todos os placeholders {var} coincidem nos 3 idiomas.');

// 4. Verify language metadata and genuine translation (no untranslated PT diacritics leaked into EN)
assert.strictEqual(pt.meta.language, 'pt');
assert.strictEqual(en.meta.language, 'en');
assert.strictEqual(es.meta.language, 'es');
assert.strictEqual(pt.meta.speechLocale, 'pt-BR');
assert.strictEqual(en.meta.speechLocale, 'en-US');
assert.strictEqual(es.meta.speechLocale, 'es-ES');

for (const [key, enVal] of enMap.entries()) {
  if (key === 'meta.languageName' || key === 'commandPalette.cmdCycleLanguageSub') continue;
  assert(
    !/[ãõçÃÕÇáéíóúÁÉÍÓÚ]/.test(enVal),
    `Caractere não-inglês suspeito encontrado em EN (${key}): "${enVal}"`
  );
}

const sampleDistinctKeys = [
  'meta.documentTitle',
  'common.untitled',
  'onboarding.welcome',
  'sidebar.projects',
  'trash.emptyTrash',
  'editor.read',
  'commandPalette.cmdNewQuickNoteTitle',
  'settings.tabAppearance',
  'voice.modeMeeting',
  'starterNote.title',
];
for (const key of sampleDistinctKeys) {
  assert.notStrictEqual(ptMap.get(key), enMap.get(key), `Texto idêntico entre PT e EN para ${key}`);
  assert.notStrictEqual(ptMap.get(key), esMap.get(key), `Texto idêntico entre PT e ES para ${key}`);
  assert.notStrictEqual(enMap.get(key), esMap.get(key), `Texto idêntico entre EN e ES para ${key}`);
}
console.log('✓ Teste 4: Metadados de locale, voz e distinção linguística PT/EN/ES validados com sucesso.');

// 5. Verify Settings UI, CommandPalette, App state persistence, and Rust System Tray localization
const settingsSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'settings', 'SettingsModal.tsx'), 'utf8');
assert(settingsSrc.includes('SUPPORTED_LANGUAGES'), 'SettingsModal deve exibir seletor SUPPORTED_LANGUAGES');
assert(settingsSrc.includes("onUpdateSettings({ language:"), 'SettingsModal deve atualizar settings.language');

const appSrc = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf8');
assert(appSrc.includes('LanguageProvider'), 'App.tsx deve envolver a interface com LanguageProvider');
assert(appSrc.includes("api.saveSetting('language'"), 'App.tsx deve persistir language no banco SQLite');
assert(appSrc.includes("key === 'language'"), 'App.tsx deve sincronizar language via evento settings.updated');
assert(appSrc.includes('onToggleLanguage'), 'App.tsx deve expor troca rápida de idioma para a CommandPalette');

const cmdSrc = fs.readFileSync(path.join(rootDir, 'src', 'components', 'search', 'CommandPalette.tsx'), 'utf8');
assert(cmdSrc.includes('onToggleLanguage'), 'CommandPalette deve conter comando para alternar idioma');

const libRsSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'lib.rs'), 'utf8');
assert(libRsSrc.includes('apply_tray_language'), 'lib.rs deve suportar tradução dinâmica do System Tray');

const settingsRsSrc = fs.readFileSync(path.join(rootDir, 'src-tauri', 'src', 'commands', 'settings.rs'), 'utf8');
assert(settingsRsSrc.includes('apply_tray_language'), 'commands/settings.rs deve atualizar o tray ao salvar idioma');

console.log('✓ Teste 5: Seletor em Configurações, CommandPalette, sync SQLite e System Tray traduzido validados.');
console.log('\n--- Todos os testes de internacionalização (PT / EN / ES) foram aprovados com 100% de sucesso! ---');
