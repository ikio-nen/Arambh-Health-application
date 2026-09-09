import React, { useState } from 'react';
import { Download, CheckCircle2, Smartphone, HelpCircle, X, ArrowUpRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { VibrationService } from '../services/vibrationService';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'banner';
  onOpenApkGuide?: () => void;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
  onOpenApkGuide,
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState<boolean>(false);
  const [installSuccess, setInstallSuccess] = useState<boolean>(false);

  const handleInstallClick = async () => {
    VibrationService.triggerQuickTap();
    if (isInstallable) {
      const outcome = await install();
      if (outcome) {
        setInstallSuccess(true);
        VibrationService.triggerDispatchSuccess();
      }
    } else {
      setShowGuide(true);
    }
  };

  // If already running as standalone native app
  if (isInstalled || installSuccess) {
    if (variant === 'banner') return null;
    return (
      <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-mono ${className}`}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>APK INSTALLED</span>
      </div>
    );
  }

  // Variant: Compact Button (for Navbar)
  if (variant === 'compact') {
    return (
      <>
        <button
          id="btn-install-apk-compact"
          onClick={handleInstallClick}
          className={`px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-mono font-bold flex items-center space-x-1.5 transition-all shadow-md active:scale-98 cursor-pointer ${className}`}
          title="Install as Android APK"
        >
          <Download className="w-3.5 h-3.5" />
          <span>INSTALL APK</span>
        </button>

        {showGuide && (
          <InstallInstructionsModal 
            onClose={() => setShowGuide(false)} 
            isIOS={isIOS} 
            isAndroid={isAndroid} 
            onOpenApkGuide={onOpenApkGuide}
          />
        )}
      </>
    );
  }

  // Variant: Full CTA Button
  if (variant === 'full') {
    return (
      <>
        <button
          id="btn-install-apk-full"
          onClick={handleInstallClick}
          className={`w-full py-3.5 px-5 rounded-xl bg-white text-black hover:bg-slate-200 font-bold text-sm uppercase tracking-wider flex items-center justify-center space-x-2.5 transition-all shadow-xl active:scale-98 cursor-pointer ${className}`}
        >
          <Smartphone className="w-4 h-4 text-red-600" />
          <span>Install Android APK / WebAPK</span>
          <Download className="w-4 h-4 ml-auto" />
        </button>

        {showGuide && (
          <InstallInstructionsModal 
            onClose={() => setShowGuide(false)} 
            isIOS={isIOS} 
            isAndroid={isAndroid} 
            onOpenApkGuide={onOpenApkGuide}
          />
        )}
      </>
    );
  }

  // Variant: Top Banner
  return (
    <>
      <div className="bg-[#14161a] border-b border-red-500/30 px-4 py-2 flex items-center justify-between text-xs font-mono text-slate-300">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          <span>SIH Offline Showcase: Run directly on Android without internet.</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleInstallClick}
            className="px-2.5 py-1 rounded bg-red-500 hover:bg-red-400 text-white font-bold cursor-pointer"
          >
            Download / Install APK
          </button>
        </div>
      </div>

      {showGuide && (
        <InstallInstructionsModal 
          onClose={() => setShowGuide(false)} 
          isIOS={isIOS} 
          isAndroid={isAndroid}
          onOpenApkGuide={onOpenApkGuide}
        />
      )}
    </>
  );
};

// Guide Modal for Android & Chrome
const InstallInstructionsModal: React.FC<{
  onClose: () => void;
  isIOS: boolean;
  isAndroid: boolean;
  onOpenApkGuide?: () => void;
}> = ({ onClose, isIOS, isAndroid, onOpenApkGuide }) => {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-[#111317] border border-white/15 rounded-2xl p-5 sm:p-6 text-slate-100 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-red-500" />
            <h3 className="font-bold text-sm tracking-tight text-white">
              Install Arambh Native Android App
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          {isIOS ? (
            <div className="space-y-2 p-3 bg-[#181b22] rounded-xl border border-white/5">
              <p className="font-semibold text-white">Apple iOS (Safari):</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Tap the <strong>Share</strong> button (box with arrow) in Safari.</li>
                <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
                <li>Launch from your home screen — runs full-screen offline!</li>
              </ol>
            </div>
          ) : (
            <div className="space-y-2 p-3 bg-[#181b22] rounded-xl border border-white/5">
              <p className="font-semibold text-white">Android Chrome / Edge / Brave:</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-400">
                <li>Tap the <strong>three dots menu (⋮)</strong> at top right of Chrome.</li>
                <li>Tap <strong>"Install app"</strong> or <strong>"Add to Home screen"</strong>.</li>
                <li>Android automatically packages it into a signed <strong>WebAPK</strong> with vibration and full offline storage!</li>
              </ol>
            </div>
          )}

          <div className="p-3 bg-[#14161a] rounded-xl border border-white/5 text-slate-400 text-[11px] space-y-1 font-mono">
            <div className="text-emerald-400 font-bold">100% OFFLINE CAPABLE (PWA + SMS)</div>
            <p>Once installed, all icons, maps, emergency algorithms, and SMS dispatch trigger even in Airplane mode without any internet connection.</p>
          </div>
        </div>

        <div className="flex space-x-2 pt-1">
          {onOpenApkGuide && (
            <button
              onClick={() => {
                onClose();
                onOpenApkGuide();
              }}
              className="flex-1 py-2.5 rounded-xl bg-[#181b22] hover:bg-[#20242e] border border-white/10 text-white font-mono text-xs cursor-pointer flex items-center justify-center space-x-1"
            >
              <span>SIH Presentation Guide</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-white text-black font-bold text-xs cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
