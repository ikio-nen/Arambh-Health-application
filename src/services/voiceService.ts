/**
 * Robust Emergency Voice Recognition & Clinical Entity Extraction Service
 * Handles multi-browser Web Speech API nuances, auto-recovery on silence, 
 * clean speech session cycling, and resilient clinical entity parsing.
 */

import { TriageTag } from '../types';

export interface ExtractedVoiceEntities {
  name?: string;
  age?: string;
  gender?: 'Male' | 'Female' | 'Other';
  phone?: string;
  condition?: string;
  triageTag?: TriageTag;
  matchedKeywords: string[];
}

export interface VoiceListenerCallbacks {
  onStart?: () => void;
  onInterim?: (interimText: string, fullCombined: string) => void;
  onResult?: (finalText: string, entities: ExtractedVoiceEntities) => void;
  onError?: (errorMessage: string, isFatal: boolean, errorCode: string) => void;
  onEnd?: () => void;
}

export class VoiceEmergencyService {
  private static recognition: any = null;
  private static isUserIntentionallyListening = false;
  private static accumulatedTranscript = '';
  private static restartAttempts = 0;
  private static readonly MAX_RESTARTS = 12;
  private static restartTimeoutId: any = null;
  private static callbacks: VoiceListenerCallbacks = {};

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Starts speech recognition with automatic silence recovery & graceful error handling
   */
  public static async startListening(callbacks: VoiceListenerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isUserIntentionallyListening = true;
    this.restartAttempts = 0;
    this.accumulatedTranscript = '';

    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      callbacks.onError?.(
        'Speech recognition is not natively supported in this browser. Please use Chrome/Edge or 1-Tap Voice Simulation.',
        true,
        'unsupported'
      );
      this.isUserIntentionallyListening = false;
      return false;
    }

