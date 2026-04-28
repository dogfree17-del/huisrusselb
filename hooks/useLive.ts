import { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, FunctionDeclaration } from '@google/genai';
import { base64ToBytes, decodeGeminiAudioData, pcmToGeminiAudioBlob, blobToBase64 } from '../utils/audio-utils';
import { Transcription } from '../types';

interface UseLiveProps {
  onToolCall: (name: string, args: any) => Promise<any>;
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // Define any tools here if needed, or leave empty
];

export const useLive = ({ onToolCall }: UseLiveProps) => {
  const [connected, setConnected] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [volume, setVolume] = useState(0); // For visualizer (0-1)

  // Audio Contexts
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  
  // Stream & Processor references
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  
  // Audio Playback Queue
  const nextStartTimeRef = useRef<number>(0);
  const scheduledSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Video Streaming
  const videoIntervalRef = useRef<number | null>(null);

  // Gemini Session
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  // Initialize Audio Contexts
  const ensureContexts = () => {
    if (!inputContextRef.current) {
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    }
    if (!outputContextRef.current) {
      outputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
  };

  const connect = async () => {
    if (connected) return;

    try {
      ensureContexts();
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API_KEY not found in environment");

      const ai = new GoogleGenAI({ apiKey });
      
      // Get User Media (Audio)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Start Input Processing
      const ctx = inputContextRef.current!;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      
      sourceRef.current = source;
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(ctx.destination);

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: 'You are a helpful, witty, and concise AI assistant. You can see what I show you and hear what I say.',
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } },
          },
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          inputAudioTranscription: { model: 'gemini-2.5-flash-native-audio-preview-12-2025' },
          outputAudioTranscription: { model: 'gemini-2.5-flash-native-audio-preview-12-2025' },
        },
        callbacks: {
          onopen: () => {
            console.log('Session opened');
            setConnected(true);
            setTranscriptions([]);
          },
          onmessage: async (msg: LiveServerMessage) => {
            handleServerMessage(msg);
          },
          onclose: () => {
            console.log('Session closed');
            disconnect();
          },
          onerror: (err) => {
            console.error('Session error', err);
            disconnect();
          }
        }
      });

      sessionPromiseRef.current = sessionPromise;

      // Send Audio Input
      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate volume for visualizer
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
        const rms = Math.sqrt(sum / inputData.length);
        setVolume(Math.min(1, rms * 5)); // Boost slightly for visual effect

        const pcmBlob = pcmToGeminiAudioBlob(inputData);
        sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
        });
      };

    } catch (err) {
      console.error("Failed to connect:", err);
      disconnect();
    }
  };

  const handleServerMessage = async (message: LiveServerMessage) => {
    const { serverContent, toolCall } = message;

    // Handle Audio Output
    if (serverContent?.modelTurn?.parts?.[0]?.inlineData) {
      const base64 = serverContent.modelTurn.parts[0].inlineData.data;
      if (base64 && outputContextRef.current) {
        const ctx = outputContextRef.current;
        const audioBuffer = await decodeGeminiAudioData(base64ToBytes(base64), ctx);
        
        // Scheduling logic
        nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
        
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(ctx.destination);
        source.start(nextStartTimeRef.current);
        
        scheduledSourcesRef.current.add(source);
        source.onended = () => scheduledSourcesRef.current.delete(source);
        
        nextStartTimeRef.current += audioBuffer.duration;
      }
    }

    // Handle Interruption
    if (serverContent?.interrupted) {
      scheduledSourcesRef.current.forEach(s => {
        try { s.stop(); } catch(e) {}
      });
      scheduledSourcesRef.current.clear();
      nextStartTimeRef.current = 0;
    }

    // Handle Transcriptions
    if (serverContent?.inputTranscription) {
      // Typically we only show "final" or "turnComplete" input to avoid spam
      // But for liveliness we can show partials or just log turnComplete
    }
    
    // We update transcription history when turn is complete or we have text
    if (serverContent?.turnComplete) {
       // Logic to fetch accumulated text would go here if we were manually aggregating
       // But typically we get `modelTurn` text updates. 
       // The prompt example aggregates manually.
    }
    
    // Simple way: rely on the `outputTranscription` and `inputTranscription` fields
    if (serverContent?.modelTurn?.parts?.some(p => p.text)) {
        // Text is often null in audio mode unless explicitly transcribed or text-modality
    }
    
    // Handle explicitly requested transcription events
    if (serverContent?.outputTranscription?.text) {
        addTranscription(serverContent.outputTranscription.text, 'model', false);
    }
    if (serverContent?.inputTranscription?.text) {
        addTranscription(serverContent.inputTranscription.text, 'user', false);
    }

    // Handle Function Calls
    if (toolCall) {
      for (const fc of toolCall.functionCalls) {
        try {
          const result = await onToolCall(fc.name, fc.args);
          sessionPromiseRef.current?.then(session => {
             session.sendToolResponse({
               functionResponses: {
                 id: fc.id,
                 name: fc.name,
                 response: { result }
               }
             });
          });
        } catch (error) {
           console.error("Tool execution failed", error);
        }
      }
    }
  };

  const addTranscription = (text: string, sender: 'user'|'model', isFinal: boolean) => {
    setTranscriptions(prev => {
        // Naive appending; a production app would debounce/merge partials
        // Here we just append for log visibility
        return [...prev, { text, sender, isFinal, timestamp: new Date() }];
    });
  };

  const startVideo = (videoEl: HTMLVideoElement) => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    videoIntervalRef.current = window.setInterval(async () => {
      if (!sessionPromiseRef.current || !ctx || !videoEl.videoWidth) return;
      
      canvas.width = videoEl.videoWidth * 0.5; // Downscale for bandwidth
      canvas.height = videoEl.videoHeight * 0.5;
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      
      canvas.toBlob(async (blob) => {
         if (blob) {
            const base64 = await blobToBase64(blob);
            sessionPromiseRef.current?.then(session => {
                session.sendRealtimeInput({
                    media: { mimeType: 'image/jpeg', data: base64 }
                });
            });
         }
      }, 'image/jpeg', 0.6);

    }, 1000); // 1 FPS is usually enough for context, increase if needed
  };

  const stopVideo = () => {
    if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
        videoIntervalRef.current = null;
    }
  };

  const disconnect = useCallback(() => {
    if (sessionPromiseRef.current) {
        // Cannot strictly "close" the promise, but we can stop sending
        // Note: The SDK doesn't expose a clean .close() on the session object in the prompt example?
        // Wait, the prompt says "session.close() to close the connection".
        // sessionPromise returns the session.
        sessionPromiseRef.current.then(session => {
            // Check if close exists or we just stop using it?
            // The type definition in prompt doesn't explicitly show close on session interface but says "use session.close()"
            // We'll cast to any to be safe or assume it exists.
            (session as any).close?.(); 
        });
    }

    sessionPromiseRef.current = null;
    setConnected(false);
    
    // Cleanup Audio
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
    }
    
    stopVideo();

    scheduledSourcesRef.current.forEach(s => s.stop());
    scheduledSourcesRef.current.clear();
    nextStartTimeRef.current = 0;

  }, []);

  useEffect(() => {
    return () => {
      disconnect();
    }
  }, [disconnect]);

  return {
    connect,
    disconnect,
    connected,
    transcriptions,
    volume,
    startVideo,
    stopVideo
  };
};
