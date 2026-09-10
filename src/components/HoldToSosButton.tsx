import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Zap, ShieldAlert, CheckCircle2, ShieldCheck, AlertCircle } from 'lucide-react';
import { VibrationService } from '../services/vibrationService';

interface HoldToSosButtonProps {
  onTrigger: () => void;
  holdDurationMs?: number;
  label?: string;
  subLabel?: string;
  isSubmitting?: boolean;
  disabled?: boolean;
  variant?: 'danger' | 'primary';
  className?: string;
  showProtectionToggle?: boolean;
  id?: string;
}

export const HoldToSosButton: React.FC<HoldToSosButtonProps> = ({
  onTrigger,
  holdDurationMs = 1500,
  label = 'Fast Admit & Dispatch Ambulance',
  subLabel = 'Press & hold 1.5s to prevent accidental dispatch',
  isSubmitting = false,
  disabled = false,
  variant = 'danger',
  className = '',
  showProtectionToggle = true,
  id = 'btn-hold-to-sos',
}) => {
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [holdSafetyActive, setHoldSafetyActive] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);

  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const noticeTimeoutRef = useRef<any>(null);
  const hasTriggeredRef = useRef<boolean>(false);

  // Vibration ticks at intervals
  const lastVibePercentRef = useRef<number>(0);

  const clearHold = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
    lastVibePercentRef.current = 0;
  }, []);

  const handleHoldStart = (e: React.SyntheticEvent) => {
    if (disabled || isSubmitting) return;

    // If hold safety is toggled off by user, trigger immediately
    if (!holdSafetyActive) {
      VibrationService.triggerDispatchSuccess();
      onTrigger();
      return;
    }

    // Clear any active notices
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    setNotice(null);

    hasTriggeredRef.current = false;
    setIsHolding(true);
    startTimeRef.current = performance.now();
    lastVibePercentRef.current = 0;
    VibrationService.triggerQuickTap();

    const loop = (currentTime: number) => {
      const elapsed = currentTime - startTimeRef.current;
      const currentPct = Math.min(100, (elapsed / holdDurationMs) * 100);
      setProgress(currentPct);

      // Trigger mid-hold haptic feedback at 40% and 75%
      if (currentPct >= 40 && lastVibePercentRef.current < 40) {
        lastVibePercentRef.current = 40;
        VibrationService.triggerQuickTap();
      } else if (currentPct >= 75 && lastVibePercentRef.current < 75) {
        lastVibePercentRef.current = 75;
        VibrationService.triggerQuickTap();
      }

      if (currentPct >= 100) {
        if (!hasTriggeredRef.current) {
          hasTriggeredRef.current = true;
          VibrationService.triggerDispatchSuccess();
          clearHold();
          onTrigger();
        }
      } else {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };

    animFrameRef.current = requestAnimationFrame(loop);
  };

  const handleHoldEnd = () => {
    if (!isHolding || hasTriggeredRef.current) {
      clearHold();
      return;
    }

    // User let go early! Prevent accidental dispatch
    const heldTime = ((performance.now() - startTimeRef.current) / 1000).toFixed(1);
    clearHold();

    // Show accidental press protection message
    setNotice(`Accidental tap avoided: Held for ${heldTime}s. Keep holding full 1.5s to dispatch SOS.`);
    if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    noticeTimeoutRef.current = setTimeout(() => {
      setNotice(null);
    }, 3800);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (noticeTimeoutRef.current) clearTimeout(noticeTimeoutRef.current);
    };
  }, []);

  const secondsRemaining = Math.max(0, ((holdDurationMs * (100 - progress)) / 100000)).toFixed(1);

  const isDanger = variant === 'danger';
  const baseBg = isDanger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-sky-600 hover:bg-sky-700';
  const activeBorder = isDanger ? 'border-rose-400' : 'border-sky-400';
  const fillBg = isDanger ? 'bg-rose-950/40' : 'bg-sky-950/40';

  return (
    <div className={`space-y-2 select-none ${className}`}>
      {/* Main Hold-to-SOS Button */}
      <div className="relative group">
        <button
          id={id}
          type="button"
          disabled={disabled || isSubmitting}
          onPointerDown={handleHoldStart}
          onPointerUp={handleHoldEnd}
          onPointerLeave={handleHoldEnd}
          onPointerCancel={handleHoldEnd}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              if (!isHolding) handleHoldStart(e);
            }
          }}
          onKeyUp={(e) => {
            if (e.key === ' ' || e.key === 'Enter') {
              handleHoldEnd();
            }
          }}
          aria-label={label}
          style={{ touchAction: 'none' }}
          className={`relative w-full py-4 px-6 rounded-2xl ${baseBg} text-white font-semibold text-base overflow-hidden transition-all cursor-pointer shadow-md active:scale-[0.99] border ${activeBorder} flex items-center justify-between ${
            disabled || isSubmitting ? 'opacity-60 cursor-not-allowed' : ''
          }`}
        >
          {/* Animated Progress Fill Bar */}
          {holdSafetyActive && (
            <div
              className={`absolute top-0 left-0 bottom-0 ${fillBg} backdrop-brightness-75 transition-[width] duration-75 ease-linear pointer-events-none`}
              style={{ width: `${progress}%` }}
            />
          )}

          {/* Left Icon with Circular Hold Progress Ring */}
          <div className="relative flex items-center justify-center shrink-0 z-10 mr-3">
            {holdSafetyActive ? (
              <div className="relative w-9 h-9 flex items-center justify-center">
                {/* Background Ring */}
                <svg className="w-9 h-9 transform -rotate-90">
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="stroke-white/25"
                    strokeWidth="3"
                    fill="transparent"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="15"
                    className="stroke-white transition-all duration-75"
                    strokeWidth="3.5"
                    strokeDasharray={94.2}
                    strokeDashoffset={94.2 - (94.2 * progress) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Zap className={`w-4 h-4 fill-white ${isHolding ? 'animate-pulse text-amber-300' : 'text-white'}`} />
                </div>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Zap className="w-4 h-4 fill-white text-white" />
              </div>
            )}
          </div>

          {/* Centered Descriptive Content */}
          <div className="flex-1 text-left z-10 py-0.5">
            <div className="flex items-center space-x-2">
              <span className="text-base sm:text-lg font-bold tracking-tight">
                {isSubmitting
                  ? 'Reserving ER Bed & Dispatching...'
                  : isHolding
                  ? `HOLDING... (${secondsRemaining}s)`
                  : label}
              </span>
              {holdSafetyActive && !isSubmitting && !isHolding && (
                <span className="text-[10px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-black/25 text-white/90 tracking-wide">
                  Hold 1.5s
                </span>
              )}
            </div>
            <p className="text-xs text-white/80 font-normal mt-0.5">
              {isHolding
                ? 'Keep holding button to trigger SOS...'
                : isSubmitting
                ? 'Communicating with nearest hospital ER unit...'
                : subLabel}
            </p>
          </div>

          {/* Right Status Indicator */}
          <div className="z-10 shrink-0 ml-3 text-right">
            {isHolding ? (
              <div className="text-xs font-mono font-bold bg-black/30 px-2.5 py-1 rounded-lg border border-white/20 animate-pulse">
                {Math.round(progress)}%
              </div>
            ) : (
              <div className="flex items-center space-x-1 text-white/90 text-xs font-medium bg-white/15 px-2.5 py-1 rounded-lg">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
                <span className="hidden sm:inline">Protected</span>
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Accidental Tap Protected Banner */}
      {notice && (
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between animate-in fade-in slide-in-from-top-1 duration-200 shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span className="font-medium">{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-[10px] text-amber-700 hover:text-amber-900 underline ml-2 cursor-pointer font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Accidental Tap Guard Toggle Bar */}
      {showProtectionToggle && (
        <div className="flex items-center justify-between text-xs px-1 text-slate-500 pt-1">
          <div className="flex items-center space-x-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
            <span>Accidental Tap Guard:</span>
            <span className="font-semibold text-slate-700">
              {holdSafetyActive ? '1.5s Hold Required' : 'Instant 1-Tap Active'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              VibrationService.triggerQuickTap();
              setHoldSafetyActive(!holdSafetyActive);
            }}
            className={`px-2 py-0.5 rounded-md text-[11px] font-medium border cursor-pointer transition-colors ${
              holdSafetyActive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'
            }`}
          >
            {holdSafetyActive ? '✓ Guard Enabled' : '⚠ Guard Disabled'}
          </button>
        </div>
      )}
    </div>
  );
};
