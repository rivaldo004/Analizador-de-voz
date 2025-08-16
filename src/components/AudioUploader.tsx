import React, { useRef, useState, useEffect } from 'react';
import { Upload, Play, Pause, RotateCcw } from 'lucide-react';
import { t } from '../config/language';

interface AudioUploaderProps {
  onAudioAnalysis: (audioData: any) => void;
  onTranscriptUpdate: (transcript: string) => void;
}

export const AudioUploader: React.FC<AudioUploaderProps> = ({ onAudioAnalysis, onTranscriptUpdate }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dominantFrequencyDisplay, setDominantFrequencyDisplay] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      console.error('No se seleccionó ningún archivo');
      return;
    }
    
    if (!file.type.startsWith('audio/')) {
      console.error('El archivo seleccionado no es un archivo de audio');
      alert('Por favor, seleccione un archivo de audio válido (MP3, WAV, etc.)');
      event.target.value = ''; // Limpiar el input para permitir seleccionar el mismo archivo nuevamente
      return;
    }
    
    try {
      console.log('Iniciando carga de archivo de audio:', file.name, 'tipo:', file.type, 'tamaño:', file.size);
      
      // Limpiar cualquier reproducción anterior
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        if (audioRef.current.src) {
          URL.revokeObjectURL(audioRef.current.src);
          console.log('URL anterior revocada');
        }
      }
      // Detener cualquier análisis en curso
      stopAnalyzing();
      setIsPlaying(false);
      
      // Cerrar el contexto de audio anterior si existe
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        console.log('Cerrando contexto de audio anterior...');
      
      console.log('Archivo de audio cargado:', file.name, 'URL:', url);
      
      // Asignar la URL al elemento de audio
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        // Precargar el audio
        const loadTimeout = setTimeout(() => {
      event.target.value = '';
    } catch (error) {
      console.error('Error al cargar el archivo de audio:', error);
      alert('Error al cargar el archivo de audio. Intente con otro archivo.');
      event.target.value = '';
    }
  };

  // Variable para rastrear si ya se ha conectado el elemento de audio a un contexto
  const [audioNodeConnected, setAudioNodeConnected] = useState(false);

  const setupAudioAnalysis = async () => {
    try {
      if (!audioRef.current) {
        return false;
      }

      if (!audioRef.current.src || audioRef.current.src === '') {
        return false;
      }

      if (audioRef.current.readyState === 0) {
        return false;
      }

      // Si ya tenemos un contexto y un analizador funcionando, usarlos
      if (audioContextRef.current && analyserRef.current && sourceNodeRef.current) {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        startAnalyzing();
        return true;
      }
      
      // Cerrar el contexto anterior si existe
      if (audioContextRef.current) {
        await audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      analyserRef.current = null;
      sourceNodeRef.current = null;
      
      // Crear un nuevo contexto de audio
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) {
        return false;
      }
      
      audioContextRef.current = new AudioContext();
      
      try {
        // Crear fuente de audio
        sourceNodeRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
        
        // Configurar analizador
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        analyserRef.current.smoothingTimeConstant = 0.8;
        
        // Conectar nodos
        sourceNodeRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);
        
        // Iniciar análisis
        startAnalyzing();
        
        return true;
      } catch (sourceError) {
        console.error('Error al crear la fuente de audio:', sourceError);
        return false;
      }
    } catch (error) {
      console.error('Error al configurar el análisis de audio:', error);
      return false;
    }
  };

  const analyzeUploadedAudio = () => {
    try {
      if (!analyserRef.current) {
        return;
      }
      
      const bufferLength = analyserRef.current.frequencyBinCount;
      if (!bufferLength) {
        return;
      }
      
      const dataArray = new Uint8Array(bufferLength);

      try {
        analyserRef.current.getByteFrequencyData(dataArray);
      } catch (freqError) {
        console.error('Error al obtener datos de frecuencia:', freqError);
        return;
      }

      // Calcular frecuencia dominante
      let maxAmplitude = 0;
      let dominantFrequency = 0;
      const sampleRate = audioContextRef.current?.sampleRate || 44100;
      
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxAmplitude) {
          maxAmplitude = dataArray[i];
          dominantFrequency = (i * sampleRate) / (bufferLength * 2);
        }
      }

      // Calcular pitch usando autocorrelación simple
      const pitch = calculatePitch(dataArray, sampleRate);

      const volume = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      onAudioAnalysis({
        frequency: Math.round(dominantFrequency),
        amplitude: Math.round(maxAmplitude),
        pitch: Math.round(pitch),
        volume: Math.round(volume),
        dataArray
      });

      setDominantFrequencyDisplay(Math.round(dominantFrequency));
    } catch (error) {
      console.error('Error durante el análisis de audio:', error);
    }
  };

  const calculatePitch = (buffer: Uint8Array, sampleRate: number): number => {
    const SIZE = buffer.length;
    const MAX_SAMPLES = Math.floor(SIZE / 2);
    let bestOffset = -1;
    let bestCorrelation = 0;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = (buffer[i] - 128) / 128;
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);
    
    if (rms < 0.01) return -1;

    for (let offset = 1; offset < MAX_SAMPLES; offset++) {
      let correlation = 0;
      for (let i = 0; i < MAX_SAMPLES; i++) {
        correlation += Math.abs(((buffer[i] - 128) / 128) - ((buffer[i + offset] - 128) / 128));
      }
      correlation = 1 - (correlation / MAX_SAMPLES);
      
      if (correlation > bestCorrelation) {
        bestCorrelation = correlation;
        bestOffset = offset;
      }
    }
    
    return bestCorrelation > 0.01 ? sampleRate / bestOffset : -1;
  };

  const startAnalyzing = () => {
    if (!analyserRef.current) {
      return;
    }
    
    // Detener cualquier análisis anterior
    stopAnalyzing();
    
    animationRef.current = requestAnimationFrame(function analyze() {
      analyzeUploadedAudio();
      if (isPlaying) {
        animationRef.current = requestAnimationFrame(analyze);
      }
    });
  };

  const stopAnalyzing = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = undefined;
    }
  };

  const togglePlayback = async () => {
    if (!audioRef.current) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      stopAnalyzing();
    } else {
      try {
        if (audioContextRef.current?.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        
        if (!audioRef.current.src || audioRef.current.src === '') {
          alert('No hay archivo de audio cargado. Por favor, suba un archivo primero.');
          return;
        }
        
        // Configurar análisis
        await setupAudioAnalysis();
        
        // Reproducir el audio con manejo de errores
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              setIsPlaying(true);
              startAnalyzing();
            })
            .catch(error => {
              console.error('Error al reproducir audio:', error);
              alert(`Error al reproducir: ${error.message}. Verifique que el archivo de audio sea válido.`);
            });
        }
      } catch (error) {
        console.error('Error en togglePlayback:', error);
      }
    }
  };

  const resetAudio = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Función para transcribir el audio cargado
  const transcribeAudio = async () => {
    if (!uploadedFile) return;
    
    try {
      // Simulación de transcripción - en una aplicación real, usaríamos un servicio de reconocimiento de voz
      // como la Web Speech API o un servicio externo como Google Speech-to-Text
      const mockTranscript = `Transcripción simulada del archivo: ${uploadedFile.name}`;
      
      // Enviamos la transcripción al componente padre
      onTranscriptUpdate(mockTranscript);
    } catch (error) {
      console.error('Error al transcribir el audio:', error);
    }
  };

  // Efecto para transcribir el audio cuando se carga un nuevo archivo
  useEffect(() => {
    if (uploadedFile) {
      transcribeAudio();
    }
  }, [uploadedFile]);

  useEffect(() => {
    return () => {
      stopAnalyzing();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
      <h2 className="text-2xl font-bold text-purple-400 mb-6 flex items-center gap-2">
        <Upload className="w-6 h-6" />
        {t('audioUploader')}
      </h2>

      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-all"
          >
            <Upload className="w-4 h-4" />
            {t('uploadAudio')}
          </button>
          
          {uploadedFile && (
            <span className="text-purple-300 text-sm">
              {uploadedFile.name}
            </span>
          )}
        </div>

        {uploadedFile && (
          <div className="space-y-4">
            <audio
              ref={audioRef}
              onLoadedMetadata={() => {
                setDuration(audioRef.current?.duration || 0);
              }}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onEnded={() => {
                setIsPlaying(false);
                stopAnalyzing();
              }}
              onError={(e) => {
                console.error('Error en elemento audio:', e);
                alert('Error al cargar el audio. Intente con otro archivo.');
              }}
              controls
              className="w-full mb-4 bg-gray-900 rounded-lg"
              preload="auto"
            />
            
            <div className="flex items-center gap-4">
              <button
                onClick={togglePlayback}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isPlaying ? t('pauseAudio') : t('playAudio')}
              </button>
              
              <button
                onClick={resetAudio}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                {t('reset')}
              </button>
            </div>

            <div className="bg-black/50 p-4 rounded-lg">
              <div className="flex justify-between text-sm text-gray-400 mb-2">
                <span>{t('currentTime')}: {formatTime(currentTime)}</span>
                <span>{t('duration')}: {formatTime(duration)}</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>

            {dominantFrequencyDisplay !== null && (
              <div className="mt-4 text-center text-green-400 font-mono text-xl">
                {t('dominantFrequency')}: {dominantFrequencyDisplay} Hz
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
