import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { FastAdmitVoice } from './components/FastAdmitVoice';
import { NearestHospitalsView } from './components/NearestHospitalsView';
import { FallMotionGuard } from './components/FallMotionGuard';
import { EmergencyReceptionistAgent } from './components/EmergencyReceptionistAgent';
import { EmergencyQuickLogin } from './components/EmergencyQuickLogin';

import { EmergencyHotline } from './components/EmergencyHotline';
import { HospitalDashboard } from './components/HospitalDashboard';
import { PatientRegistration } from './components/PatientRegistration';
import { DoctorCaseTaking } from './components/DoctorCaseTaking';
import { PatientTimeline } from './components/PatientTimeline';
import { FollowUpWorkflow } from './components/FollowUpWorkflow';
import { AuditLogViewer } from './components/AuditLogViewer';
import { AdminUserManagement } from './components/AdminUserManagement';
import { DatabaseCacheModal } from './components/DatabaseCacheModal';
import { BluetoothHoppingPanel } from './components/BluetoothHoppingPanel';
import { AiChatbot } from './components/AiChatbot';
import { Bot, Radio } from 'lucide-react';

import { Patient, EmergencyCase, Consultation, FollowUp, User, UserRole, HospitalEvaluation } from './types';
import { LocalClinicalStorage } from './services/storage';

