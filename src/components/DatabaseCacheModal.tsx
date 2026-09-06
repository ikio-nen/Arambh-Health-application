import React, { useState, useEffect } from 'react';
import { 
  Database, Zap, ShieldCheck, RefreshCw, CheckCircle2, 
  AlertCircle, Cpu, Clock, Terminal, BookOpen, Layers,
  Trash2, HardDrive, ArrowUpRight, Copy, Check
} from 'lucide-react';
import { secureLocalDB } from '../services/secureLocalDatabase';
import { aiModelCacheService, AiCacheStats } from '../services/aiModelCacheService';
import { DatabaseStats, SyncQueueItem } from '../types';

interface DatabaseCacheModalProps {
  isOpen: boolean;
  onClose: () => void;
  isOfflineMode: boolean;
}

export const DatabaseCacheModal: React.FC<DatabaseCacheModalProps> = ({
  isOpen,
  onClose,
  isOfflineMode,
}) => {
  const [activeTab, setActiveTab] = useState<'database' | 'ai_cache' | 'docs'>('database');
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [cacheStats, setCacheStats] = useState<AiCacheStats | null>(null);
  const [pendingSyncs, setPendingSyncs] = useState<SyncQueueItem[]>([]);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncResultMsg, setSyncResultMsg] = useState<string>('');
  
  // Interactive Cache Tester
  const [testQuery, setTestQuery] = useState<string>('Cardiac arrest patient with no pulse and unconscious');
  const [testResult, setTestResult] = useState<any | null>(null);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [copiedDoc, setCopiedDoc] = useState<boolean>(false);

  const loadData = async () => {
    try {
      const stats = await secureLocalDB.getStats();
      setDbStats(stats);
      const queue = await secureLocalDB.getPendingSyncs();
      setPendingSyncs(queue);
    } catch (e) {
      console.warn('Could not load DB stats:', e);
    }
    setCacheStats(aiModelCacheService.getCacheStats());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    setSyncResultMsg('');
    const res = await secureLocalDB.syncWithServer();
    setIsSyncing(false);
    if (res.errors.length > 0) {
      setSyncResultMsg(`Sync partially completed: ${res.syncedCount} synced, ${res.errors.join('; ')}`);
    } else {
      setSyncResultMsg(`Successfully synchronized ${res.syncedCount} pending records to central hospital server!`);
    }
    await loadData();
  };

  const handleTestCacheQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testQuery.trim()) return;

    setIsTesting(true);
    const start = performance.now();
    const result = await aiModelCacheService.getFirstAidGuidance(testQuery, isOfflineMode);
    const elapsed = Math.round(performance.now() - start);
    setTestResult({ ...result, measured_latency_ms: elapsed });
    setIsTesting(false);
    setCacheStats(aiModelCacheService.getCacheStats());
  };

  const handleClearAiCache = () => {
    aiModelCacheService.clearCache();
    setCacheStats(aiModelCacheService.getCacheStats());
    setTestResult(null);
  };

  const handlePrepopulateProtocols = () => {
    const count = aiModelCacheService.precacheProtocols();
    setCacheStats(aiModelCacheService.getCacheStats());
    setSyncResultMsg(`Pre-compiled ${count} emergency clinical protocols into L1 memory cache!`);
    setTimeout(() => setSyncResultMsg(''), 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Secure Local Database & AI Model Caching Engine
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-950/60 border border-green-800 text-green-400 uppercase">
                  HIPAA Secured
                </span>
              </div>
              <p className="text-xs font-mono text-slate-400 mt-0.5">
                Embedded IndexedDB storage with AES-256-GCM encryption and multi-tier offline AI caching.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg p-1.5 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center space-x-2 border-b border-slate-800 text-xs font-mono pb-2">
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center space-x-2 cursor-pointer transition-colors ${
              activeTab === 'database' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Embedded Database</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_cache')}
            className={`px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center space-x-2 cursor-pointer transition-colors ${
              activeTab === 'ai_cache' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>AI Model Caching</span>
          </button>

          <button
            onClick={() => setActiveTab('docs')}
            className={`px-3 py-1.5 rounded-lg uppercase tracking-wider flex items-center space-x-2 cursor-pointer transition-colors ${
              activeTab === 'docs' 
                ? 'bg-blue-600 text-white font-bold' 
                : 'text-slate-400 hover:text-white hover:bg-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Architecture & How to Use</span>
          </button>
        </div>

        {/* Sync Feedback Message */}
        {syncResultMsg && (
          <div className="p-3 bg-blue-950/40 border border-blue-800 text-blue-300 rounded-lg text-xs font-mono flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <span>{syncResultMsg}</span>
          </div>
        )}

        {/* TAB 1: EMBEDDED DATABASE */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {/* Encryption & Security Specs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Database Engine</div>
                <div className="text-sm font-bold text-white font-mono">IndexedDB (Wasm/WebCrypto)</div>
                <div className="text-[11px] text-green-400 font-mono">ACID Transactional Support</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Encryption Standard</div>
                <div className="text-sm font-bold text-white font-mono">AES-256-GCM</div>
                <div className="text-[11px] text-slate-400 font-mono">PBKDF2 Hardware Vault Key</div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Sync Status</div>
                <div className="text-sm font-bold text-white font-mono flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${pendingSyncs.length === 0 ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}></span>
                  <span>{pendingSyncs.length === 0 ? 'All Synced' : `${pendingSyncs.length} Queued for Push`}</span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  Last Sync: {dbStats?.last_sync_timestamp || 'Active'}
                </div>
              </div>
            </div>

            {/* Tables & Record Counts */}
            <div>
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400 mb-2">
                Local Database Tables / Object Stores:
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {dbStats?.tables.map(tbl => (
                  <div key={tbl.name} className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg">
                    <div className="text-[10px] font-mono text-slate-400 truncate">{tbl.name}</div>
                    <div className="text-xl font-bold font-mono text-white mt-1">{tbl.count}</div>
                    <div className="text-[9px] font-mono text-blue-400 mt-0.5">Encrypted Rows</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Synchronization Queue Section */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-white">Offline Synchronization Queue</h4>
                  <p className="text-xs text-slate-400 font-mono">
                    Emergency intakes or profile conversions created offline are queued and auto-synced upon reconnect.
                  </p>
                </div>
                <button
                  onClick={handleTriggerSync}
                  disabled={isSyncing || pendingSyncs.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'Synchronizing...' : 'Sync Pending Data Now'}</span>
                </button>
              </div>

              {pendingSyncs.length === 0 ? (
                <div className="p-4 bg-slate-950 border border-slate-800/80 rounded-lg text-center text-xs font-mono text-slate-400">
                  <CheckCircle2 className="w-5 h-5 text-green-400 mx-auto mb-1" />
                  No pending offline mutations. Local embedded database is completely synchronized with server.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {pendingSyncs.map(item => (
                    <div key={item.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded text-xs font-mono flex items-center justify-between">
                      <div>
                        <span className="text-amber-400 font-bold uppercase">{item.operation}</span> on <span className="text-white">{item.table_name}</span>
                        <div className="text-[10px] text-slate-500">Ref ID: {item.entity_id} • Queued: {new Date(item.created_at).toLocaleTimeString()}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60 uppercase">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: AI MODEL CACHING SERVICE */}
        {activeTab === 'ai_cache' && (
          <div className="space-y-6">
            {/* Cache Performance Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Total Queries</div>
                <div className="text-2xl font-bold text-white font-mono mt-1">{cacheStats?.totalQueries || 0}</div>
                <div className="text-[10px] text-slate-500 font-mono">Offline + Online</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Cache Hit Rate</div>
                <div className="text-2xl font-bold text-green-400 font-mono mt-1">{cacheStats?.hitRatePercent || 100}%</div>
                <div className="text-[10px] text-slate-500 font-mono">{cacheStats?.cacheHits || 0} Hits / {cacheStats?.cacheMisses || 0} Misses</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Latency Saved</div>
                <div className="text-2xl font-bold text-blue-400 font-mono mt-1">{cacheStats?.savedLatencyMs || 0}ms</div>
                <div className="text-[10px] text-slate-500 font-mono">Zero LLM wait time</div>
              </div>

              <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl">
                <div className="text-[10px] font-mono text-slate-400 uppercase">Cached Protocols</div>
                <div className="text-2xl font-bold text-purple-400 font-mono mt-1">{cacheStats?.cachedEntriesCount || 0}</div>
                <div className="text-[10px] text-slate-500 font-mono">L1 Memory + L2 DB</div>
              </div>
            </div>

            {/* Cache Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrepopulateProtocols}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-mono text-slate-300 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-blue-400" />
                <span>Re-seed 12 L1 Emergency Protocols</span>
              </button>
              <button
                onClick={handleClearAiCache}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-mono text-red-400 flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Flush AI Cache</span>
              </button>
            </div>

            {/* Interactive Cache Query Tester */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-white">Live AI Caching Resolution Tester</h4>
                <p className="text-xs text-slate-400 font-mono">
                  Input a condition to observe whether it is served by L1 Protocol Memory, L2 Local Database, or L3 Gemini Cloud with measured latency.
                </p>
              </div>

              <form onSubmit={handleTestCacheQuery} className="flex gap-2">
                <input
                  type="text"
                  value={testQuery}
                  onChange={(e) => setTestQuery(e.target.value)}
                  placeholder="e.g. Grandma is clutching throat and choking, cannot speak"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:border-slate-700 outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={isTesting}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center space-x-1.5 cursor-pointer"
                >
                  {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                  <span>Test Resolution</span>
                </button>
              </form>

              {testResult && (
                <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3 font-mono text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Source:</span>
                      <span className="px-2 py-0.5 rounded bg-blue-950/60 border border-blue-800 text-blue-300 font-bold">
                        {testResult.source}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-slate-400">Resolution Latency:</span>
                      <span className="text-green-400 font-bold">{testResult.measured_latency_ms}ms</span>
                      <span className="text-slate-500">• Cached: {testResult.cached ? 'YES' : 'NO'}</span>
                    </div>
                  </div>

                  <div>
                    <div className="text-white font-bold text-sm">{testResult.primary_condition}</div>
                    <div className="text-amber-400 text-[11px] mt-0.5">Triage Tag: {testResult.triage_tag.toUpperCase()} • {testResult.urgency}</div>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Step-by-Step Instructions ({testResult.first_aid_steps.length} Steps):</div>
                    {testResult.first_aid_steps.map((st: any, idx: number) => (
                      <div key={idx} className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] space-y-0.5 font-sans">
                        <strong className="text-white font-mono">Step {st.step_number}: {st.title}</strong>
                        <p className="text-slate-300">{st.action}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: DOCUMENTATION & HOW TO USE */}
        {activeTab === 'docs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-mono uppercase tracking-widest text-slate-400">
                Integration Architecture & Code Examples
              </h4>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(aiModelCacheService.getUsageDocumentation());
                  setCopiedDoc(true);
                  setTimeout(() => setCopiedDoc(false), 2000);
                }}
                className="text-xs font-mono text-blue-400 hover:text-blue-300 flex items-center space-x-1 cursor-pointer"
              >
                {copiedDoc ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedDoc ? 'Copied' : 'Copy Guide'}</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 max-h-96 overflow-y-auto text-xs text-slate-300 font-mono leading-relaxed space-y-4">
              <div>
                <strong className="text-white text-sm">1. Architecture Overview:</strong>
                <p className="text-slate-400 mt-1 font-sans">
                  The application uses an embedded transactional database (<code className="text-blue-400">IndexedDB</code>) combined with an AES-256-GCM encryption layer to satisfy HIPAA audit requirements. In offline situations, all intakes are stored locally and marked in a <code className="text-amber-400">sync_queue</code>. When network connectivity is re-established, the sync engine batches updates to <code className="text-green-400">POST /api/sync/batch</code>.
                </p>
              </div>

              <div>
                <strong className="text-white text-sm">2. AI Caching Hierarchy:</strong>
                <ul className="list-disc list-inside text-slate-400 mt-1 space-y-1 font-sans">
                  <li><strong className="text-slate-200">L1 Protocol Memory:</strong> 12 pre-compiled gold-standard clinical protocols for instant 0ms access offline.</li>
                  <li><strong className="text-slate-200">L2 Local Cache:</strong> Normalized hash keys with 7-day TTL stored in local device storage.</li>
                  <li><strong className="text-slate-200">L3 Model Cache:</strong> Server-side in-memory proxy at <code className="text-blue-400">/api/ai/first-aid</code> that caches Gemini 2.5 Flash responses to save costs.</li>
                </ul>
              </div>

              <div>
                <strong className="text-white text-sm">3. Code Usage:</strong>
                <pre className="p-3 bg-slate-950 rounded border border-slate-800 text-[11px] text-blue-300 overflow-x-auto">
{`// Retrieve step-by-step guidance with automatic caching
import { aiModelCacheService } from './services/aiModelCacheService';

const result = await aiModelCacheService.getFirstAidGuidance(
  "Patient collapsed clutching chest, profuse sweating"
);

console.log(result.source); // 'L1_OFFLINE_PROTOCOL' or 'L3_SERVER_GEMINI_CACHE'
console.log(result.latency_ms); // ~1ms
console.log(result.first_aid_steps);`}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800 text-xs font-mono text-slate-500">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-green-400" />
            <span>ENCRYPTED LOCAL-FIRST STORAGE • HIPAA COMPLIANT</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-mono uppercase cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
