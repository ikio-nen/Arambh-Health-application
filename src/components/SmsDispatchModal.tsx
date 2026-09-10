import React, { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, CheckCircle2, Copy, Check, ShieldCheck, 
  PhoneCall, Radio, QrCode, RefreshCw, AlertCircle, Smartphone, Clock,
  Phone, Share2, AlertTriangle, ExternalLink
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
  initialPhone = '+91 98201 10811',
  caseId = 'EMG-108',
  patientName = 'Emergency Patient',
  targetHospital = 'AIIMS Trauma Center',
}) => {
  // Default to standard 10-digit mobile to prevent telecom shortcode carrier charge warnings
  const [phoneNumber, setPhoneNumber] = useState<string>(initialPhone);
  const [messageBody, setMessageBody] = useState<string>(initialMessage);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [dispatchResult, setDispatchResult] = useState<SmsDispatchResult | null>(null);
  const [hasCopied, setHasCopied] = useState<boolean>(false);
  const [activeStep, setActiveStep] = useState<number>(1);
  const [showQrCode, setShowQrCode] = useState<boolean>(false);

  useEffect(() => {
    setMessageBody(initialMessage);
    setPhoneNumber(initialPhone || '+91 98201 10811');
    setDispatchResult(null);
    setHasCopied(false);
    setActiveStep(1);
  }, [initialMessage, initialPhone, isOpen]);

  if (!isOpen) return null;

  const isShortcode108 = phoneNumber.trim() === '108';

  // Decode message payload for rich WhatsApp & Human readable share
  const decoded = SmsEmergencyService.decodeEmergencySms(messageBody);
  const humanReadableText = SmsEmergencyService.formatHumanReadableEmergencyAlert({
    lat: decoded?.lat || 28.6139,
    long: decoded?.long || 77.2090,
    patientName: patientName || 'Emergency Patient',
    condition: decoded?.condition || 'Emergency Fast Admit',
    bedToken: decoded?.bedToken || 'BED-RES-108',
    targetHospital: targetHospital || decoded?.targetHospital || 'Metro Trauma Center',
  });

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

  const handleWhatsAppDispatch = () => {
    VibrationService.triggerQuickTap();
    const waUrl = SmsEmergencyService.buildWhatsAppLaunchUrl(
      phoneNumber !== '108' ? phoneNumber : undefined,
      humanReadableText
    );
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleWebShare = async () => {
    VibrationService.triggerQuickTap();
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `EMERGENCY SOS - ${patientName}`,
          text: humanReadableText,
        });
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      handleCopy();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(humanReadableText);
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150 my-6">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Emergency Dispatch Gateway
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                SMS, WhatsApp & 108 Calling
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

        <div className="p-4 sm:p-6 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* CRUCIAL USER HELP: WHY 108 SAYS CARRIER CHARGES OR PREMIUM SMS FAILED */}
          <div className="p-3.5 bg-amber-50/90 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-900">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-bold text-amber-950 block">
                  Seeing "Premium SMS Failed" or "Carrier charges" on Android?
                </strong>
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  Android classifies 3-digit numbers (like <strong>108</strong>) as potential premium shortcodes and blocks text messages by default. In India, 108 is also primarily a <strong>Voice Call Helpline</strong>.
                </p>
                <div className="p-2 rounded-lg bg-amber-100/70 border border-amber-200 text-[10.5px] text-amber-950 space-y-0.5">
                  <p><strong>Option 1 (Instant):</strong> Tap <strong>10-Digit Gateway (+91 98201 10811)</strong> below — standard 10-digit numbers are never blocked by Android.</p>
                  <p><strong>Option 2 (One-Time Fix):</strong> On the Android "Premium SMS Failed" popup, tap <strong>Settings → Special app access → Premium SMS access → Always allow</strong>.</p>
                  <p><strong>Option 3 (Voice):</strong> Emergency voice calls to 108 are 100% free and have zero SMS restrictions.</p>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 pt-0.5">
                  <a
                    href="tel:108"
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Free Voice Call 108 (Toll-Free)</span>
                  </a>
                  <button
                    type="button"
                    onClick={handleWhatsAppDispatch}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Send via WhatsApp (Free)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* TWO PRIMARY ZERO-CHARGE QUICK ACTIONS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <a
              href="tel:108"
              className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl flex items-center space-x-3 transition-colors text-emerald-900 shadow-xs"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <PhoneCall className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider block">Recommended</span>
                <span className="text-xs font-bold block">Toll-Free Call 108</span>
                <span className="text-[10px] text-emerald-700 font-medium">100% Free on all carriers</span>
              </div>
            </a>

            <button
              type="button"
              onClick={handleWhatsAppDispatch}
              className="p-3 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-xl flex items-center space-x-3 transition-colors text-teal-900 shadow-xs text-left cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Send className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-teal-700 tracking-wider block">Data / Wi-Fi</span>
                <span className="text-xs font-bold block">WhatsApp SOS Alert</span>
                <span className="text-[10px] text-teal-700 font-medium">Sends live GPS + Bed Token</span>
              </div>
            </button>
          </div>

          {/* Recipient Selection for SMS */}
          <div className="space-y-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-800">
                Or Send Standard SMS To:
              </label>
              <span className="text-[10px] text-slate-500">
                (Choose 10-digit number to avoid carrier warnings)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPhoneNumber('+91 98201 10811')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  phoneNumber === '+91 98201 10811'
                    ? 'bg-rose-50 border-rose-400 ring-1 ring-rose-400'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-rose-700 block">10-Digit Gateway</span>
                <span className="text-xs font-bold text-slate-900 block">Trauma Cell</span>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">+91 98201 10811</span>
                <span className="text-[9px] text-emerald-600 font-medium mt-1 block">✔ Standard SMS pack</span>
              </button>

              <button
                type="button"
                onClick={() => setPhoneNumber('+91 98112 34567')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  phoneNumber === '+91 98112 34567'
                    ? 'bg-sky-50 border-sky-400 ring-1 ring-sky-400'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-sky-700 block">Emergency SOS</span>
                <span className="text-xs font-bold text-slate-900 block">Family Contact</span>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">+91 98112 34567</span>
                <span className="text-[9px] text-emerald-600 font-medium mt-1 block">✔ Regular Mobile</span>
              </button>

              <button
                type="button"
                onClick={() => setPhoneNumber('108')}
                className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                  phoneNumber === '108'
                    ? 'bg-amber-50 border-amber-400 ring-1 ring-amber-400'
                    : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-amber-700 block">Voice Shortcode</span>
                <span className="text-xs font-bold text-slate-900 block">108 Hotline</span>
                <span className="text-[10px] font-mono text-slate-500 block mt-0.5">108</span>
                <span className="text-[9px] text-amber-600 font-medium mt-1 block">⚠️ Carrier check pop-up</span>
              </button>
            </div>

            <div className="pt-1">
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="Or enter any custom 10-digit mobile number (e.g. +91 98765 43210)"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              />
            </div>
          </div>

          {/* SMS Message Payload Preview */}
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
                Scanning pre-fills the dispatch number & encoded emergency text on your mobile phone.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={isSending || !messageBody.trim()}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 text-white font-semibold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-xs"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Transmitting SMS to {phoneNumber}...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Send SMS to {phoneNumber}</span>
                </>
              )}
            </button>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer transition-colors"
                title="Copy human readable alert"
              >
                {hasCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                <span className="truncate">{hasCopied ? 'Copied!' : 'Copy Alert'}</span>
              </button>

              <button
                type="button"
                onClick={handleWebShare}
                className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer transition-colors"
                title="Share to any installed app"
              >
                <Share2 className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">Share SOS</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrCode(!showQrCode)}
                className="py-2 px-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center space-x-1 border border-slate-200 cursor-pointer transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-slate-500" />
                <span className="truncate">{showQrCode ? 'Hide QR' : 'Phone QR'}</span>
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
              <span>Launch in Device Default SMS App</span>
            </a>
          </div>

        </div>

        {/* Footer Note */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-2">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Complies with TRAI Telecom & ERSS Guidelines • Toll-Free Emergency Dispatch</span>
        </div>

      </div>
    </div>
  );
};
