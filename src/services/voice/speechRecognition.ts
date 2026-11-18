// ============================================================================
// NOOK VOICE — SPEECH RECOGNITION SERVICE
// Native Web Speech API Engine with Continuous Recovery & Zero Duplications
// ============================================================================

import {
  ISpeechRecognition,
  ISpeechRecognitionEvent,
  ISpeechRecognitionErrorEvent,
  SpeechRecognitionConstructor,
  VoiceStatus,
} from '../../types/speech';

export interface SpeechEngineCallbacks {
  onStatusChange: (status: VoiceStatus, message?: string) => void;
  onInterim: (text: string) => void;
  onFinalSegment: (text: string, timestamp: number) => void;
  onError: (error: string, isFatal: boolean) => void;
}

export class SpeechRecognitionService {
  private recognition: ISpeechRecognition | null = null;
  private callbacks: SpeechEngineCallbacks;
  private isUserActive = false;
  private isPaused = false;
  private restartTimer: any = null;
  private permissionWatchdogTimer: any = null;
  private consecutiveRestarts = 0;
  private lastRestartTimestamp = 0;
  private lastFinalText = '';
  private lastFinalTimestamp = 0;
  private hasFatalError = false;
  private lang = 'pt-BR';

  constructor(callbacks: SpeechEngineCallbacks, lang = 'pt-BR') {
    this.callbacks = callbacks;
    this.lang = lang;
  }

