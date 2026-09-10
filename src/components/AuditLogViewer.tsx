import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Search, Filter, RefreshCw, 
  Clock, User, FileText, Download, CheckCircle2, AlertTriangle, 
  Terminal, Lock, ArrowUpRight
} from 'lucide-react';
import { AuditLog, AuditAction } from '../types';
import { LocalClinicalStorage } from '../services/storage';
import { VibrationService } from '../services/vibrationService';

interface AuditLogViewerProps {
  onSelectCase?: (caseId: string) => void;
  onSelectPatient?: (patientId: string) => void;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({
  onSelectCase,
  onSelectPatient,
}) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedActionFilter, setSelectedActionFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadLogs = () => {
    const fetched = LocalClinicalStorage.getAuditLogs();
    setLogs(fetched);
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    VibrationService.triggerQuickTap();
    setTimeout(() => {
      loadLogs();
      setIsRefreshing(false);
    }, 200);
  };

  const filteredLogs = logs.filter(log => {
    if (selectedActionFilter !== 'all' && log.action !== selectedActionFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUser = log.user_name?.toLowerCase().includes(q);
      const matchAction = log.action?.toLowerCase().includes(q);
      const matchDetails = log.details?.toLowerCase().includes(q);
      const matchPatient = log.patient_id?.toLowerCase().includes(q);
      const matchHash = log.integrity_hash?.toLowerCase().includes(q);
      if (!matchUser && !matchAction && !matchDetails && !matchPatient && !matchHash) {
        return false;
      }
    }
    return true;
  });

  const getActionBadge = (action: AuditAction) => {
    switch (action) {
      case 'EMERGENCY_INTAKE_SUBMITTED':
        return { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'Emergency Intake' };
      case 'EMERGENCY_STATUS_UPDATED':
        return { bg: 'bg-amber-50 text-amber-700 border-amber-200', label: 'Status Change' };
      case 'LOGIN':
        return { bg: 'bg-sky-50 text-sky-700 border-sky-200', label: 'Auth Login' };
      case 'PATIENT_CONVERTED':
        return { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Bedside Admit' };
      case 'CONSULTATION_CREATED':
        return { bg: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Clinical Exam' };
      case 'SECURITY_UNAUTHORIZED_ACCESS_BLOCKED':
        return { bg: 'bg-red-100 text-red-800 border-red-300', label: 'Security Alert' };
      default:
        return { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: action.replace(/_/g, ' ') };
    }
  };

  const exportLogsAsJson = () => {
    VibrationService.triggerQuickTap();
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `arambh_audit_logs_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="space-y-4" id="audit-log-viewer">
      {/* Top Controls & Security Header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
            <Lock className="w-5 h-5 text-sky-400" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-slate-900">Immutable Audit & Operational Logs</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>SHA-256 Verified</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Cryptographically signed records of all voice emergency dispatches, status shifts, and clinical exams.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-sky-600' : 'text-slate-400'}`} />
            <span>Sync</span>
          </button>

          <button
            type="button"
            onClick={exportLogsAsJson}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-sky-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: 'all', label: 'All Events' },
            { id: 'EMERGENCY_INTAKE_SUBMITTED', label: 'Intake Dispatches' },
            { id: 'EMERGENCY_STATUS_UPDATED', label: 'Status Updates' },
            { id: 'CONSULTATION_CREATED', label: 'Clinical Exams' },
            { id: 'LOGIN', label: 'Logins' },
          ].map(tab => {
            const isActive = selectedActionFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  VibrationService.triggerQuickTap();
                  setSelectedActionFilter(tab.id);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/80'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search action, user, hash..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 p-6 space-y-2">
            <Terminal className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-700">No log entries matching the selected filter</p>
            <p className="text-[11px] text-slate-400">Events are recorded automatically whenever emergency cases are filed.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
            {filteredLogs.map(log => {
              const badge = getActionBadge(log.action);
              const dateStr = new Date(log.timestamp).toLocaleTimeString([], { 
                hour: '2-digit', minute: '2-digit', second: '2-digit' 
              });
              const dateFull = new Date(log.timestamp).toLocaleDateString([], {
                month: 'short', day: 'numeric'
              });

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLog(log)}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <Clock className="w-4 h-4 text-slate-500" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <span className="font-semibold text-slate-900">{log.user_name}</span>
                        <span className="text-[10px] text-slate-400 uppercase font-medium">({log.user_role})</span>
                      </div>

                      <p className="text-slate-600 truncate max-w-xl text-[11px]">
                        {log.details || 'Operational event recorded'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0 self-end sm:self-center">
                    <div className="text-right">
                      <span className="block font-mono text-[11px] text-slate-700 font-semibold">{dateStr}</span>
                      <span className="block text-[10px] text-slate-400">{dateFull}</span>
                    </div>

                    <div className="p-1 rounded-md bg-slate-100 text-slate-400 hover:text-slate-700">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">Audit Log Record #{selectedLog.id}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Action</span>
                <p className="font-semibold text-slate-800">{selectedLog.action}</p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Operator</span>
                  <p className="font-semibold text-slate-800">{selectedLog.user_name} ({selectedLog.user_role})</p>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Timestamp</span>
                  <p className="font-semibold text-slate-800">{new Date(selectedLog.timestamp).toLocaleString()}</p>
                </div>
              </div>

              <div className="p-2.5 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Details</span>
                <p className="text-slate-700 leading-relaxed">{selectedLog.details}</p>
              </div>

              <div className="p-2.5 bg-slate-900 text-white rounded-xl space-y-1 font-mono text-[10px]">
                <span className="text-sky-400 uppercase font-bold tracking-wider">Integrity Hash (SHA-256)</span>
                <p className="text-slate-300 break-all">{selectedLog.integrity_hash}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedLog(null)}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold text-xs transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
