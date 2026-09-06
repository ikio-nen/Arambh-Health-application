/**
 * Vibration API Service for Physical Haptic Feedback
 * Delivers physical tactile alerts during fall shocks, active calls, and emergency dispatches.
 */

export class VibrationService {
  private static callPulseInterval: any = null;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  /**
   * Violent, urgent physical pulse pattern for fall detection
   * Pattern: Long buzz (600ms), pause (200ms), buzz (600ms), pause (200ms), long buzz (900ms)
   */
  public static triggerFallAlarmPulse(): boolean {
    if (!this.isSupported()) return false;
    try {
      return navigator.vibrate([600, 150, 600, 150, 900]);
    } catch {
      return false;
    }
  }

  /**
   * Continuous heartbeat-like vibration pulse while an emergency call / receptionist is active
   */
  public static startCallHapticPulse(): void {
    if (!this.isSupported()) return;
    this.stopCallHapticPulse();

    // Initial pulse
    try {
      navigator.vibrate([140, 80, 140]);
    } catch {}

    // Loop heartbeat rhythm every 2.5 seconds during active emergency call
    this.callPulseInterval = setInterval(() => {
      try {
        navigator.vibrate([120, 70, 120]);
      } catch {}
    }, 2500);
  }

  public static stopCallHapticPulse(): void {
    if (this.callPulseInterval) {
      clearInterval(this.callPulseInterval);
      this.callPulseInterval = null;
    }
  }

  /**
   * Tactile click / dispatch feedback
   */
  public static triggerDispatchSuccess(): boolean {
    if (!this.isSupported()) return false;
    try {
      return navigator.vibrate([100, 50, 200, 50, 400]);
    } catch {
      return false;
    }
  }

  public static triggerQuickTap(): boolean {
    if (!this.isSupported()) return false;
    try {
      return navigator.vibrate(40);
    } catch {
      return false;
    }
  }

  /**
   * Completely cancel all ongoing physical vibrations
   */
  public static stopAll(): void {
    this.stopCallHapticPulse();
    if (this.isSupported()) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }
}
