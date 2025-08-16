// Definiciones de tipos globales para la aplicación

// Declaraciones para APIs del navegador
interface Window {
  webkitSpeechRecognition: any;
  SpeechRecognition: any;
  webkitAudioContext: any;
}

// Tipos para reconocimiento de voz
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  error: string;
  message: string;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  0: {
    transcript: string;
    confidence: number;
  };
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}