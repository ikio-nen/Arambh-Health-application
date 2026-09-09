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
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 space-y-4 text-slate-800" id="receptionist-agent-view">
      {/* Refined Minimal Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
        <div className="flex items-center space-x-3">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-700">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Emergency Reception Desk
              </span>
              <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Connected
              </span>
            </div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight">
              {targetHospital}
            </h1>
          </div>
        </div>

        {/* Tactical Controls: CPR + Vibration + Voice */}
        <div className="flex items-center space-x-2">
          {/* Physical Vibration Pulse Toggle */}
          <button
            onClick={toggleCallVibration}
            className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center space-x-1.5 border transition-all cursor-pointer ${
              isVibratingCall
                ? 'bg-rose-50 border-rose-200 text-rose-700 font-medium'
                : 'bg-slate-50 border-slate-200 text-slate-500'
            }`}
            title="Toggle Physical Vibration Feedback during emergency call"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>{isVibratingCall ? 'Haptic On' : 'Haptic Off'}</span>
          </button>

          {/* CPR Metronome */}
          <button
            onClick={() => setCprActive(!cprActive)}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer border ${
              cprActive
                ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-200'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${cprActive ? 'fill-white' : 'text-rose-600'}`} />
            <span>{cprActive ? '110 BPM' : 'CPR Guide'}</span>
          </button>

          {/* Voice Mute */}
          <button
            onClick={() => {
              if (speechEnabled && 'speechSynthesis' in window) window.speechSynthesis.cancel();
              setSpeechEnabled(!speechEnabled);
            }}
            className="p-2 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 border border-slate-200 cursor-pointer transition-colors"
            title={speechEnabled ? 'Mute Speech' : 'Enable Speech'}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4 text-sky-700" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
          </button>
        </div>
      </div>

      {/* Bed Reservation & Ambulance Pill */}
      {activeCase && (
        <div className="bg-sky-50/60 border border-sky-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-slate-800 font-semibold">Bed Reserved (#{activeCase.id})</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-600">
            <span>Ambulance ETA: <b className="text-sky-900 font-bold">~{activeCase.eta_minutes} mins</b></span>
            <a 
              href={`tel:${activeCase.ambulance_phone}`}
              className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-medium shadow-xs"
            >
              Call
            </a>
          </div>
        </div>
      )}

      {/* CHAT MESSAGES LOG */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 min-h-[380px] max-h-[440px] overflow-y-auto space-y-3 shadow-xs">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-1.5 mb-1 px-1">
              <span className="text-[10px] text-slate-400 font-medium">
                {msg.sender === 'agent' ? `Receptionist (${targetHospital})` : 'You'}
              </span>
              <span className="text-[10px] text-slate-400">• {msg.time}</span>
            </div>

            <div
              className={`p-3.5 rounded-2xl max-w-[85%] sm:max-w-[75%] text-xs sm:text-sm leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-sky-600 text-white rounded-tr-none font-medium shadow-xs'
                  : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-tl-none'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex items-center space-x-2 text-slate-400 text-xs p-2">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-ping"></span>
            <span>Hospital receptionist replying...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* INPUT BAR WITH VOICE INPUT */}
      <div className="flex items-center space-x-2 bg-white p-2 rounded-2xl border border-slate-200 focus-within:ring-2 focus-within:ring-sky-500/20 focus-within:border-sky-500 shadow-xs">
        <button
          onClick={toggleMic}
          className={`p-2.5 rounded-xl transition-all cursor-pointer ${
            isMicListening
              ? 'bg-rose-600 text-white animate-pulse'
              : 'bg-slate-100 text-slate-600 hover:text-slate-900'
          }`}
          title="Speak to Receptionist"
        >
          {isMicListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-sky-600" />}
        </button>

        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSendMessage();
          }}
          placeholder="Speak or type symptoms..."
          className="flex-1 bg-transparent px-2 text-xs sm:text-sm text-slate-900 focus:outline-none placeholder-slate-400"
        />

        <button
          onClick={() => handleSendMessage()}
          disabled={isTyping || !inputQuery.trim()}
          className="py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold transition-colors cursor-pointer flex items-center space-x-1.5 shadow-xs"
        >
          <span>Send</span>
          <Send className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-1.5 text-xs text-slate-600">
        <button
          onClick={() => handleSendMessage("Patient is unconscious and breathing shallowly")}
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer"
        >
          Unconscious & Shallow Breath
        </button>
        <button
          onClick={() => handleSendMessage("Severe chest pressure and cold sweat")}
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer"
        >
          Chest Pressure & Cold Sweat
        </button>
        <button
          onClick={() => handleSendMessage("How far is the dispatched ambulance?")}
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-xs transition-colors cursor-pointer"
        >
          Check Ambulance ETA
        </button>
      </div>
    </div>
  );
};