  static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition
    );
  }

  static getConstructor(): SpeechRecognitionConstructor | null {
    if (typeof window === 'undefined') return null;
    return (
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition ||
      null
    );
  }

  private initEngine(): boolean {
    const Ctor = SpeechRecognitionService.getConstructor();
    if (!Ctor) {
      this.callbacks.onError(
        'Reconhecimento de voz não suportado neste navegador. Utilize Google Chrome ou Safari.',
        true
      );
      return false;
    }

    try {
      if (this.recognition) {
        this.destroyEngine();
      }

      const isWebKit =
        typeof navigator !== 'undefined' &&
        (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
          (navigator.vendor && navigator.vendor.indexOf('Apple') > -1) ||
          (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)));

      this.recognition = new Ctor();
      this.recognition.lang = this.lang;
      if (isWebKit) {
        // iOS WebKit / Safari rejects continuous = true with service-not-allowed or not-allowed.
        // It requires single-utterance mode with seamless automatic recovery in onend.
        this.recognition.continuous = false;
      } else {
        this.recognition.continuous = true;
      }
      this.recognition.interimResults = true;
      this.recognition.maxAlternatives = 1;

      const handleListeningStarted = () => {
        this.clearPermissionTimeout();
        this.consecutiveRestarts = 0;
        if (!this.isPaused) {
          this.callbacks.onStatusChange('listening');
        }
      };

      this.recognition.onstart = handleListeningStarted;
      this.recognition.onaudiostart = handleListeningStarted;
      this.recognition.onsoundstart = handleListeningStarted;
      this.recognition.onspeechstart = handleListeningStarted;

      this.recognition.onresult = (event: ISpeechRecognitionEvent) => {
        let currentInterim = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          const rawTranscript = result[0]?.transcript || '';
          const trimmed = rawTranscript.trim();

          if (result.isFinal) {
            if (trimmed) {
              const now = Date.now();
              // Deduplication guard: ignore identical final phrase within 2.5s window
              const isDuplicate =
                trimmed.toLowerCase() === this.lastFinalText.toLowerCase() &&
                now - this.lastFinalTimestamp < 2500;

              if (!isDuplicate) {
                this.lastFinalText = trimmed;
                this.lastFinalTimestamp = now;
                this.callbacks.onFinalSegment(trimmed, now);
              }
            }
          } else {
            currentInterim += (currentInterim ? ' ' : '') + rawTranscript;
          }
        }

        this.callbacks.onInterim(currentInterim);
      };

      this.recognition.onerror = (event: ISpeechRecognitionErrorEvent) => {
        this.clearPermissionTimeout();
        const error = event.error;

        if (error === 'no-speech') {
          // Normal silence; do not treat as fatal
          return;
        }

        if (error === 'not-allowed' || error === 'service-not-allowed') {
          this.isUserActive = false;
          this.hasFatalError = true;
          const isService = error === 'service-not-allowed';
          this.callbacks.onStatusChange(
            'error',
            isService ? 'Serviço recusado pelo iOS' : 'Permissão necessária'
          );
          this.callbacks.onError(
            isService
              ? 'O reconhecimento automático foi bloqueado pelo iOS para este endereço [service-not-allowed]. Utilize o Método 2 (Ditado por Teclado) abaixo para falar com o microfone nativo do seu iPhone.'
              : 'Permissão de reconhecimento de voz necessária [not-allowed]. No Safari, toque no ícone "aA" na barra de endereço → "Ajustes do Site" → "Microfone: Permitir". Depois toque em "Tentar Novamente".',
            true
          );
          return;
        }

        if (error === 'audio-capture') {
          this.isUserActive = false;
          this.hasFatalError = true;
          this.callbacks.onStatusChange('error', 'Sem microfone');
          this.callbacks.onError('Nenhum microfone detectado no dispositivo.', true);
          return;
        }

        if (error === 'network') {
          this.callbacks.onStatusChange('reconnecting', 'Erro de rede');
          this.callbacks.onError('Instabilidade de conexão no serviço de voz do navegador.', false);
          return;
        }

        if (error === 'aborted') {
          // Expected on explicit abort
          return;
        }

        this.callbacks.onError(`Erro no reconhecimento: ${error}`, false);
      };

      this.recognition.onend = () => {
        this.callbacks.onInterim(''); // Clear interim hypothesis

        // Automatic seamless continuous restart if user is actively transcribing
        if (this.isUserActive && !this.isPaused) {
          const now = Date.now();
          if (now - this.lastRestartTimestamp < 1500) {
            this.consecutiveRestarts++;
          } else {
            this.consecutiveRestarts = 1;
          }
          this.lastRestartTimestamp = now;

          if (this.consecutiveRestarts > 5) {
            // Rapid failure loop protection: pause and prompt user
            this.isPaused = true;
            this.callbacks.onStatusChange('paused', 'Transcrição pausada');
            this.callbacks.onError(
              'O navegador pausou o reconhecimento. Toque em "Retomar" para continuar.',
              false
            );
            return;
          }

          this.callbacks.onStatusChange('reconnecting');
          const isWebKit =
            typeof navigator !== 'undefined' &&
            (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
              (navigator.vendor && navigator.vendor.indexOf('Apple') > -1) ||
              (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)));
          const delay = isWebKit ? 150 : Math.min(this.consecutiveRestarts * 120, 600);

          if (this.restartTimer) clearTimeout(this.restartTimer);
          this.restartTimer = setTimeout(() => {
            if (this.isUserActive && !this.isPaused) {
              if (isWebKit) {
                this.destroyEngine();
                if (this.initEngine()) {
                  this.safeStartRecognition();
                }
              } else {
                this.safeStartRecognition();
              }
            }
          }, delay);
        } else if (this.isPaused) {
          this.callbacks.onStatusChange('paused');
        } else if (!this.hasFatalError) {
          this.callbacks.onStatusChange('finished');
        }
      };

      return true;
    } catch (err: any) {
      this.callbacks.onError(`Falha ao instanciar reconhecimento: ${err?.message || err}`, true);
      return false;
    }
  }

  private clearPermissionTimeout() {
    if (this.permissionWatchdogTimer) {
      clearTimeout(this.permissionWatchdogTimer);
      this.permissionWatchdogTimer = null;
    }
  }

  private startPermissionTimeout() {
    this.clearPermissionTimeout();
    this.permissionWatchdogTimer = setTimeout(() => {
      if (this.isUserActive && !this.isPaused) {
        console.warn('SpeechRecognition: permission/start timed out');
        this.callbacks.onStatusChange('error', 'Tempo limite esgotado');
        this.callbacks.onError(
          'O microfone demorou para responder. Toque em "Tentar Novamente" abaixo para gravar.',
          false
        );
      }
    }, 7000);
  }

  private safeStartRecognition() {
    if (!this.recognition) {
      if (!this.initEngine()) return;
    }
    try {
      this.recognition?.start();
    } catch (err: any) {
      // If already started or transitioning, catch and retry briefly
      if (err?.name !== 'InvalidStateError') {
        console.warn('SpeechRecognition start warning:', err);
        this.clearPermissionTimeout();
        this.callbacks.onStatusChange('error', 'Falha ao iniciar');
        this.callbacks.onError(
          `Falha ao iniciar microfone: ${err?.message || err}. Toque em "Tentar Novamente".`,
          true
        );
      }
    }
  }

  start() {
    this.isUserActive = true;
    this.isPaused = false;
    this.hasFatalError = false;
    this.consecutiveRestarts = 0;
    this.callbacks.onStatusChange('requesting_permission');
    this.startPermissionTimeout();
    // Detach listeners cleanly without triggering an abort on the underlying audio session
    this.destroyEngine(false);
    if (!this.initEngine()) return;
    this.safeStartRecognition();
  }

  pause() {
    this.isPaused = true;
    this.clearPermissionTimeout();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    try {
      this.recognition?.stop();
    } catch {}
    this.callbacks.onStatusChange('paused');
  }

  resume() {
    this.isPaused = false;
    this.isUserActive = true;
    this.consecutiveRestarts = 0;
    this.callbacks.onStatusChange('listening');
    this.safeStartRecognition();
  }

  stop() {
    this.isUserActive = false;
    this.isPaused = false;
    this.clearPermissionTimeout();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    try {
      this.recognition?.stop();
    } catch {}
    this.callbacks.onInterim('');
    this.callbacks.onStatusChange('finished');
  }

  private destroyEngine(abortRunning = false) {
    this.clearPermissionTimeout();
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.recognition) {
      this.recognition.onstart = null;
      this.recognition.onaudiostart = null;
      this.recognition.onsoundstart = null;
      this.recognition.onspeechstart = null;
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onend = null;
      if (abortRunning) {
        try {
          this.recognition.abort();
        } catch {}
      }
      this.recognition = null;
    }
  }

  dispose() {
    this.isUserActive = false;
    this.destroyEngine(true);
  }
}