    this.initAndStart();
    return true;
  }

  private static initAndStart(): void {
    if (!this.isUserIntentionallyListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (this.recognition) {
        try {
          this.recognition.onstart = null;
          this.recognition.onresult = null;
          this.recognition.onerror = null;
          this.recognition.onend = null;
          this.recognition.abort();
        } catch {}
        this.recognition = null;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      // Allow browser language detection or default to English
      rec.lang = (typeof navigator !== 'undefined' && navigator.language) ? navigator.language : 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.restartAttempts = 0; // Reset restart attempts on successful active start
        this.callbacks.onStart?.();
      };

      rec.onresult = (event: any) => {
        this.restartAttempts = 0; // Active speech resets restart counter
        let interim = '';
        let currentBatch = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const item = event.results[i];
          if (item.isFinal) {
            currentBatch += item[0].transcript + ' ';
          } else {
            interim += item[0].transcript;
          }
        }

        if (currentBatch.trim()) {
          this.accumulatedTranscript = (this.accumulatedTranscript + ' ' + currentBatch).trim();
        }

        const fullDisplay = (this.accumulatedTranscript + (interim ? ' ' + interim : '')).trim();
        this.callbacks.onInterim?.(interim, fullDisplay);

        // Parse entities continuously so fields populate in real-time
        if (fullDisplay) {
          const entities = this.parseEmergencyEntities(fullDisplay);
          this.callbacks.onResult?.(fullDisplay, entities);
        }
      };

      rec.onerror = (event: any) => {
        const err = event.error;

        if (err === 'no-speech') {
          // Normal silence detection from browser; do not show error banner, let onend restart smoothly
          return;
        }

        if (err === 'aborted') {
          // Normal abort when user stops or restarts
          return;
        }

        if (err === 'network') {
          this.callbacks.onError?.(
            'Speech API network issue. You can use 1-Tap Voice Simulation or enter symptoms manually.',
            false,
            'network'
          );
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this.isUserIntentionallyListening = false;
          this.callbacks.onError?.(
            'Microphone access blocked. Click the microphone/lock icon in your address bar to allow access, or use 1-Tap Simulation.',
            true,
            'not-allowed'
          );
          return;
        }

        if (err === 'audio-capture') {
          this.isUserIntentionallyListening = false;
          this.callbacks.onError?.(
            'No microphone detected. Please check audio hardware or use 1-Tap Simulation.',
            true,
            'audio-capture'
          );
          return;
        }

        // Generic audio event
        console.warn('[VoiceEmergencyService] Non-fatal audio event:', err);
      };

      rec.onend = () => {
        // If user still wants to listen, seamlessly restart without dropping accumulated text
        if (this.isUserIntentionallyListening && this.restartAttempts < this.MAX_RESTARTS) {
          this.restartAttempts++;
          this.restartTimeoutId = setTimeout(() => {
            if (this.isUserIntentionallyListening) {
              try {
                this.initAndStart();
              } catch (e) {
                console.warn('[VoiceEmergencyService] Auto-restart failed:', e);
                this.isUserIntentionallyListening = false;
                this.callbacks.onEnd?.();
              }
            }
          }, 150);
        } else {
          this.isUserIntentionallyListening = false;
          this.callbacks.onEnd?.();
        }
      };

      rec.start();
      this.recognition = rec;
    } catch (e: any) {
      console.warn('[VoiceEmergencyService] Speech start exception:', e);
      this.callbacks.onError?.(
        'Speech recognition service encountered an error. You can use the 1-Tap Voice Simulation chips below.',
        false,
        'start_failed'
      );
      this.isUserIntentionallyListening = false;
      this.callbacks.onEnd?.();
    }
  }

  /**
   * Stops listening immediately and cleans up all timers and listeners
   */
  public static stopListening(): void {
    this.isUserIntentionallyListening = false;
    this.restartAttempts = this.MAX_RESTARTS;

    if (this.restartTimeoutId) {
      clearTimeout(this.restartTimeoutId);
      this.restartTimeoutId = null;
    }

    if (this.recognition) {
      try {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    this.callbacks.onEnd?.();
  }

  /**
   * Clinical regex & keyword entity extraction engine
   */
  public static parseEmergencyEntities(text: string): ExtractedVoiceEntities {
    const lower = text.toLowerCase();
    const result: ExtractedVoiceEntities = {
      matchedKeywords: [],
    };

    // 1. Extract Age
    // Handles: "45 years old", "age 52", "aged 60", "I am 34", "68 yo", "patient is 25", "Rahul 45 male"
    const ageExplicitMatch = lower.match(/(?:age\s*(?:is)?\s*|aged\s*|i am\s*|he is\s*|she is\s*|patient\s*(?:is)?\s*)?(\b\d{1,2}\b)\s*(?:years|yrs|years old|yr old|yo\b)/i) 
      || lower.match(/(?:age\s*(?:is)?\s*|aged\s*)(\b\d{1,2}\b)/i);

    if (ageExplicitMatch && ageExplicitMatch[1]) {
      const num = parseInt(ageExplicitMatch[1], 10);
      if (num >= 1 && num <= 115) {
        result.age = num.toString();
        result.matchedKeywords.push(`Age ${num}`);
      }
    } else {
      // Secondary fallback: a 2-digit number (18-99) followed or preceded by gender (e.g., "45 male", "female 32")
      const proximityMatch = lower.match(/(?:male|female|man|woman)\s+(\b\d{1,2}\b)/i) ||
                             lower.match(/(\b\d{1,2}\b)\s+(?:male|female|man|woman)/i);
      if (proximityMatch && proximityMatch[1]) {
        const num = parseInt(proximityMatch[1], 10);
        if (num >= 1 && num <= 115) {
          result.age = num.toString();
          result.matchedKeywords.push(`Age ${num}`);
        }
      }
    }

    // 2. Extract Gender
    if (/\b(female|woman|girl|mother|sister|wife|she|her)\b/i.test(lower)) {
      result.gender = 'Female';
      result.matchedKeywords.push('Female');
    } else if (/\b(male|man|boy|father|brother|husband|he|him)\b/i.test(lower)) {
      result.gender = 'Male';
      result.matchedKeywords.push('Male');
    }

    // 3. Extract Name
    // Matches: "my name is Rahul Sharma", "name is Anita", "patient name is Rohan", "this is John", "patient Rahul"
    const nameMatch = lower.match(/(?:my name is|patient(?:\'s)? name is|name is|this is|call me|patient)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    if (nameMatch && nameMatch[1]) {
      const candidate = nameMatch[1].trim();
      const blacklisted = [
        'having', 'severe', 'acute', 'chest', 'in', 'at', 'with', 'male', 'female', 
        'emergency', 'pain', 'breathing', 'blood', 'unconscious', 'fever', 'is', 'a'
      ];
      if (!blacklisted.includes(candidate.toLowerCase())) {
        const formatted = candidate.replace(/\b\w/g, l => l.toUpperCase());
        result.name = formatted;
        result.matchedKeywords.push(`Name: ${formatted}`);
      }
    }

    // 4. Extract Contact / Phone Number (Handles Indian 10-digit mobile patterns)
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/\s+/g, '');
      result.matchedKeywords.push(`Phone: ${result.phone}`);
    }

    // 5. Triage Category & Symptoms Detection
    let cardiacScore = 0;
    let traumaScore = 0;
    let respiratoryScore = 0;

    const cardiacTerms = [
      'chest pain', 'chest tightness', 'heart', 'cardiac', 'arm pain', 'jaw pain',
      'left arm', 'palpitations', 'heart attack', 'angina', 'crushing pain', 'cold sweat',
      'heaviness in chest', 'chest pressure'
    ];
    const traumaTerms = [
      'bleed', 'bleeding', 'blood', 'fracture', 'broken', 'accident', 'cut', 'fall',
      'wound', 'head injury', 'trauma', 'concussion', 'laceration', 'crash', 'stab',
      'hit by', 'hemorrhage', 'bike fall'
    ];
    const respiratoryTerms = [
      'breath', 'breathing', 'asthma', 'choking', 'wheezing', 'gasping', 'shortness of breath',
      'suffocating', 'inhaler', 'oxygen', 'airway', 'cannot breathe', 'gasp'
    ];

    cardiacTerms.forEach(term => {
      if (lower.includes(term)) {
        cardiacScore += 2;
        if (!result.matchedKeywords.includes(term)) result.matchedKeywords.push(term);
      }
    });

    traumaTerms.forEach(term => {
      if (lower.includes(term)) {
        traumaScore += 2;
        if (!result.matchedKeywords.includes(term)) result.matchedKeywords.push(term);
      }
    });

    respiratoryTerms.forEach(term => {
      if (lower.includes(term)) {
        respiratoryScore += 2;
        if (!result.matchedKeywords.includes(term)) result.matchedKeywords.push(term);
      }
    });

    if (cardiacScore > 0 || traumaScore > 0 || respiratoryScore > 0) {
      if (cardiacScore >= traumaScore && cardiacScore >= respiratoryScore) {
        result.triageTag = 'cardiac';
      } else if (traumaScore >= cardiacScore && traumaScore >= respiratoryScore) {
        result.triageTag = 'trauma';
      } else {
        result.triageTag = 'respiratory';
      }
    }

    result.condition = text;
    return result;
  }
}

