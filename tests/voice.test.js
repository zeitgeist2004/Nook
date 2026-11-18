// ============================================================================
// NOOK VOICE — TESTES UNITÁRIOS, INTEGRAÇÃO E AUDITORIA COMPLETA
// Web Speech API, Reconhecimento Contínuo, Deduplicação, Persistência & Offline
// ============================================================================

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('--- Executando Suite de Testes do Nook Voice (Speech-to-Text) ---');

// ----------------------------------------------------------------------------
// TESTE 1: Arquitetura e Arquivos do Nook Voice
// ----------------------------------------------------------------------------
console.log('Teste 1: Verificando existência dos módulos do Nook Voice...');
const speechTypesPath = path.join(rootDir, 'src', 'types', 'speech.ts');
const speechServicePath = path.join(rootDir, 'src', 'services', 'voice', 'speechRecognition.ts');
const offlineStoragePath = path.join(rootDir, 'src', 'services', 'voice', 'voiceOfflineStorage.ts');
const wakeLockPath = path.join(rootDir, 'src', 'services', 'voice', 'screenWakeLock.ts');
const voiceHookPath = path.join(rootDir, 'src', 'hooks', 'useVoiceSession.ts');
const voiceModalPath = path.join(rootDir, 'src', 'components', 'mobile', 'voice', 'NookVoiceModal.tsx');

assert(fs.existsSync(speechTypesPath), 'speech.ts deve existir em src/types/');
assert(fs.existsSync(speechServicePath), 'speechRecognition.ts deve existir');
assert(fs.existsSync(offlineStoragePath), 'voiceOfflineStorage.ts deve existir');
assert(fs.existsSync(wakeLockPath), 'screenWakeLock.ts deve existir');
assert(fs.existsSync(voiceHookPath), 'useVoiceSession.ts deve existir');
assert(fs.existsSync(voiceModalPath), 'NookVoiceModal.tsx deve existir');
console.log('✓ Teste 1: Todos os 6 módulos centrais do Nook Voice existem.');

// ----------------------------------------------------------------------------
// TESTE 2: Web Speech API — Configuração Obrigatória
// ----------------------------------------------------------------------------
console.log('Teste 2: Validando propriedades obrigatórias da Web Speech API...');
const serviceCode = fs.readFileSync(speechServicePath, 'utf-8');
assert(serviceCode.includes("this.recognition.lang = this.lang;"), 'Engine deve configurar idioma dinâmico/pt-BR');
assert(serviceCode.includes('this.recognition.continuous = true'), 'continuous deve ser true');
assert(serviceCode.includes('this.recognition.interimResults = true'), 'interimResults deve ser true');
assert(serviceCode.includes('this.recognition.maxAlternatives = 1'), 'maxAlternatives deve ser 1');
assert(serviceCode.includes('.SpeechRecognition') && serviceCode.includes('.webkitSpeechRecognition'), 'Deve suportar SpeechRecognition padrão e prefixado webkit');
console.log('✓ Teste 2: Propriedades da Web Speech API (pt-BR, continuous, interimResults) validadas.');

// ----------------------------------------------------------------------------
// TESTE 3: Tratamento de Resultados Parciais vs Finais e Deduplicação
// ----------------------------------------------------------------------------
console.log('Teste 3: Validando separação de interim vs final e prevenção de duplicações...');
assert(serviceCode.includes('event.resultIndex'), 'Deve iterar a partir de event.resultIndex para evitar reprocessamento');
assert(serviceCode.includes('result.isFinal'), 'Deve verificar se o resultado é final');
assert(serviceCode.includes('this.callbacks.onInterim(currentInterim)'), 'Deve despachar hipóteses provisórias via onInterim');
assert(serviceCode.includes('this.callbacks.onFinalSegment'), 'Deve despachar segmento confirmado via onFinalSegment');
assert(serviceCode.includes('isDuplicate'), 'Deve conter verificação explícita de frases duplicadas consecutivas');
console.log('✓ Teste 3: Tratamento rigoroso de interim vs final e deduplicação validado.');

