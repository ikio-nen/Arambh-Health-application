import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { MobileBottomNav } from './components/MobileBottomNav';
import { FastAdmitVoice } from './components/FastAdmitVoice';
import { NearestHospitalsView } from './components/NearestHospitalsView';
import { HospitalDashboard } from './components/HospitalDashboard';
import { AiChatbot } from './components/AiChatbot';
import { FallMotionGuard } from './components/FallMotionGuard';
import { EmergencyQuickLogin } from './components/EmergencyQuickLogin';

import { Patient, EmergencyCase, Consultation, FollowUp, User, UserRole, HospitalEvaluation } from './types';
import { LocalClinicalStorage } from './services/storage';

export default function App() {
  // Navigation & View State - default to fast_admit (Our Core Emergency Service)
  const [activeView, setActiveView] = useState<string>('fast_admit');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [phiMasked, setPhiMasked] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [showQuickLogin, setShowQuickLogin] = useState<boolean>(false);

  // Core Clinical State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<EmergencyCase[]>([]);
  const [selectedHospitalForAdmit, setSelectedHospitalForAdmit] = useState<HospitalEvaluation | null>(null);
  const [selectedConditionForAdmit, setSelectedConditionForAdmit] = useState<string>('');

  // Smooth, robust view navigation with browser history sync
  const navigateToView = (view: string, pushHistory = true) => {
    setActiveView(view);
    setShowQuickLogin(false);

    // Sync with browser history and URL query param
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (view === 'fast_admit') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', view);
      }
      if (pushHistory) {
        window.history.pushState({ view }, '', url.toString());
      } else {
        window.history.replaceState({ view }, '', url.toString());
      }
    }

    // Smooth scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Initialize data and history listeners on mount
  useEffect(() => {
    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      const target = viewParam === 'emergency' ? 'fast_admit' : viewParam;
      setActiveView(target);
      window.history.replaceState({ view: target }, '', window.location.href);
    } else {
      window.history.replaceState({ view: 'fast_admit' }, '', window.location.href);
    }

    // Handle browser Back / Forward buttons seamlessly
    const handlePopState = (e: PopStateEvent) => {
      if (e.state && e.state.view) {
        setActiveView(e.state.view);
      } else {
        const currentParams = new URLSearchParams(window.location.search);
        const v = currentParams.get('view') || 'fast_admit';
        setActiveView(v === 'emergency' ? 'fast_admit' : v);
      }
    };
    window.addEventListener('popstate', handlePopState);

    // Load initial users
    const users = LocalClinicalStorage.getUsers();
    if (users.length > 0) {
      setCurrentUser(users[0]); // Default to Dr. Arjun Mehta, MD
    }

    // Load initial clinical store
    setPatients(LocalClinicalStorage.getPatients());
    const cases = LocalClinicalStorage.getEmergencyCases();
    setEmergencyCases(cases);

    // Listen for online/offline events
    const handleOnline = () => setIsOfflineMode(false);
    const handleOffline = () => setIsOfflineMode(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Handlers for emergency cases
  const handleCaseCreated = (newCase: EmergencyCase) => {
    const updated = [newCase, ...emergencyCases];
    setEmergencyCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);
  };

  const handleCaseUpdated = (updatedCase: EmergencyCase) => {
    const updated = emergencyCases.map(c => c.id === updatedCase.id ? updatedCase : c);
    setEmergencyCases(updated);
    LocalClinicalStorage.setEmergencyCases(updated);
  };

  const handlePatientConverted = (patient: Patient) => {
    const updated = [patient, ...patients.filter(p => p.id !== patient.id)];
    setPatients(updated);
    LocalClinicalStorage.setPatients(updated);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800 selection:bg-rose-100 selection:text-rose-800">
      {/* Primary Top Navigation Bar */}
      <Navbar
        currentUser={currentUser}
        onSelectUser={setCurrentUser}
        phiMasked={phiMasked}
        onTogglePhiMasked={() => setPhiMasked(!phiMasked)}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
        activeView={activeView}
        onSelectView={(v) => navigateToView(v)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending' || c.status === 'en_route').length}
        onOpenQuickLogin={() => setShowQuickLogin(true)}
      />

      {/* QUICK LOGIN / EMERGENCY ROLE MODAL */}
      {showQuickLogin && (
        <EmergencyQuickLogin
          isModal={true}
          onBypassToEmergency={() => {
            setShowQuickLogin(false);
            navigateToView('fast_admit');
          }}
          onPatientLogin={() => {
            setShowQuickLogin(false);
            navigateToView('fast_admit');
          }}
          onStaffLogin={(staff) => {
            setCurrentUser(staff);
            setShowQuickLogin(false);
            navigateToView('dashboard');
          }}
          onClose={() => setShowQuickLogin(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden bg-slate-50 pb-20 md:pb-12">
        {/* 1. CORE USP: FAST ADMIT EMERGENCY SOS */}
        {activeView === 'fast_admit' && (
          <FastAdmitVoice
            isOfflineMode={isOfflineMode}
            initialSelectedHospital={selectedHospitalForAdmit}
            initialCondition={selectedConditionForAdmit}
            onCaseCreated={handleCaseCreated}
            onOpenAiAssistant={() => navigateToView('ai_chatbot')}
            onViewHospitals={() => navigateToView('hospitals')}
          />
        )}

        {/* 2. NEAREST HOSPITALS, VACANCIES & BED RADAR */}
        {activeView === 'hospitals' && (
          <NearestHospitalsView
            onSelectHospitalForAdmit={(hospEval: HospitalEvaluation) => {
              setSelectedHospitalForAdmit(hospEval);
              navigateToView('fast_admit');
            }}
          />
        )}

        {/* 3. BIOMEDICAL FALL & DECELERATION GUARD */}
        {activeView === 'fall_guard' && (
          <FallMotionGuard
            isOfflineMode={isOfflineMode}
            onEmergencyTriggered={(caseData) => {
              handleCaseCreated(caseData);
              navigateToView('fast_admit');
            }}
            onNavigateToSos={() => navigateToView('fast_admit')}
          />
        )}

        {/* 4. ER BOARD & HOSPITAL OPERATIONS */}
        {activeView === 'dashboard' && (
          <HospitalDashboard
            emergencyCases={emergencyCases}
            patients={patients}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
            onPatientConverted={handlePatientConverted}
            onCaseUpdated={handleCaseUpdated}
          />
        )}

        {/* 5. AI EMERGENCY PROTOCOLS & CLINICAL CHAT */}
        {activeView === 'ai_chatbot' && (
          <div className="px-4 py-4 max-w-4xl mx-auto">
            <AiChatbot
              isOfflineMode={isOfflineMode}
              isFloating={false}
              onSelectConditionForIntake={(conditionText) => {
                setSelectedConditionForAdmit(conditionText);
                navigateToView('fast_admit');
              }}
            />
          </div>
        )}
      </main>

      {/* Professional Healthcare Status Footer */}
      <footer className="h-10 bg-white border-t border-slate-200/90 flex items-center px-4 sm:px-6 justify-between text-xs text-slate-600 font-sans select-none shadow-xs" id="med-core-footer">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <span className="text-sky-700 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Zero-Delay Fast Admit Ready
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="hidden sm:inline text-slate-500">Live 108 Emergency Network</span>
          <span className="hidden md:inline text-slate-300">•</span>
          <span className="hidden md:inline text-emerald-700 font-medium">HIPAA Compliant Local Storage</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-600 font-medium">Emergency Hotline: <strong className="text-rose-600 font-bold">108</strong></span>
          <span className="text-slate-200">|</span>
          <span className="text-sky-700 font-medium">ER Bays Synced</span>
        </div>
      </footer>

      {/* Mobile-optimized persistent Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(v) => navigateToView(v)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending' || c.status === 'en_route').length}
      />
    </div>
  );
}
