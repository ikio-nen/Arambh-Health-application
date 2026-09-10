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
    ? 'fixed bottom-16 sm:bottom-5 right-2 sm:right-5 z-50 w-[calc(100vw-1rem)] sm:w-[400px] max-w-[420px] h-[75vh] sm:h-[580px] max-h-[calc(100vh-5rem)] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200'
    : 'w-full max-w-4xl mx-auto h-[calc(100vh-140px)] min-h-[520px] bg-white border border-slate-200 rounded-2xl shadow-xs flex flex-col overflow-hidden my-4';

  return (
    <div className={containerClass} id="ai-chatbot-panel">
      {/* Healthcare Header */}
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-sky-600 flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white"></span>
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900">
                Arambh Clinical Assistant
              </h3>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                isOfflineMode 
                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                  : 'bg-sky-50 text-sky-700 border border-sky-200'
              }`}>
                {isOfflineMode ? 'L1 Offline Model' : 'Gemini 2.5 Flash'}
              </span>
            </div>
            <p className="text-xs text-slate-500">Emergency Medical Triage & First-Aid</p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleClearHistory}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
            title="Reset Conversation"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {isFloating && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
              title="Close Chat"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages Scroll View */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSpeakingThis = speakingMsgId === msg.id;

          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
            >
              <div className="flex items-center space-x-1.5 text-[10px] text-slate-400 px-1">
                <span className="font-medium text-slate-500">{isUser ? 'You' : 'Arambh Clinical AI'}</span>
                <span>•</span>
                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                {msg.source && (
                  <>
                    <span>•</span>
                    <span className="text-sky-600 uppercase font-medium">{msg.source}</span>
                  </>
                )}
              </div>

              <div
                className={`p-3.5 sm:p-4 rounded-2xl max-w-[88%] leading-relaxed ${
                  isUser
                    ? 'bg-sky-600 text-white rounded-br-xs shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-800 rounded-bl-xs'
                }`}
              >
                <div className="whitespace-pre-line text-xs sm:text-sm leading-relaxed">
                  {msg.content}
                </div>

                {!isUser && (
                  <div className="mt-3 pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(msg)}
                        className="text-slate-500 hover:text-sky-700 flex items-center space-x-1 cursor-pointer transition-colors font-medium"
                      >
                        {isSpeakingThis ? <VolumeX className="w-3.5 h-3.5 text-rose-600" /> : <Volume2 className="w-3.5 h-3.5" />}
                        <span>{isSpeakingThis ? 'Mute' : 'Listen'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyMessage(msg)}
                        className="text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer transition-colors font-medium"
                      >
                        {copiedMsgId === msg.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedMsgId === msg.id ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>

                    {onSelectConditionForIntake && (
                      <button
                        type="button"
                        onClick={() => onSelectConditionForIntake(msg.content.slice(0, 180))}
                        className="text-sky-700 hover:text-sky-800 font-semibold flex items-center space-x-1 cursor-pointer"
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
            <span className="text-[10px] text-slate-400 px-1 font-medium">Analyzing symptoms...</span>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl inline-flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce"></span>
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.2s]"></span>
              <span className="w-2 h-2 rounded-full bg-sky-600 animate-bounce [animation-delay:0.4s]"></span>
              <span className="text-xs text-slate-500 ml-1">Consulting clinical knowledge base...</span>
            </div>
          </div>
        )}

        <div ref={chatBottomRef} />
      </div>

      {/* Quick Emergency Action Chips */}
      <div className="px-4 py-2 bg-slate-50/80 border-t border-slate-200 flex items-center space-x-2 overflow-x-auto">
        <span className="text-[10px] font-semibold uppercase text-slate-400 flex-shrink-0">Quick:</span>
        {QUICK_EMERGENCY_PROMPTS.map((chip, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleSendMessage(chip.query)}
            className="text-xs px-2.5 py-1 rounded-full bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 whitespace-nowrap cursor-pointer transition-colors shadow-xs"
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
        className="p-3 bg-white border-t border-slate-200 flex items-center space-x-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask medical first-aid (e.g. 'How to help someone choking')..."
          className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
        />

        <button
          type="submit"
          disabled={isSending || !inputQuery.trim()}
          className="p-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-100 disabled:text-slate-400 text-white rounded-xl transition-colors cursor-pointer flex-shrink-0 shadow-xs"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