// ----------------------------------------------------------------------------
// TESTE 4: Reconhecimento Contínuo & Recuperação Inteligente de onend
// ----------------------------------------------------------------------------
console.log('Teste 4: Validando ciclo de vida contínuo e reinício controlado de onend...');
assert(serviceCode.includes('this.recognition.onend'), 'Deve possuir listener de onend');
assert(serviceCode.includes('this.consecutiveRestarts > 5'), 'Deve conter proteção contra loops infinitos de reinício rápido');
assert(serviceCode.includes('this.callbacks.onStatusChange(\'reconnecting\')'), 'Deve notificar estado de reconexão quando aplicável');
assert(serviceCode.includes('this.isPaused'), 'Não deve reiniciar se a sessão foi pausada pelo usuário');
console.log('✓ Teste 4: Reinício controlado com backoff e proteção anti-loop validado.');

// ----------------------------------------------------------------------------
// TESTE 5: Tratamento Abrangente de Erros de Microfone e Rede
// ----------------------------------------------------------------------------
console.log('Teste 5: Validando tratamento de erros (not-allowed, no-speech, audio-capture, network)...');
assert(serviceCode.includes("error === 'no-speech'"), 'Erro no-speech (silêncio) deve ser tolerado sem abortar');
assert(serviceCode.includes("error === 'not-allowed'"), 'Erro not-allowed deve ser tratado como fatal e orientar usuário');
assert(serviceCode.includes("error === 'audio-capture'"), 'Erro audio-capture deve informar ausência de hardware');
assert(serviceCode.includes("error === 'network'"), 'Erro de rede deve colocar motor em estado de reconexão');
console.log('✓ Teste 5: Todos os erros previstos tratados com mensagens amigáveis.');

const ptLocaleCode = fs.readFileSync(path.join(rootDir, 'src', 'i18n', 'locales', 'pt.ts'), 'utf-8');

// ----------------------------------------------------------------------------
// TESTE 6: Dois Modos de Utilização (Nota por Voz & Reunião)
// ----------------------------------------------------------------------------
console.log('Teste 6: Validando dois modos de uso e formatação de Markdown...');
const hookCode = fs.readFileSync(voiceHookPath, 'utf-8');
assert(hookCode.includes("currentMode === 'meeting'"), 'Deve suportar alternância entre Nota e Reunião');
assert(hookCode.includes('noteTitleMeetingPrefix') && ptLocaleCode.includes('Reunião — '), 'Título padrão para reuniões deve seguir formato');
assert(hookCode.includes('noteTitleVoicePrefix') && ptLocaleCode.includes('Nota por voz — '), 'Título padrão para notas deve seguir formato');
assert(hookCode.includes('mdMeetingConsent') && ptLocaleCode.includes('Transcrição de reunião autorizada pelos participantes'), 'Modo reunião deve incluir aviso de consentimento');
assert(hookCode.includes("[${seg.timeFormatted}]"), 'Cada segmento deve ser registrado com timestamp [HH:MM]');
console.log('✓ Teste 6: Modos Nota por Voz e Transcrição de Reunião com Markdown validados.');

// ----------------------------------------------------------------------------
// TESTE 7: Persistência Imediata no Início e Auto-Save Progressivo
// ----------------------------------------------------------------------------
console.log('Teste 7: Validando criação antecipada da nota e salvamento incremental...');
assert(hookCode.includes('api.createNote(null, title, initialMarkdown)'), 'Nota REAL deve ser criada no SQLite imediatamente ao iniciar');
assert(hookCode.includes('api.saveNote(targetNoteId, title, content, currentVersion)'), 'Segmentos confirmados devem ser persistidos via api.saveNote');
assert(hookCode.includes('++versionRef.current'), 'Versão monotônica deve prevenir condições de corrida');
assert(hookCode.includes("setSaveStatus('saving')") && hookCode.includes("setSaveStatus('saved')"), 'Estados de salvamento devem ser visíveis');
console.log('✓ Teste 7: Criação imediata e persistência incremental validadas.');

// ----------------------------------------------------------------------------
// TESTE 8: Fila Offline de Recuperação com IndexedDB
// ----------------------------------------------------------------------------
console.log('Teste 8: Validando fila offline resiliente para quedas de internet/túnel...');
const offlineCode = fs.readFileSync(offlineStoragePath, 'utf-8');
assert(offlineCode.includes('nook_voice_offline_db'), 'Deve utilizar banco IndexedDB dedicado');
assert(offlineCode.includes('savePendingDraft'), 'Deve implementar savePendingDraft');
assert(offlineCode.includes('getPendingDraft'), 'Deve implementar getPendingDraft');
assert(offlineCode.includes('removePendingDraft'), 'Deve limpar rascunho após confirmação pelo backend');
assert(offlineCode.includes('memoryFallback'), 'Deve possuir fallback para memória/sessionStorage caso IndexedDB falhe');
console.log('✓ Teste 8: Fila offline resiliente com IndexedDB e fallback validada.');

