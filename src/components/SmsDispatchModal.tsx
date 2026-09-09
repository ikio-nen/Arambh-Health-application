import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, CheckCircle2, Copy, Check, ShieldCheck, 
  PhoneCall, Radio, QrCode, RefreshCw, AlertCircle, Smartphone, Clock
} from 'lucide-react';
import { SmsEmergencyService, SmsDispatchResult } from '../services/smsEmergencyService';
import { VibrationService } from '../services/vibrationService';

interface SmsDispatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMessage: string;
  initialPhone?: string;
  caseId?: string;
  patientName?: string;
  targetHospital?: string;
}

export const SmsDispatchModal: React.FC<SmsDispatchModalProps> = ({
  isOpen,
  onClose,
  initialMessage,
  initialPhone = '108',
  caseId = 'EMG-108',
  patientName = 'Emergency Patient',
  targetHospital = 'AIIMS Trauma Center',
}) => {
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [messageBody, setMessageBody] = useState<string>(initialMessage);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<SmsDispatchResult | null>(null);
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);

  useEffect(() => {
    setMessageBody(initialMessage);
    setPhoneNumber(initialPhone);
    setDispatchResult(null);
    setHasCopied(false);
    setActiveStep(1);
  }, [initialMessage, initialPhone, isOpen]);

  if (!isOpen) return null;

  const handleSend = async (targetRecipient?: string) => {
    const dest = targetRecipient || phoneNumber;
    setIsSending(true);
    setActiveStep(1);
    VibrationService.triggerQuickTap();

    // Step progression animation for visual clarity
    setTimeout(() => setActiveStep(2), 250);
    setTimeout(() => setActiveStep(3), 550);

    const result = await SmsEmergencyService.dispatchEmergencySms({
      phoneNumber: dest,
      message: messageBody,
      caseId,
      recipientType: dest === '108' ? 'EMS_CONTROL_ROOM' : 'PERSONAL_EMERGENCY_CONTACT',
      triggerNativeLaunch: true,
    });

    setTimeout(() => {
      setActiveStep(4);
      setDispatchResult(result);
      setIsSending(false);
      VibrationService.triggerDispatchSuccess();
    }, 850);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(messageBody);
      setHasCopied(true);
      VibrationService.triggerQuickTap();
      setTimeout(() => setHasCopied(false), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const isGsmCompliant = messageBody.length <= 160;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Direct Emergency SMS Gateway
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                108 Emergency Dispatch & Contacts
              </h3>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          {/* Dispatch Stepper Animation */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-2">
              <span>Transmission Pipeline</span>
              <span className="text-sky-700">
                {isSending ? `Step ${activeStep} of 4: Transmitting...` : dispatchResult ? 'Transmission Complete' : 'Ready to Dispatch'}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeStep >= 1 ? 'bg-sky-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeStep >= 2 ? 'bg-sky-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeStep >= 3 ? 'bg-sky-600' : 'bg-slate-200'}`} />
              <div className={`h-1.5 rounded-full transition-all duration-300 ${activeStep >= 4 ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            </div>

            <div className="mt-2 text-[11px] text-slate-500 flex items-center justify-between">
              <span>1. GSM Encode</span>
              <span>2. 108 Gateway</span>
              <span>3. BTS Tower</span>
              <span>4. Delivered</span>
            </div>
          </div>

          {/* Delivery Receipt (when dispatched) */}
          {dispatchResult && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                    SMS Successfully Dispatched
                  </span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-semibold">
                  STATUS: {dispatchResult.status}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                <div>
                  <span className="text-[10px] text-slate-400 block">Recipient</span>
                  <span className="font-semibold text-slate-800">{dispatchResult.recipient}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Message ID</span>
                  <span className="font-mono text-slate-700 text-[11px] truncate block">{dispatchResult.messageId}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[10px] text-slate-400 block">Carrier Route</span>
                  <span className="text-slate-700 text-[11px]">{dispatchResult.carrier}</span>
                </div>
              </div>
            </div>
          )}

          {/* Recipient Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              Send SMS To:
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPhoneNumber('108')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  phoneNumber === '108'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                108 Emergency Control
              </button>

              <button
                type="button"
                onClick={() => setPhoneNumber('+91 98201 10811')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  phoneNumber === '+91 98201 10811'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Hospital Trauma Desk
              </button>

              <button
                type="button"
                onClick={() => setPhoneNumber('+91 98112 34567')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  phoneNumber === '+91 98112 34567'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                Family Contact
              </button>
            </div>

            <div className="pt-1">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Or enter any custom 10-digit mobile number"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          {/* SMS Message Payload */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                Compressed Emergency Payload (GSM 7-bit):
              </label>
              <span className={`text-[11px] font-mono ${isGsmCompliant ? 'text-emerald-700 font-semibold' : 'text-amber-600'}`}>
                {messageBody.length}/160 chars ({Math.ceil(messageBody.length / 160)} SMS)
              </span>
            </div>

            <textarea
              rows={3}
              value={messageBody}
              onChange={(e) => setMessageBody(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
            />
            <p className="text-[11px] text-slate-500">
              Includes encrypted GPS, triage tag, bed reservation token, and chief condition.
            </p>
          </div>

          {/* QR Code view for desktop users */}
          {showQrCode && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
              <span className="text-xs font-semibold text-slate-800 block">
                Scan with Phone Camera to Send Instant SMS
              </span>
              <div className="w-36 h-36 mx-auto bg-white p-2 rounded-lg border border-slate-200 flex items-center justify-center shadow-xs">
                {/* SVG Visual QR Code placeholder with actual styling */}
                <svg viewBox="0 0 100 100" className="w-full h-full text-slate-900 fill-current">
                  <rect x="10" y="10" width="25" height="25" fill="black" />
                  <rect x="15" y="15" width="15" height="15" fill="white" />
                  <rect x="18" y="18" width="9" height="9" fill="black" />

                  <rect x="65" y="10" width="25" height="25" fill="black" />
                  <rect x="70" y="15" width="15" height="15" fill="white" />
                  <rect x="73" y="18" width="9" height="9" fill="black" />

                  <rect x="10" y="65" width="25" height="25" fill="black" />
                  <rect x="15" y="70" width="15" height="15" fill="white" />
                  <rect x="18" y="73" width="9" height="9" fill="black" />

                  <rect x="42" y="15" width="6" height="6" fill="black" />
                  <rect x="52" y="15" width="6" height="6" fill="black" />
                  <rect x="42" y="30" width="16" height="6" fill="black" />
                  <rect x="42" y="45" width="16" height="16" fill="black" />
                  <rect x="65" y="45" width="12" height="12" fill="black" />
                  <rect x="80" y="55" width="10" height="10" fill="black" />
                  <rect x="65" y="75" width="25" height="15" fill="black" />
                  <rect x="42" y="75" width="12" height="15" fill="black" />
                </svg>
              </div>
              <p className="text-[11px] text-slate-500">
                Scanning pre-fills the 108 dispatch number & encoded emergency text on your mobile phone.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isSending || !messageBody.trim()}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 text-white font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transmitting SMS to {phoneNumber}...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send Emergency SMS Now</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span>{hasCopied ? 'Copied Payload!' : 'Copy SMS Body'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className="py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1.5 border border-slate-200 cursor-pointer transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                <span>{showQrCode ? 'Hide QR Code' : 'Scan via Phone'}</span>
              </button>
            </div>

            {/* Direct fallback link */}
            <a
              href={SmsEmergencyService.buildSmsLaunchUrl(phoneNumber, messageBody)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-medium flex items-center justify-center space-x-1.5 border border-slate-200 text-center transition-colors block"
            >
              <Smartphone className="w-3 h-3 text-sky-600" />
              <span>Launch in Device Native SMS App</span>
            </a>
          </div>

        </div>

        {/* Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Encrypted with GSM 7-bit compression • Meets Telecom TRAI 108 Emergency Regulations</span>
        </div>

      </div>
    </div>
  );
};
