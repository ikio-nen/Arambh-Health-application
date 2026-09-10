/**
 * Robust Emergency Voice Recognition & Clinical Entity Extraction Service
 * Handles multi-browser Web Speech API nuances, auto-recovery on silence, 
 * permission priming, and regex entity parsing.
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
  private static maxRestarts = 5;
  private static callbacks: VoiceListenerCallbacks = {};

  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  }

  /**
   * Checks or requests microphone hardware access
   */
  public static async requestMicPermission(): Promise<{ granted: boolean; error?: string }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return { granted: true }; // Fallback to browser's default prompt
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop tracks immediately to avoid keeping mic hot before recognition starts
      stream.getTracks().forEach(track => track.stop());
      return { granted: true };
    } catch (err: any) {
      const name = err.name || '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        return { 
          granted: false, 
          error: 'Microphone permission blocked. Please click the lock or camera icon in your address bar to allow microphone access.' 
        };
      }
      if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        return { 
          granted: false, 
          error: 'No microphone hardware detected on this device.' 
        };
      }
      return { granted: false, error: err.message || 'Could not initialize microphone.' };
    }
  }

  /**
   * Starts speech recognition with automatic pause/silence recovery
   */
  public static async startListening(callbacks: VoiceListenerCallbacks): Promise<boolean> {
    this.callbacks = callbacks;
    this.isUserIntentionallyListening = true;
    this.restartAttempts = 0;
    this.accumulatedTranscript = '';

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      callbacks.onError?.('Speech recognition is not supported in this browser. Please use Chrome, Edge, or 1-Tap Presets.', true, 'unsupported');
      return false;
    }

    // Attempt permission request first for clean UX
    const perm = await this.requestMicPermission();
    if (!perm.granted) {
      callbacks.onError?.(perm.error || 'Microphone access denied', true, 'not-allowed');
      this.isUserIntentionallyListening = false;
      return false;
    }

    this.initAndStart();
    return true;
  }

  private static initAndStart(): void {
    if (!this.isUserIntentionallyListening) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    try {
      if (this.recognition) {
        try {
          this.recognition.abort();
        } catch {}
        this.recognition = null;
      }

      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'en-US';
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        this.callbacks.onStart?.();
      };

      rec.onresult = (event: any) => {
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
        console.warn('[VoiceEmergencyService] Speech event error:', err);

        if (err === 'no-speech') {
          // Non-fatal: Chrome reports no speech after a short quiet period
          // If the user still wants to listen, we let onend handle the clean restart
          return;
        }

        if (err === 'network') {
          this.callbacks.onError?.(
            'Speech API requires an internet connection in Chrome. You can use 1-Tap Voice Simulation or type manually.',
            false,
            'network'
          );
          return;
        }

        if (err === 'not-allowed' || err === 'service-not-allowed') {
          this.isUserIntentionallyListening = false;
          this.callbacks.onError?.(
            'Microphone access is not allowed. Please grant microphone permission in your browser.',
            true,
            'not-allowed'
          );
          return;
        }

        if (err === 'audio-capture') {
          this.isUserIntentionallyListening = false;
          this.callbacks.onError?.('No microphone detected. Please check audio input hardware.', true, 'audio-capture');
          return;
        }

        // Generic non-fatal error
        this.callbacks.onError?.(`Audio warning: ${err}`, false, err);
      };

      rec.onend = () => {
        // If the user still intended to listen and hasn't exceeded max restarts, auto-restart!
        if (this.isUserIntentionallyListening && this.restartAttempts < this.maxRestarts) {
          this.restartAttempts++;
          setTimeout(() => {
            if (this.isUserIntentionallyListening) {
              try {
                this.initAndStart();
              } catch (e) {
                console.warn('Restart failed:', e);
              }
            }
          }, 250);
        } else {
          this.isUserIntentionallyListening = false;
          this.callbacks.onEnd?.();
        }
      };

      rec.start();
      this.recognition = rec;
    } catch (e: any) {
      console.warn('Failed to start speech recognition:', e);
      this.callbacks.onError?.('Could not activate speech recognition. Try restarting browser or use 1-Tap Presets.', false, 'start_failed');
    }
  }

  /**
   * Stops listening immediately
   */
  public static stopListening(): void {
    this.isUserIntentionallyListening = false;
    this.restartAttempts = this.maxRestarts;
    if (this.recognition) {
      try {
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
    // Matches: "45 years old", "age 52", "aged 60", "I am 34", "68 yo", "patient is 25"
    const ageMatch = lower.match(/(?:age\s*(?:is)?\s*|aged\s*|i am\s*|he is\s*|she is\s*|patient\s*(?:is)?\s*)?(\b\d{1,2}\b)\s*(?:years|yrs|years old|yr old|yo\b)/i) 
      || lower.match(/(?:age\s*(?:is)?\s*|aged\s*)(\b\d{1,2}\b)/i);

    if (ageMatch && ageMatch[1]) {
      const num = parseInt(ageMatch[1], 10);
      if (num >= 1 && num <= 115) {
        result.age = num.toString();
        result.matchedKeywords.push(`Age ${num}`);
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
    // Matches: "my name is Rahul Sharma", "name is Anita", "patient name is Rohan", "this is John"
    const nameMatch = lower.match(/(?:my name is|patient(?:\'s)? name is|name is|this is|call me)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/i);
    if (nameMatch && nameMatch[1]) {
      const candidate = nameMatch[1].trim();
      const blacklisted = ['having', 'severe', 'acute', 'chest', 'in', 'at', 'with', 'male', 'female', 'emergency'];
      if (!blacklisted.includes(candidate.toLowerCase())) {
        // Capitalize words
        const formatted = candidate.replace(/\b\w/g, l => l.toUpperCase());
        result.name = formatted;
        result.matchedKeywords.push(`Name: ${formatted}`);
      }
    }

    // 4. Extract Indian Phone Number
    const phoneMatch = text.match(/(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/);
    if (phoneMatch) {
      result.phone = phoneMatch[0].replace(/\s+/g, '');
      result.matchedKeywords.push(`Phone`);
    }

    // 5. Triage Category & Symptoms Detection
    let cardiacScore = 0;
    let traumaScore = 0;
    let respiratoryScore = 0;

    const cardiacTerms = [
      'chest pain', 'chest tightness', 'heart', 'cardiac', 'arm pain', 'jaw pain',
      'left arm', 'palpitations', 'heart attack', 'angina', 'crushing pain', 'cold sweat'
    ];
    const traumaTerms = [
      'bleed', 'bleeding', 'blood', 'fracture', 'broken', 'accident', 'cut', 'fall',
      'wound', 'head injury', 'trauma', 'concussion', 'laceration', 'crash', 'stab'
    ];
    const respiratoryTerms = [
      'breath', 'breathing', 'asthma', 'choking', 'wheezing', 'gasping', 'shortness of breath',
      'suffocating', 'inhaler', 'oxygen', 'airway'
    ];

    cardiacTerms.forEach(term => {
      if (lower.includes(term)) {
        cardiacScore += 2;
        result.matchedKeywords.push(term);
      }
    });

    traumaTerms.forEach(term => {
      if (lower.includes(term)) {
        traumaScore += 2;
        result.matchedKeywords.push(term);
      }
    });

    respiratoryTerms.forEach(term => {
      if (lower.includes(term)) {
        respiratoryScore += 2;
        result.matchedKeywords.push(term);
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