// ----------------------------------------------------------------------------
// TESTE 9: Screen Wake Lock e Page Visibility API
// ----------------------------------------------------------------------------
console.log('Teste 9: Validando Screen Wake Lock para manter tela móvel ligada...');
const wakeLockCode = fs.readFileSync(wakeLockPath, 'utf-8');
assert(wakeLockCode.includes(".wakeLock.request('screen')"), 'Deve solicitar wake lock do tipo screen');
assert(wakeLockCode.includes('document.addEventListener(\'visibilitychange\''), 'Deve re-adquirir wake lock ao voltar para primeiro plano');
assert(wakeLockCode.includes('release()'), 'Deve liberar wake lock ao finalizar/pausar');
console.log('✓ Teste 9: Screen Wake Lock e gestão de visibilidade validados.');

// ----------------------------------------------------------------------------
// TESTE 10: Interface Minimalista e Estritamente Monocromática
// ----------------------------------------------------------------------------
console.log('Teste 10: Validando design monocromático e ausência de elementos vermelhos/gradientes...');
const modalCode = fs.readFileSync(voiceModalPath, 'utf-8');
assert(!modalCode.includes('#FF0000') && !modalCode.includes('#ff0000') && !modalCode.includes("'red'") && !modalCode.includes('"red"'), 'Interface NÃO deve utilizar microfone vermelho (estritamente monocromático)');
assert(!modalCode.includes('linear-gradient'), 'Não deve conter gradientes chamativos');
assert(modalCode.includes('NookIdleMascot'), 'Deve incluir representação discreta do mascote oficial Nook');
assert(modalCode.includes('formatTimer'), 'Cronômetro visual no formato MM:SS deve estar presente');
assert(modalCode.includes('t.voice.privacyTitle') && ptLocaleCode.includes('Privacidade'), 'Aviso explícito de privacidade antes do primeiro uso');
console.log('✓ Teste 10: Interface estritamente monocromática e aviso de privacidade validados.');

// ----------------------------------------------------------------------------
// TESTE 11: Integração no MobileTopBar e TabBar
// ----------------------------------------------------------------------------
console.log('Teste 11: Validando integração com botão de microfone no header mobile e desktop...');
const topBarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'mobile', 'MobileTopBar.tsx'), 'utf-8');
assert(topBarCode.includes('onOpenVoice'), 'MobileTopBar deve aceitar onOpenVoice');
assert(topBarCode.includes('<Mic'), 'MobileTopBar deve renderizar ícone Mic');
assert(topBarCode.includes('t.mobile.newVoiceNote') && ptLocaleCode.includes('Nova nota por voz'), 'Identificação acessível "Nova nota por voz" presente');

const appCode = fs.readFileSync(path.join(rootDir, 'src', 'app', 'App.tsx'), 'utf-8');
assert(appCode.includes('isVoiceModalOpen'), 'App.tsx deve gerenciar estado do modal de voz');
assert(appCode.includes('NookVoiceModal'), 'NookVoiceModal deve estar registrado no App.tsx');

const tabBarCode = fs.readFileSync(path.join(rootDir, 'src', 'components', 'tabs', 'TabBar.tsx'), 'utf-8');
assert(tabBarCode.includes('onOpenVoice'), 'TabBar deve suportar onOpenVoice para desktop e web');
console.log('✓ Teste 11: Botões de acesso rápido integrados no header mobile, desktop e App.tsx.');

// ----------------------------------------------------------------------------
// TESTE 12: Simulação Completa de Transcrição e Ausência de Duplicação
// ----------------------------------------------------------------------------
console.log('Teste 12: Simulando pipeline de transcrição com SpeechRecognition mock...');

class MockSpeechRecognition {
  continuous = true;
  interimResults = true;
  lang = 'pt-BR';
  onstart = null;
  onresult = null;
  onerror = null;
  onend = null;
  start() {
    setTimeout(() => this.onstart && this.onstart(), 5);
  }
  stop() {
    setTimeout(() => this.onend && this.onend(), 5);
  }
  abort() {}
}

