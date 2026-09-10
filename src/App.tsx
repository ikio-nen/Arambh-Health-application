import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { QuickNavCommandPalette } from './components/QuickNavCommandPalette';
import { MobileBottomNav } from './components/MobileBottomNav';
import { FastAdmitVoice } from './components/FastAdmitVoice';
import { NearestHospitalsView } from './components/NearestHospitalsView';
import { FallMotionGuard } from './components/FallMotionGuard';
import { EmergencyReceptionistAgent } from './components/EmergencyReceptionistAgent';
import { EmergencyQuickLogin } from './components/EmergencyQuickLogin';

import { HospitalDashboard } from './components/HospitalDashboard';
import { PatientRegistration } from './components/PatientRegistration';
import { DoctorCaseTaking } from './components/DoctorCaseTaking';
import { PatientTimeline } from './components/PatientTimeline';
import { FollowUpWorkflow } from './components/FollowUpWorkflow';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminUserManagement } from './components/AdminUserManagement';
import { DatabaseCacheModal } from './components/DatabaseCacheModal';
import { AiChatbot } from './components/AiChatbot';
import { Bot } from 'lucide-react';

import { Patient, EmergencyCase, Consultation, FollowUp, User, UserRole, HospitalEvaluation } from './types';
import { LocalClinicalStorage } from './services/storage';

