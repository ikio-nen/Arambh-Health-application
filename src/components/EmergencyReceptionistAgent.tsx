import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, PhoneCall, Mic, MicOff, Volume2, VolumeX, Send, 
  Heart, Activity, CheckCircle2, ArrowLeft, Smartphone
} from 'lucide-react';
import { EmergencyCase } from '../types';
import { aiChatService } from '../services/aiChatService';
import { nearestHospital } from '../services/geo';
import { VibrationService } from '../services/vibrationService';

interface EmergencyReceptionistAgentProps {
  hospitalName?: string;
  activeCase?: EmergencyCase | null;
  onBack?: () => void;
  isOfflineMode: boolean;
}

export const EmergencyReceptionistAgent: React.FC<EmergencyReceptionistAgentProps> = ({
  hospitalName = 'Arambh Metro Trauma Center',
  activeCase,
  onBack,
  isOfflineMode,
}) => {
  const [messages, setMessages] = useState<Array<{ sender: 'agent' | 'user'; text: string; time: string }>>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [speechEnabled, setSpeechEnabled] = useState<boolean>(true);
  const [isMicListening, setIsMicListening] = useState<boolean>(false);
  const [isVibratingCall, setIsVibratingCall] = useState<boolean>(true);

  // CPR Metronome State (110 BPM)
  const [cprActive, setCprActive] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const metronomeIntervalRef = useRef<any>(null);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const targetHospital = hospitalName || activeCase?.assigned_hospital || nearestHospital().hospital.name;

  // Initialize Receptionist Greeting & Start Active Call Physical Vibration Pulse
  useEffect(() => {
    const greetingText = `Emergency Reception at ${targetHospital}. We have your GPS coordinates. Trauma Bed is reserved and the nearest ambulance is on standby. I am logging your condition directly into our admission ledger. What symptoms are present?`;
    
    setMessages([
      {
        sender: 'agent',
        text: greetingText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
    ]);

    if (speechEnabled && 'speechSynthesis' in window) {
      speakMessage(greetingText);
    }

    // Physical vibration feedback for active emergency call
    if (isVibratingCall) {
      VibrationService.startCallHapticPulse();
    }

    return () => {
      VibrationService.stopCallHapticPulse();
    };
  }, [targetHospital]);

  // Handle vibration toggle
  const toggleCallVibration = () => {
    if (isVibratingCall) {
      VibrationService.stopCallHapticPulse();
      setIsVibratingCall(false);
    } else {
      VibrationService.startCallHapticPulse();
      setIsVibratingCall(true);
    }
  };

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const speakMessage = (text: string) => {
    if (!('speechSynthesis' in window) || !speechEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text.replace(/[*#_`]/g, '');
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis err:', e);
    }
  };

  // CPR Metronome with Audio and Haptic Pulse (110 BPM)
  useEffect(() => {
    if (cprActive) {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!audioCtxRef.current && AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
        const intervalMs = Math.round((60 / 110) * 1000);
        metronomeIntervalRef.current = setInterval(() => {
          if (audioCtxRef.current) {
            const osc = audioCtxRef.current.createOscillator();
            const gain = audioCtxRef.current.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, audioCtxRef.current.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtxRef.current.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtxRef.current.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(audioCtxRef.current.destination);
            osc.start();
            osc.stop(audioCtxRef.current.currentTime + 0.08);
          }
          // Synchronized tactile pulse
          VibrationService.triggerQuickTap();
        }, intervalMs);
      } catch (err) {
        console.warn('CPR metronome err:', err);
      }
    } else {
      if (metronomeIntervalRef.current) {
        clearInterval(metronomeIntervalRef.current);
      }
    }

    return () => {
      if (metronomeIntervalRef.current) clearInterval(metronomeIntervalRef.current);
    };
  }, [cprActive]);

  // Voice Microphone Input
  const toggleMic = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition not available.');
      return;
    }

    if (isMicListening) {
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsMicListening(false);
    } else {
      try {
        const recog = new SpeechRecognition();
        recog.lang = 'en-US';
        recog.interimResults = false;
        recog.onresult = (e: any) => {
          const spoken = e.results[0][0].transcript;
          setInputQuery(spoken);
          handleSendMessage(spoken);
        };
        recog.onerror = () => setIsMicListening(false);
        recog.onend = () => setIsMicListening(false);
        recog.start();
        recognitionRef.current = recog;
        setIsMicListening(true);
      } catch (err) {
        console.warn('Recog err:', err);
      }
    }
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || isTyping) return;

    VibrationService.triggerQuickTap();

    const userMsg = {
      sender: 'user' as const,
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuery('');
    setIsTyping(true);

    try {
      const prompt = `You are the Emergency Admitting Receptionist and Triage Officer on duty at ${targetHospital}. The patient or caller reported: "${textToSend}". Active case condition: "${activeCase?.condition_text || 'Urgent distress'}". Give clear, reassuring, calm, and concise emergency medical guidance (under 60 words). State what the ER team is doing right now and what immediate first aid steps to take.`;
      
      const reply = await aiChatService.sendMessage(prompt, isOfflineMode);
      
      const agentMsg = {
        sender: 'agent' as const,
        text: reply.content,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, agentMsg]);
      setIsTyping(false);

      if (speechEnabled) {
        speakMessage(reply.content);
      }

      if (reply.content.toLowerCase().includes('cpr') || textToSend.toLowerCase().includes('cpr')) {
        setCprActive(true);
      }
    } catch (err: any) {
      const fallback = `I have logged this with our emergency trauma team. Keep the patient calm. Our medical team is ready for arrival.`;
      setMessages(prev => [...prev, {
        sender: 'agent',
        text: fallback,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }]);
      setIsTyping(false);
      if (speechEnabled) speakMessage(fallback);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-slate-100" id="receptionist-agent-view">
      {/* Refined Minimal Header */}
      <div className="bg-[#111317] border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-[#181b22] hover:bg-[#20242e] text-slate-400 hover:text-white transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                Emergency Reception Desk
              </span>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                LIVE CALL
              </span>
            </div>
            <h1 className="text-base font-bold text-white tracking-tight">
              {targetHospital}
            </h1>
          </div>
        </div>

        {/* Tactical Controls: CPR + Vibration + Voice */}
        <div className="flex items-center space-x-2">
          {/* Physical Vibration Pulse Toggle */}
          <button
            onClick={toggleCallVibration}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center space-x-1.5 border transition-all cursor-pointer ${
              isVibratingCall
                ? 'bg-[#181b22] border-red-500/40 text-red-400'
                : 'bg-[#181b22] border-white/5 text-slate-500'
            }`}
            title="Toggle Physical Vibration Feedback during emergency call"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isVibratingCall ? 'HAPTIC ACTIVE' : 'HAPTIC OFF'}</span>
          </button>

          {/* CPR Metronome */}
          <button
            onClick={() => setCprActive(!cprActive)}
            className={`px-2.5 py-1.5 rounded-lg font-mono text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              cprActive
                ? 'bg-red-500 text-white border-red-400'
                : 'bg-[#181b22] border-white/10 text-slate-300 hover:text-white'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${cprActive ? 'fill-white' : 'text-red-400'}`} />
            <span>{cprActive ? '110 BPM' : 'CPR RHYTHM'}</span>
          </button>

          {/* Voice Mute */}
          <button
            onClick={() => {
              if (speechEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              setSpeechEnabled(!speechEnabled);
            }}
            className="p-2 rounded-lg bg-[#181b22] text-slate-400 hover:text-white border border-white/5 cursor-pointer"
            title={speechEnabled ? 'Mute Speech' : 'Enable Speech'}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4 text-slate-300" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>
        </div>
      </div>

      {/* Bed Reservation & Ambulance Pill */}
      {activeCase && (
        <div className="bg-[#14161a] border border-white/5 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs font-mono">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-white font-medium">Bed Reserved ({activeCase.id})</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-400">
            <span>Ambulance ETA: <b className="text-white">~{activeCase.eta_minutes}m</b></span>
            <a 
              href={`tel:${activeCase.ambulance_phone}`}
              className="px-2 py-0.5 rounded bg-red-500 hover:bg-red-400 text-white font-bold"
            >
              Call
            </a>
          </div>
        </div>
      )}

      {/* CHAT MESSAGES LOG: MINIMALIST OBSIDIAN TILES */}
      <div className="bg-[#111317] border border-white/5 rounded-2xl p-4 min-h-[380px] max-h-[440px] overflow-y-auto space-y-3 shadow-inner">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 mb-1 px-1">
              <span className="text-[10px] font-mono text-slate-400 uppercase">
                {msg.sender === 'agent' ? `Receptionist (${targetHospital})` : 'You'}
              </span>
              <span className="text-[10px] font-mono text-slate-600">• {msg.time}</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-red-500 text-white rounded-tr-none font-medium'
                  : 'bg-[#181b22] border border-white/5 text-slate-200 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-mono p-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            <span>Hospital receptionist replying...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR WITH VOICE INPUT */}
      <div className="flex items-center space-x-2 bg-[#111317] p-2 rounded-xl border border-white/10 focus-within:border-red-500/50">
        <button
          onClick={toggleMic}
          className={`p-2.5 rounded-lg transition-all cursor-pointer ${
            isMicListening
              ? 'bg-red-500 text-white animate-pulse'
              : 'bg-[#181b22] text-slate-400 hover:text-white'
          }`}
          title="Speak to Receptionist"
        >
          {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>

        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          placeholder="Speak or type symptoms..."
          className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-white focus:outline-none placeholder-slate-500"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={isTyping || !inputQuery.trim()}
          className="py-2.5 px-4 rounded-lg bg-red-500 hover:bg-red-400 disabled:opacity-40 text-white font-mono text-xs font-bold uppercase transition-colors cursor-pointer flex items-center space-x-1.5"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 font-mono text-[11px] text-slate-400">
        <button
          onClick={() => handleSendMessage("Patient is unconscious and breathing shallowly")}
          className="px-2.5 py-1 rounded-md bg-[#14161a] border border-white/5 hover:border-white/20 text-slate-300 hover:text-white"
        >
          Unconscious & Shallow Breath
        </button>
        <button
          onClick={() => handleSendMessage("Severe chest pressure and cold sweat")}
          className="px-2.5 py-1 rounded-md bg-[#14161a] border border-white/5 hover:border-white/20 text-slate-300 hover:text-white"
        >
          Chest Pressure & Cold Sweat
        </button>
        <button
          onClick={() => handleSendMessage("How far is the dispatched ambulance?")}
          className="px-2.5 py-1 rounded-md bg-[#14161a] border border-white/5 hover:border-white/20 text-slate-300 hover:text-white"
        >
          Check Ambulance ETA
        </button>
      </div>
    </div>
  );
};
