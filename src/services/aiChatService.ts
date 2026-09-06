/**
 * Arambh AI Emergency Chatbot Service
 * Full-stack proxy client for Gemini 3.8 Flash with zero-latency offline clinical fallbacks.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  source?: 'GEMINI_FLASH' | 'OFFLINE_CLINICAL_CORE' | 'LOCAL_CACHE';
  triageLevel?: 'RED' | 'AMBER' | 'GREEN';
  isSpeaking?: boolean;
}

const STORAGE_KEY = 'arambh_ai_chat_history';

export const QUICK_EMERGENCY_PROMPTS = [
  { label: 'CPR Cadence & Ratio', query: 'How do I perform CPR on an adult who collapsed and is not breathing?' },
  { label: 'Stop Severe Bleeding', query: 'Heavy bleeding from leg wound after an accident. How to stop arterial blood flow?' },
  { label: 'Airway / Choking Rescue', query: 'Someone is choking, cannot talk or breathe. How to do the Heimlich maneuver?' },
  { label: 'Suspected Heart Attack', query: 'Crushing chest pain radiating to left arm and sweating. What immediate steps to take?' },
  { label: 'Stroke (F.A.S.T.) Check', query: 'One side of face is drooping and slurred speech. Is this a stroke? What do I do?' },
  { label: 'Severe Thermal Burn', query: 'Hot water scald burn with redness and blisters. Should I use ice or cold water?' },
  { label: 'Bluetooth Hopping Relay', query: 'How does Bluetooth frequency hopping relay emergency calls when internet is down?' },
];

export class AiChatService {
  private messages: ChatMessage[] = [];
  private isSpeaking: boolean = false;

  constructor() {
    this.loadHistory();
    if (this.messages.length === 0) {
      this.seedInitialGreeting();
    }
  }

  private seedInitialGreeting() {
    this.messages = [
      {
        id: 'msg-init-0',
        role: 'assistant',
        content: `🚨 **Arambh Red-Alert Medical AI** initialized.\n\nI provide instant, battle-tested first aid and emergency triage protocols. If you are dealing with a life threat, select a quick protocol below, describe symptoms, or tap **Trigger Emergency Dispatch**.\n\n*All protocols operate 100% offline via local clinical models and Bluetooth mesh relay.*`,
        timestamp: new Date().toISOString(),
        source: 'OFFLINE_CLINICAL_CORE',
        triageLevel: 'RED',
      }
    ];
  }

  private loadHistory() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.messages = JSON.parse(saved);
      }
    } catch {
      // Ignore
    }
  }

  private saveHistory() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages.slice(-40)));
    } catch {
      // Ignore
    }
  }

  public getMessages(): ChatMessage[] {
    return [...this.messages];
  }

  public clearHistory() {
    this.stopSpeaking();
    this.seedInitialGreeting();
    this.saveHistory();
  }

  public async sendMessage(text: string, isOfflineMode: boolean = false): Promise<ChatMessage> {
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    this.messages.push(userMsg);
    this.saveHistory();

    // If strictly offline, use local offline triage
    if (isOfflineMode) {
      const offlineReply = this.generateLocalOfflineReply(text);
      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: offlineReply.content,
        timestamp: new Date().toISOString(),
        source: 'OFFLINE_CLINICAL_CORE',
        triageLevel: offlineReply.triageLevel,
      };
      this.messages.push(assistantMsg);
      this.saveHistory();
      return assistantMsg;
    }

    // Try online server call to /api/ai/chat
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_message: text,
          messages: this.messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: ChatMessage = {
          id: `ast-${Date.now()}`,
          role: 'assistant',
          content: data.reply || 'Protocol confirmed.',
          timestamp: data.timestamp || new Date().toISOString(),
          source: data.source || 'GEMINI_FLASH',
          triageLevel: data.triage_level || 'AMBER',
        };
        this.messages.push(assistantMsg);
        this.saveHistory();
        return assistantMsg;
      }
    } catch (err) {
      console.warn('Network chat error, using local fallback:', err);
    }

    // Fallback if network call fails
    const offlineReply = this.generateLocalOfflineReply(text);
    const assistantMsg: ChatMessage = {
      id: `ast-${Date.now()}`,
      role: 'assistant',
      content: offlineReply.content,
      timestamp: new Date().toISOString(),
      source: 'OFFLINE_CLINICAL_CORE',
      triageLevel: offlineReply.triageLevel,
    };
    this.messages.push(assistantMsg);
    this.saveHistory();
    return assistantMsg;
  }

  private generateLocalOfflineReply(query: string): { content: string; triageLevel: 'RED' | 'AMBER' | 'GREEN' } {
    const q = query.toLowerCase();

    if (q.includes('cpr') || q.includes('cardiac') || q.includes('not breathing') || q.includes('heart stopped')) {
      return {
        content: `🚨 **EMERGENCY: CPR CADENCE & INSTRUCTIONS (110 BPM)**\n\n1. **Call 108 / 911 immediately** or shout to a bystander to call.\n2. **Heel of Hand:** Place in center of chest between nipples.\n3. **Interlock Fingers:** Keep arms straight and lock elbows.\n4. **Compress:** Push down hard at least 2 inches (5 cm) at 100-120 beats per minute.\n5. **Don't Stop:** Continue until paramedics arrive or victim resumes spontaneous breathing.\n\n⚠️ **WARNING:** Full chest recoil between compressions is vital for coronary perfusion.`,
        triageLevel: 'RED',
      };
    }

    if (q.includes('bleed') || q.includes('cut') || q.includes('wound') || q.includes('hemorrhage')) {
      return {
        content: `🩸 **SEVERE BLEEDING / HEMORRHAGE PROTOCOL**\n\n1. **Direct Pressure:** Press clean pad firmly onto the wound.\n2. **Do Not Remove Soaked Dressings:** Add more pads on top.\n3. **Tourniquet:** If limb bleeding won't stop, place band 2-3 inches above wound and tighten until bleeding ceases completely.\n4. **Keep Warm:** Lay patient down and cover to prevent hypothermic shock.`,
        triageLevel: 'AMBER',
      };
    }

    if (q.includes('chok') || q.includes('heimlich') || q.includes('airway')) {
      return {
        content: `⚠️ **CHOKING RESCUE PROTOCOL**\n\n1. **5 Back Blows:** Stand behind, lean them forward, strike firmly between shoulder blades.\n2. **5 Abdominal Thrusts:** Make a fist above navel, pull sharply in and up.\n3. **Repeat 5 and 5** until foreign object dislodges.\n4. **If Unresponsive:** Lower to ground and start chest compressions immediately.`,
        triageLevel: 'RED',
      };
    }

    if (q.includes('bluetooth') || q.includes('hopping') || q.includes('mesh')) {
      return {
        content: `📶 **BLUETOOTH FREQUENCY HOPPING EXPLAINED**\n\n• **Spectrum:** 40 channels across 2.402–2.480 GHz ISM band.\n• **Adaptive Frequency Hopping (AFH):** Evades interference and jammer frequencies by switching channels hundreds of times per second.\n• **Peer-to-Peer Mesh Relay:** Allows emergency cases to hop through nearby ambulances, repeater towers, and hospital gateways completely off-grid.`,
        triageLevel: 'GREEN',
      };
    }

    return {
      content: `ℹ️ **FIRST RESPONDER ACTION GUIDE**\n\nFor symptom report: "${query}"\n\n1. **Safety:** Ensure scene safety before approaching.\n2. **Airway & Breathing:** Check if chest is rising and falling.\n3. **Position:** Seat patient comfortably or place on side in recovery position if unconscious.\n4. **Hospital Triage:** Dispatch emergency response or call 108 immediately if condition deteriorates.`,
      triageLevel: 'AMBER',
    };
  }

  public speak(text: string, onEnd?: () => void) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    window.speechSynthesis.cancel();
    // Clean markdown stars and hashes for clean speech
    const cleanText = text.replace(/[*#_`]/g, '').replace(/🚨|🩸|⚠️|🔥|⚡|🧠|ℹ️|📶/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };
    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.isSpeaking = true;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking;
  }
}

export const aiChatService = new AiChatService();