export default function App() {
  // Navigation & View State - default to fast_admit (Our Core USP)
  const [activeView, setActiveView] = useState<string>('fast_admit');
  const [previousView, setPreviousView] = useState<string | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [phiMasked, setPhiMasked] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState<boolean>(false);
  const [showQuickLogin, setShowQuickLogin] = useState<boolean>(false); // Start directly on fast_admit; portal accessible anytime

  // Active Emergency Context
  const [activeHospitalName, setActiveHospitalName] = useState<string>('Arambh Metro Trauma Center');
  const [latestEmergencyCase, setLatestEmergencyCase] = useState<EmergencyCase | null>(null);

  // Core Clinical State
  const [patients, setPatients] = useState<Patient[]>([]);
  const [emergencyCases, setEmergencyCases] = useState<EmergencyCase[]>([]);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [followups, setFollowups] = useState<FollowUp[]>([]);

  // Selected Patient for cross-module flows
  const [selectedPatientId, setSelectedPatientId] = useState<string | undefined>(undefined);

  // Smooth, robust view navigation with browser history sync
  const navigateToView = (view: string, pushHistory = true) => {
    setPreviousView(activeView);
    setActiveView(view);
    setShowQuickLogin(false);
    setIsFloatingChatOpen(false);

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

  // Global Keyboard Shortcuts (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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
    if (cases.length > 0) {
      setLatestEmergencyCase(cases[0]);
    }
    setConsultations(LocalClinicalStorage.getConsultations());
    setFollowups(LocalClinicalStorage.getFollowUps());

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

  // Handlers for state updates
  const handleRoleChange = (role: UserRole) => {
    if (currentUser) {
      const updatedUser: User = { ...currentUser, role };
      setCurrentUser(updatedUser);
      LocalClinicalStorage.logAuditAction(
        { id: updatedUser.id, name: updatedUser.name, role: updatedUser.role },
        'USER_ROLE_CHANGED',
        updatedUser.id,
        `Switched session active role to ${role}`
      );
    }
  };

  const handleCaseCreated = (newCase: EmergencyCase) => {
    setLatestEmergencyCase(newCase);
    setActiveHospitalName(newCase.assigned_hospital);
    setEmergencyCases(prev => [newCase, ...prev]);
    setPatients(LocalClinicalStorage.getPatients());
  };

  const handlePatientConverted = (convertedPatient: Patient) => {
    setPatients(prev => prev.map(p => p.id === convertedPatient.id ? convertedPatient : p));
    setEmergencyCases(LocalClinicalStorage.getEmergencyCases());
  };

  const handlePatientCreated = (newPatient: Patient) => {
    setPatients(prev => [newPatient, ...prev]);
  };

  const handleConsultationSaved = (newCons: Consultation) => {
    setConsultations(prev => [newCons, ...prev]);
  };

  const handleFollowUpSaved = (newFol: FollowUp) => {
    setFollowups(prev => [newFol, ...prev]);
  };

  // Cross-module navigations
  const handleOpenConsultation = (patientId: string) => {
    setSelectedPatientId(patientId);
    navigateToView('case_taking');
  };

  const handleOpenTimeline = (patientId: string) => {
    setSelectedPatientId(patientId);
    navigateToView('timeline');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Top Minimalist Navigation Bar */}
      <Navbar
        activeView={activeView}
        onSelectView={(v) => navigateToView(v)}
        currentUser={currentUser}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending').length}
        onOpenQuickLogin={() => setShowQuickLogin(true)}
      />

      {/* QUICK NAV COMMAND PALETTE (CMD+K) */}
      <QuickNavCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        activeView={activeView}
        onSelectView={(v) => navigateToView(v)}
        onOpenDatabaseCacheModal={() => setIsDbModalOpen(true)}
        onOpenQuickLogin={() => setShowQuickLogin(true)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending').length}
      />

      {/* QUICK LOGIN / EMERGENCY ENTRY MODAL */}
      {showQuickLogin && (
        <EmergencyQuickLogin
          isModal={true}
          onBypassToEmergency={() => {
            setShowQuickLogin(false);
            navigateToView('fast_admit');
          }}
          onPatientLogin={(patientData) => {
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
      <main className="flex-1 overflow-x-hidden bg-slate-50 pb-20 lg:pb-12">
        {/* 1. CORE USP: FAST ADMIT & VOICE-TO-FILL */}
        {activeView === 'fast_admit' && (
          <FastAdmitVoice
            isOfflineMode={isOfflineMode}
            onCaseCreated={handleCaseCreated}
            onOpenReceptionist={(hospName, caseData) => {
              if (hospName) setActiveHospitalName(hospName);
              if (caseData) setLatestEmergencyCase(caseData);
              navigateToView('receptionist');
            }}
            onViewHospitals={() => navigateToView('hospitals')}
          />
        )}

        {/* 2. NEAREST HOSPITALS, VACANCIES & BEST RECOMMENDATIONS */}
        {activeView === 'hospitals' && (
          <NearestHospitalsView
            onSelectHospitalForAdmit={(hospEval: HospitalEvaluation) => {
              setActiveHospitalName(hospEval.hospital.name);
              navigateToView('fast_admit');
            }}
            onOpenReceptionist={(hospName: string) => {
              setActiveHospitalName(hospName);
              navigateToView('receptionist');
            }}
          />
        )}

        {/* 3. FALL & MOTION DETECTION + VOICE GUARD */}
        {activeView === 'fall_guard' && (
          <FallMotionGuard
            isOfflineMode={isOfflineMode}
            onEmergencyTriggered={(caseData) => {
              handleCaseCreated(caseData);
              setActiveHospitalName(caseData.assigned_hospital);
              navigateToView('fast_admit');
            }}
          />
        )}

        {/* 4. EMERGENCY RECEPTIONIST AGENT (NEAREST HOSPITAL AI RECEPTIONIST) */}
        {activeView === 'receptionist' && (
          <EmergencyReceptionistAgent
            hospitalName={activeHospitalName}
            activeCase={latestEmergencyCase}
            onBack={() => navigateToView(previousView || 'fast_admit')}
            isOfflineMode={isOfflineMode}
          />
        )}

        {/* 5. AI CHATBOT VIEW */}
        {activeView === 'ai_chatbot' && (
          <div className="px-4 py-4 max-w-4xl mx-auto">
            <AiChatbot
              isOfflineMode={isOfflineMode}
              isFloating={false}
              onSelectConditionForIntake={(cond) => {
                navigateToView('fast_admit');
              }}
            />
          </div>
        )}

        {/* 8. ER BOARD & HOSPITAL OPERATIONS */}
        {activeView === 'dashboard' && (
          <HospitalDashboard
            emergencyCases={emergencyCases}
            patients={patients}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
            onPatientConverted={handlePatientConverted}
            onOpenConsultation={handleOpenConsultation}
            onOpenTimeline={handleOpenTimeline}
          />
        )}

        {/* 9. PATIENT ADMISSION REGISTRY */}
        {activeView === 'registration' && (
          <PatientRegistration
            patients={patients}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
            onPatientCreated={handlePatientCreated}
            onOpenConsultation={handleOpenConsultation}
            onOpenTimeline={handleOpenTimeline}
          />
        )}

        {/* 10. DOCTOR CLINICAL CASE TAKING */}
        {activeView === 'case_taking' && (
          <DoctorCaseTaking
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
            onConsultationSaved={handleConsultationSaved}
            onOpenTimeline={handleOpenTimeline}
          />
        )}

        {/* 11. PATIENT LONGITUDINAL TIMELINE */}
        {activeView === 'timeline' && (
          <PatientTimeline
            patients={patients}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
          />
        )}

        {/* 12. FOLLOW-UP WORKFLOW */}
        {activeView === 'followup' && (
          <FollowUpWorkflow
            patients={patients}
            consultations={consultations}
            selectedPatientId={selectedPatientId}
            onSelectPatientId={setSelectedPatientId}
            currentUser={currentUser}
            phiMasked={phiMasked}
            isOfflineMode={isOfflineMode}
            onFollowUpSaved={handleFollowUpSaved}
            onOpenTimeline={handleOpenTimeline}
          />
        )}

        {/* 13. AUDIT LOG VIEWER */}
        {activeView === 'audit' && (
          <AuditLogViewer
            currentUser={currentUser}
            isOfflineMode={isOfflineMode}
          />
        )}

        {/* 14. ADMIN USER MANAGEMENT */}
        {activeView === 'users' && (
          <AdminUserManagement
            currentUser={currentUser}
            onRoleChanged={(uid, newRole) => {
              if (currentUser?.id === uid) {
                setCurrentUser({ ...currentUser, role: newRole });
              }
            }}
          />
        )}
      </main>

      {/* Calm Professional Emergency Status Bar */}
      <footer className="h-10 bg-white border-t border-slate-200/90 flex items-center px-4 sm:px-6 justify-between text-xs text-slate-600 font-sans select-none shadow-xs" id="med-core-footer">
        <div className="flex items-center space-x-3 sm:space-x-4">
          <span className="text-sky-700 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Zero-Delay Fast Admit Active
          </span>
          <span className="hidden sm:inline text-slate-300">•</span>
          <span className="hidden sm:inline text-slate-500">Motion & Fall Guard Ready</span>
          <span className="hidden md:inline text-slate-300">•</span>
          <span className="hidden md:inline text-emerald-700 font-medium">HIPAA Compliant Local Storage</span>
        </div>
        <div className="flex items-center space-x-3 text-xs">
          <span className="text-slate-600 font-medium">Emergency: <strong className="text-rose-600 font-bold">108</strong></span>
          <span className="text-slate-200">|</span>
          <span className="text-sky-700 font-medium">Hospital ER Connected</span>
        </div>
      </footer>

      {/* Mobile-optimized persistent Bottom Navigation Bar */}
      <MobileBottomNav
        activeView={activeView}
        onSelectView={(v) => navigateToView(v)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending').length}
      />

      {/* Floating AI Medic Chatbot Drawer */}
      <AiChatbot
        isOfflineMode={isOfflineMode}
        isFloating={true}
        isOpen={isFloatingChatOpen}
        onClose={() => setIsFloatingChatOpen(false)}
        onSelectConditionForIntake={(cond) => {
          setIsFloatingChatOpen(false);
          navigateToView('fast_admit');
        }}
      />

      {/* Floating Medical AI Assistant Launcher */}
      {!isFloatingChatOpen && activeView !== 'ai_chatbot' && (
        <button
          type="button"
          onClick={() => setIsFloatingChatOpen(true)}
          className="fixed bottom-20 lg:bottom-5 right-4 lg:right-5 z-40 px-3.5 py-2 lg:px-4 lg:py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-full shadow-lg shadow-sky-900/15 border border-sky-500 flex items-center space-x-2 transition-all hover:scale-102 cursor-pointer"
          title="Open AI Receptionist & Triage Assistant"
          id="btn-floating-ai-launcher"
        >
          <div className="relative">
            <Bot className="w-4 h-4 text-white" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <span className="text-xs font-semibold tracking-wide">Virtual Receptionist</span>
        </button>
      )}

      {/* Global Database & AI Cache Management Modal */}
      <DatabaseCacheModal
        isOpen={isDbModalOpen}
        onClose={() => setIsDbModalOpen(false)}
        isOfflineMode={isOfflineMode}
      />
    </div>
  );
}
