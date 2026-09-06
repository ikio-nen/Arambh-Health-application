import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Send, Sparkles, Volume2, VolumeX, Copy, Check, 
  Trash2, AlertTriangle, Heart, ShieldAlert, Radio, X, 
  Maximize2, Minimize2, ExternalLink, RefreshCw
} from 'lucide-react';
import { aiChatService, ChatMessage, QUICK_EMERGENCY_PROMPTS } from '../services/aiChatService';

interface AiChatbotProps {
  isOfflineMode: boolean;
  isFloating?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
  onSelectConditionForIntake?: (conditionText: string) => void;
}

export const AiChatbot: React.FC<AiChatbotProps> = ({
  isOfflineMode,
  isFloating = false,
  isOpen = true,
  onClose,
  onSelectConditionForIntake,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>(aiChatService.getMessages());
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (textToSend?: string) => {
    const q = textToSend || inputQuery;
    if (!q.trim() || isSending) return;

    setIsSending(true);
    setInputQuery('');

    try {
      await aiChatService.sendMessage(q, isOfflineMode);
      setMessages(aiChatService.getMessages());
    } catch (err) {
      console.warn('Chat error:', err);
    } finally {
      setIsSending(false);
    }
  };

  const handleSpeakMessage = (msg: ChatMessage) => {
    if (speakingMsgId === msg.id) {
      aiChatService.stopSpeaking();
      setSpeakingMsgId(null);
      return;
    }

    aiChatService.stopSpeaking();
    setSpeakingMsgId(msg.id);
    aiChatService.speak(msg.content, () => {
      setSpeakingMsgId(null);
    });
  };

  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.content);
    setCopiedMsgId(msg.id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleClearHistory = () => {
    aiChatService.clearHistory();
    setMessages(aiChatService.getMessages());
    setSpeakingMsgId(null);
  };

  if (isFloating && !isOpen) {
    return null;
  }

  const containerClass = isFloating
    ? 'fixed bottom-5 right-5 z-50 w-full max-w-[420px] h-[580px] bg-black border-2 border-red-600/80 rounded-2xl shadow-2xl shadow-red-950/80 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200'
    : 'w-full max-w-4xl mx-auto h-[calc(100vh-140px)] min-h-[600px] bg-black border border-neutral-900 rounded-2xl flex flex-col overflow-hidden my-4';

  return (
    <div className={containerClass} id="ai-chatbot-panel">
      {/* Black & Red Header */}
      <div className="px-5 py-4 bg-neutral-950 border-b border-red-950 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/60">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 ring-2 ring-black"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                Arambh Red-Alert AI
              </h3>
              <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase ${
                isOfflineMode 
                  ? 'bg-amber-950/40 text-amber-400 border border-amber-800/40' 
                  : 'bg-red-950/40 text-red-400 border border-red-800/40'
              }`}>
                {isOfflineMode ? 'L1 Offline Model' : 'Gemini 3.8 Flash'}
              </span>
            </div>
            <p className="text-[10px] font-mono text-neutral-400">Emergency Medical Triage & First-Aid</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 transition-colors cursor-pointer"
            title="Reset Conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-sans">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeakingThis = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center space-x-1.5 text-[9px] font-mono text-neutral-500 px-1">
                <span>{isUser ? 'YOU' : 'ARAMBH CLINICAL AI'}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.source && (
                  <>
                    <span>•</span>
                    <span className="text-red-400 uppercase">{msg.source}</span>
                  </>
                )}
              </div>

              <div
                className={`p-4 rounded-xl max-w-[90%] leading-relaxed ${
                  isUser
                    ? 'bg-red-600 text-white rounded-br-none shadow-md shadow-red-950/80'
                    : 'bg-neutral-950 border border-neutral-900 text-neutral-200 rounded-bl-none'
                }`}
              >
                <div className="whitespace-pre-line text-[13px] leading-relaxed">
                  {msg.content}
                </div>

                {!isUser && (
                  <div className="mt-3 pt-2.5 border-t border-neutral-900 flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(msg)}
                        className="text-neutral-400 hover:text-red-400 flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        {isSpeakingThis ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>{isSpeakingThis ? 'Mute' : 'Listen'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg)}
                        className="text-neutral-400 hover:text-white flex items-center space-x-1 cursor-pointer transition-colors"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {onSelectConditionForIntake && (
                      <button
                        type="button"
                        onClick={() => onSelectConditionForIntake(msg.content.slice(0, 180))}
                        className="text-red-400 hover:text-red-300 font-bold flex items-center space-x-1 cursor-pointer"
                        title="Load into Emergency Intake"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Use in Intake</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {isSending && (
          <div className="flex flex-col items-start space-y-1">
            <span className="text-[9px] font-mono text-neutral-500 px-1">ANALYZING SYMPTOMS...</span>
            <div className="bg-neutral-950 border border-neutral-900 p-3 rounded-xl inline-flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs font-mono text-neutral-400 ml-1">Consulting clinical knowledge base...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Quick Emergency Action Chips */}
      <div className="px-4 py-2 bg-neutral-950/80 border-t border-neutral-900 flex items-center space-x-2 overflow-x-auto">
        <span className="text-[9px] font-mono uppercase text-neutral-500 flex-shrink-0">QUICK:</span>
        {QUICK_EMERGENCY_PROMPTS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(chip.query)}
            className="text-[10px] font-mono px-2.5 py-1 rounded-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white whitespace-nowrap cursor-pointer transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>

      {/* Input Message Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="p-3 bg-neutral-950 border-t border-neutral-900 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask emergency protocol (e.g. 'How to stop arterial bleeding')..."
          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-lg px-3.5 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600"
        />

        <button
          type="submit"
          disabled={isSending || !inputQuery.trim()}
          className="p-2.5 bg-red-600 hover:bg-red-500 disabled:bg-neutral-900 disabled:text-neutral-600 text-white rounded-lg transition-colors cursor-pointer flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
