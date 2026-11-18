// ============================================================================
// NOOK VOICE — SPEECH RECOGNITION & SESSION TYPES
// Pure Web Speech API, Zero Heavy External Dependencies
// ============================================================================

export type VoiceMode = 'note' | 'meeting';

export type VoiceStatus =
  | 'idle'
  | 'requesting_permission'
  | 'listening'
  | 'processing'
  | 'paused'
  | 'reconnecting'
  | 'error'
  | 'finished';

export type VoiceSaveStatus =
  | 'saved'
  | 'saving'
  | 'unsaved'
  | 'offline_saved'
  | 'error';

export interface VoiceSegment {
  id: string;
  sequence: number;
  text: string;
  timestamp: number;
  timeFormatted: string; // e.g. "14:30"
}

export interface VoiceSessionInfo {
  noteId: string | null;
  title: string;
  mode: VoiceMode;
  startedAt: number;
  endedAt?: number;
  elapsedSeconds: number;
  segments: VoiceSegment[];
  interimText: string;
}

// ----------------------------------------------------------------------------
// Web Speech API Native Type Definitions (cross-browser compatibility)
// ----------------------------------------------------------------------------

export interface ISpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export interface ISpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): ISpeechRecognitionAlternative;
  [index: number]: ISpeechRecognitionAlternative;
}

export interface ISpeechRecognitionResultList {
  readonly length: number;
  item(index: number): ISpeechRecognitionResult;
  [index: number]: ISpeechRecognitionResult;
}

export interface ISpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: ISpeechRecognitionResultList;
}

export interface ISpeechRecognitionErrorEvent extends Event {
  readonly error:
    | 'no-speech'
    | 'aborted'
    | 'audio-capture'
    | 'network'
    | 'not-allowed'
    | 'service-not-allowed'
    | 'bad-grammar'
    | 'language-not-supported'
    | string;
  readonly message?: string;
}

export interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;

  onaudiostart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onaudioend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: ISpeechRecognition, ev: ISpeechRecognitionErrorEvent) => any) | null;
  onresult: ((this: ISpeechRecognition, ev: ISpeechRecognitionEvent) => any) | null;
  onsoundstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onsoundend: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onspeechstart: ((this: ISpeechRecognition, ev: Event) => any) | null;
  onspeechend: ((this: ISpeechRecognition, ev: Event) => any) | null;

  start(): void;
  stop(): void;
  abort(): void;
}

export type SpeechRecognitionConstructor = new () => ISpeechRecognition;