export default function App() {
  // Navigation & View State - default to fast_admit (Our Core USP)
  const [activeView, setActiveView] = useState<string>('fast_admit');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [phiMasked, setPhiMasked] = useState<boolean>(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState<boolean>(false);
  const [isFloatingChatOpen, setIsFloatingChatOpen] = useState<boolean>(false);
  const [showQuickLogin, setShowQuickLogin] = useState<boolean>(true); // Start with login/emergency entry screen

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

  // Initialize data on mount
  useEffect(() => {
    // Check URL parameters
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view');
    if (viewParam) {
      if (viewParam === 'emergency') setActiveView('fast_admit');
      else setActiveView(viewParam);
      setShowQuickLogin(false);
    }

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
    setActiveView('case_taking');
  };

  const handleOpenTimeline = (patientId: string) => {
    setSelectedPatientId(patientId);
    setActiveView('timeline');
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Top Minimalist Navigation Bar */}
      <Navbar
        activeView={activeView}
        onSelectView={(v) => {
          setActiveView(v);
          setShowQuickLogin(false);
        }}
        currentUser={currentUser}
        onSelectUser={(u) => {
          setCurrentUser(u);
          if (u) handleRoleChange(u.role);
        }}
        phiMasked={phiMasked}
        onTogglePhiMasked={() => setPhiMasked(!phiMasked)}
        isOfflineMode={isOfflineMode}
        onToggleOfflineMode={() => setIsOfflineMode(!isOfflineMode)}
        pendingEmergencyCount={emergencyCases.filter(c => c.status === 'pending').length}
        onOpenDatabaseCacheModal={() => setIsDbModalOpen(true)}
        onOpenQuickLogin={() => setShowQuickLogin(true)}
      />

      {/* QUICK LOGIN / EMERGENCY ENTRY MODAL */}
      {showQuickLogin && (
        <EmergencyQuickLogin
          isModal={true}
          onBypassToEmergency={() => {
            setShowQuickLogin(false);
            setActiveView('fast_admit');
          }}
          onPatientLogin={(patientData) => {
            setShowQuickLogin(false);
            setActiveView('fast_admit');
          }}
          onStaffLogin={(staff) => {
            setCurrentUser(staff);
            setShowQuickLogin(false);
            setActiveView('dashboard');
          }}
          onClose={() => setShowQuickLogin(false)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 overflow-x-hidden bg-black pb-12">
        {/* 1. CORE USP: FAST ADMIT & VOICE-TO-FILL */}
        {activeView === 'fast_admit' && (
          <FastAdmitVoice
            isOfflineMode={isOfflineMode}
            onCaseCreated={handleCaseCreated}
            onOpenReceptionist={(hospName, caseData) => {
              if (hospName) setActiveHospitalName(hospName);
              if (caseData) setLatestEmergencyCase(caseData);
              setActiveView('receptionist');
            }}
            onViewHospitals={() => setActiveView('hospitals')}
          />
        )}

        {/* 2. NEAREST HOSPITALS, VACANCIES & BEST RECOMMENDATIONS */}
        {activeView === 'hospitals' && (
          <NearestHospitalsView
            onSelectHospitalForAdmit={(hospEval: HospitalEvaluation) => {
              setActiveHospitalName(hospEval.hospital.name);
              setActiveView('fast_admit');
            }}
            onOpenReceptionist={(hospName: string) => {
              setActiveHospitalName(hospName);
              setActiveView('receptionist');
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
              setActiveView('fast_admit');
            }}
          />
        )}

        {/* 4. EMERGENCY RECEPTIONIST AGENT (NEAREST HOSPITAL AI RECEPTIONIST) */}
        {activeView === 'receptionist' && (
          <EmergencyReceptionistAgent
            hospitalName={activeHospitalName}
            activeCase={latestEmergencyCase}
            onBack={() => setActiveView('fast_admit')}
            isOfflineMode={isOfflineMode}
          />
        )}

        {/* 5. LEGACY SOS HOTLINE INTAKE */}
        {activeView === 'hotline' && (
          <EmergencyHotline
            isOfflineMode={isOfflineMode}
            onCaseCreated={handleCaseCreated}
          />
        )}

        {/* 6. BLUETOOTH FHSS 40-CHANNEL HOPPING */}
        {activeView === 'bluetooth_hopping' && (
          <BluetoothHoppingPanel
            isOfflineMode={isOfflineMode}
            onPacketRelayed={(pkt) => {
              console.log('Emergency packet relayed over Bluetooth FHSS Mesh:', pkt);
            }}
          />
        )}

        {/* 7. AI CHATBOT VIEW */}
        {activeView === 'ai_chatbot' && (
          <div className="px-4 py-4">
            <AiChatbot
              isOfflineMode={isOfflineMode}
              isFloating={false}
              onSelectConditionForIntake={(cond) => {
                setActiveView('fast_admit');
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

      {/* High-Contrast Emergency Status Bar */}
      <footer className="h-9 bg-black border-t border-red-950/80 flex items-center px-4 sm:px-6 justify-between text-[10px] text-neutral-400 uppercase tracking-widest font-mono select-none" id="med-core-footer">
        <div className="flex items-center space-x-4">
          <span className="text-red-500 font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            FAST ADMIT ZERO-DELAY USP
          </span>
          <span className="hidden sm:inline text-neutral-500">MOTION & FALL DETECTOR ACTIVE</span>
          <span className="hidden md:inline text-green-400">HIPAA SECURE</span>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-neutral-400">EMERGENCY HOTLINE 108</span>
          <span className="text-neutral-700">|</span>
          <span className="text-red-400 font-bold">RECEPTIONIST ON-CALL</span>
        </div>
      </footer>

      {/* Floating AI Medic Chatbot Drawer */}
      <AiChatbot
        isOfflineMode={isOfflineMode}
        isFloating={true}
        isOpen={isFloatingChatOpen}
        onClose={() => setIsFloatingChatOpen(false)}
        onSelectConditionForIntake={(cond) => {
          setIsFloatingChatOpen(false);
          setActiveView('fast_admit');
        }}
      />

      {/* Floating Launcher Button */}
      {!isFloatingChatOpen && activeView !== 'ai_chatbot' && (
        <button
          type="button"
          onClick={() => setIsFloatingChatOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-full shadow-2xl shadow-red-950/90 border-2 border-red-400 flex items-center space-x-2.5 transition-transform hover:scale-105 cursor-pointer"
          title="Open AI Receptionist & Triage Assistant"
          id="btn-floating-ai-launcher"
        >
          <div className="relative">
            <Bot className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-white animate-ping"></span>
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider">AI Receptionist</span>
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