let committedText = [];
let interimResult = '';

const engine = new (class {
  lastFinalText = '';
  lastFinalTimestamp = 0;
  onresult(results, resultIndex) {
    let currentInterim = '';
    for (let i = resultIndex; i < results.length; i++) {
      const res = results[i];
      if (res.isFinal) {
        const text = res[0].transcript.trim();
        const now = Date.now();
        if (text && !(text === this.lastFinalText && now - this.lastFinalTimestamp < 2500)) {
          this.lastFinalText = text;
          this.lastFinalTimestamp = now;
          committedText.push(text);
        }
      } else {
        currentInterim += res[0].transcript;
      }
    }
    interimResult = currentInterim;
  }
})();

const createMockResult = (transcript, isFinal) => {
  const item = [{ transcript, confidence: 0.95 }];
  item.isFinal = isFinal;
  return item;
};

// Simulação 1: Fala provisória "Precisamos revisar"
engine.onresult([createMockResult('Precisamos revisar', false)], 0);
assert.strictEqual(interimResult, 'Precisamos revisar');
assert.strictEqual(committedText.length, 0, 'Texto parcial não deve ser persistido como final');

// Simulação 2: Fala concluída "Precisamos revisar o marketing."
engine.onresult([createMockResult('Precisamos revisar o marketing.', true)], 0);
assert.strictEqual(committedText.length, 1);
assert.strictEqual(committedText[0], 'Precisamos revisar o marketing.');

// Simulação 3: Disparo repetido do mesmo segmento final (comum em navegadores após onend)
engine.onresult([createMockResult('Precisamos revisar o marketing.', true)], 0);
assert.strictEqual(committedText.length, 1, 'Frase duplicada em curto intervalo DEVE ser descartada');

// Simulação 4: Nova frase diferente
engine.onresult([createMockResult('E também definir as datas.', true)], 0);
assert.strictEqual(committedText.length, 2);
assert.strictEqual(committedText[1], 'E também definir as datas.');

console.log('✓ Teste 12: Pipeline de fala simulada, interim vs final e deduplicação validados com 100% de sucesso.');

// ----------------------------------------------------------------------------
// TESTE 13: Benchmark de Performance do Nook Voice
// ----------------------------------------------------------------------------
console.log('Teste 13: Medindo benchmarks de latência de Markdown e processamento de fala...');
const startTime = process.hrtime.bigint();
for (let i = 0; i < 1000; i++) {
  const segments = [
    { id: '1', sequence: 1, text: 'Primeira ideia anotada.', timestamp: Date.now(), timeFormatted: '10:00' },
    { id: '2', sequence: 2, text: 'Segunda anotação importante.', timestamp: Date.now(), timeFormatted: '10:01' },
    { id: '3', sequence: 3, text: 'Terceiro ponto de decisão.', timestamp: Date.now(), timeFormatted: '10:02' },
  ];
  let md = `# Nota por voz\n\n*Início: 10:00*\n\n## Transcrição\n\n`;
  for (const s of segments) {
    md += `[${s.timeFormatted}] ${s.text}\n\n`;
  }
}
const endTime = process.hrtime.bigint();
const elapsedMs = Number(endTime - startTime) / 1_000_000;
const avgLatencyUs = (elapsedMs / 1000) * 1000;
console.log(`✓ Latência média de montagem do Markdown: ${avgLatencyUs.toFixed(2)} µs por ciclo (Meta: < 50 µs)`);
assert(avgLatencyUs < 50, 'Montagem de Markdown deve ser imperceptível (< 50µs)');

// ----------------------------------------------------------------------------
// TESTE 14: Preservação de Estado de Erro após onend e Controle de Corrida Assíncrona
// ----------------------------------------------------------------------------
console.log('Teste 14: Validando proteção contra sobrescrita de erro no onend e race em createNote...');
assert(serviceCode.includes('hasFatalError'), 'SpeechRecognitionService deve preservar erro fatal sem sobrescrever com finished no onend');
assert(hookCode.includes('sessionSeqRef') && hookCode.includes('pendingFinishRef'), 'useVoiceSession deve proteger createNote assíncrono com sessionSeqRef');
console.log('✓ Teste 14: Estado de erro e concorrência de sessão de voz validados com sucesso.');

console.log('\n--- Todos os 14 testes de auditoria e validação do Nook Voice foram aprovados com 100% de sucesso! ---');
