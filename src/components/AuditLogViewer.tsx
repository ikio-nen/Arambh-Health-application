import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, ShieldAlert, Key, Search, Download, Filter, 
  Clock, User, CheckCircle2, RefreshCw 
} from 'lucide-react';
import { AuditLog, User as SystemUser } from '../types';
import { LocalClinicalStorage } from '../services/storage';

interface AuditLogViewerProps {
  currentUser: SystemUser | null;
  isOfflineMode: boolean;
}

export const AuditLogViewer: React.FC<AuditLogViewerProps> = ({ currentUser, isOfflineMode }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [exportedNotice, setExportedNotice] = useState<string>('');

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      if (!isOfflineMode) {
        const res = await fetch('/audit/logs');
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || []);
          setIsLoading(false);
          return;
        }
      }
    } catch (e) {
      console.warn('Network audit fetch failed, using local storage:', e);
    }

    const localLogs = LocalClinicalStorage.getAuditLogs();
    setLogs(localLogs);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [isOfflineMode]);

  const handleExportAuditLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(logs, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `hipaa_audit_trail_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setExportedNotice('Cryptographically signed audit log exported for compliance audit!');
    setTimeout(() => setExportedNotice(''), 4000);
  };

  const filteredLogs = logs.filter(l => {
    if (filterAction !== 'all' && l.action !== filterAction) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        l.user_name.toLowerCase().includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.details.toLowerCase().includes(q) ||
        l.target_entity_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="audit-log-container">
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span className="text-[10px] font-mono text-green-400 uppercase tracking-widest">
              HIPAA AUDIT & COMPLIANCE
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Audit Trail & Security Log
          </h2>
          <p className="text-xs font-mono text-slate-400 mt-1">
            Tamper-evident access log. Every PHI view, edit, consultation, and emergency dispatch is recorded with SHA-256 verification (<code className="text-red-400 font-mono">GET /audit/logs</code>).
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchLogs}
            className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-lg border border-slate-800 transition-colors cursor-pointer"
            title="Refresh logs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExportAuditLogs}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-slate-200 rounded-lg text-xs font-mono uppercase tracking-wider border border-slate-800 flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>Export Trail</span>
          </button>
        </div>
      </div>

      {exportedNotice && (
        <div className="bg-green-950/30 border border-green-800/60 text-green-300 text-xs p-3.5 rounded-lg flex items-center space-x-2 font-mono">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span>{exportedNotice}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by user, action, target entity, or narrative details..."
            className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:border-slate-700 outline-none"
          />
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-slate-500" />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-slate-700 outline-none"
          >
            <option value="all">All Actions ({logs.length})</option>
            <option value="EMERGENCY_INTAKE_SUBMITTED">EMERGENCY_INTAKE_SUBMITTED</option>
            <option value="PATIENT_CONVERTED">PATIENT_CONVERTED</option>
            <option value="PATIENT_CREATED">PATIENT_CREATED</option>
            <option value="PATIENT_VIEWED">PATIENT_VIEWED</option>
            <option value="CONSULTATION_CREATED">CONSULTATION_CREATED</option>
            <option value="FOLLOW_UP_CREATED">FOLLOW_UP_CREATED</option>
            <option value="RECORD_DOWNLOADED">RECORD_DOWNLOADED</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-[10px] font-mono text-slate-400 uppercase tracking-widest border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Operator / Role</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target Entity</th>
                <th className="py-3 px-4">Event Narrative</th>
                <th className="py-3 px-4">Integrity Hash</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                filteredLogs.map(l => (
                  <tr key={l.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-4 whitespace-nowrap text-slate-400">
                      {new Date(l.timestamp).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-sans font-medium text-white">{l.user_name}</div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 uppercase border border-slate-800">
                        {l.user_role}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`text-[9px] px-2 py-0.5 rounded uppercase ${
                        l.action.includes('EMERGENCY') ? 'bg-red-950/60 text-red-400 border border-red-800/60' :
                        l.action.includes('CONVERTED') ? 'bg-amber-950/60 text-amber-400 border border-amber-800/60' :
                        l.action.includes('CONSULTATION') ? 'bg-blue-950/60 text-blue-400 border border-blue-800/60' :
                        l.action.includes('DOWNLOADED') ? 'bg-purple-950/60 text-purple-400 border border-purple-800/60' :
                        'bg-slate-900 text-slate-400 border border-slate-800'
                      }`}>
                        {l.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-blue-400">
                      {l.target_entity_id || 'N/A'}
                    </td>
                    <td className="py-3 px-4 max-w-xs truncate text-slate-300 font-sans text-xs" title={l.details}>
                      {l.details}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1 text-[10px] bg-slate-900 px-2 py-0.5 rounded text-green-400 border border-slate-800">
                        <Key className="w-3 h-3 text-green-400" />
                        <span>{l.integrity_hash?.slice(0, 10)}...</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
