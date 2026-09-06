import React, { useState, useEffect } from 'react';
import { 
  Radio, Wifi, WifiOff, RefreshCw, Send, ShieldAlert, Cpu, 
  Layers, CheckCircle2, AlertTriangle, ArrowRight, Zap, Play, Pause, 
  Clock, Shield, Activity, Bluetooth
} from 'lucide-react';
import { 
  bluetoothHoppingService, 
  BluetoothChannel, 
  MeshNode, 
  HopPacket 
} from '../services/bluetoothHopping';

interface BluetoothHoppingPanelProps {
  isOfflineMode: boolean;
  onPacketRelayed?: (packet: HopPacket) => void;
}

export const BluetoothHoppingPanel: React.FC<BluetoothHoppingPanelProps> = ({ 
  isOfflineMode, 
  onPacketRelayed 
}) => {
  const [channels, setChannels] = useState<BluetoothChannel[]>(bluetoothHoppingService.getChannels());
  const [nodes, setNodes] = useState<MeshNode[]>(bluetoothHoppingService.getNodes());
  const [packets, setPackets] = useState<HopPacket[]>(bluetoothHoppingService.getPackets());
  const [activeChannel, setActiveChannel] = useState(bluetoothHoppingService.getCurrentChannel());
  const [isHopping, setIsHopping] = useState(bluetoothHoppingService.isEnabled());

  // Transmission form state
  const [payloadType, setPayloadType] = useState<HopPacket['payloadType']>('EMERGENCY_DISPATCH');
  const [customSummary, setCustomSummary] = useState<string>('Cardiac SOS Beacon - Immediate Paramedic Assistance Needed');
  const [isTransmitting, setIsTransmitting] = useState<boolean>(false);
  const [lastDeliveredPacket, setLastDeliveredPacket] = useState<HopPacket | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isScanningBt, setIsScanningBt] = useState<boolean>(false);

  // Subscribe to real-time engine updates
  useEffect(() => {
    const unsubscribe = bluetoothHoppingService.subscribe(() => {
      setChannels(bluetoothHoppingService.getChannels());
      setNodes(bluetoothHoppingService.getNodes());
      setPackets(bluetoothHoppingService.getPackets());
      setActiveChannel(bluetoothHoppingService.getCurrentChannel());
      setIsHopping(bluetoothHoppingService.isEnabled());
    });
    return unsubscribe;
  }, []);

  const handleToggleHopping = () => {
    bluetoothHoppingService.toggleHopping();
  };

  const handleTransmit = async () => {
    if (!customSummary.trim() || isTransmitting) return;

    setIsTransmitting(true);
    setStatusMessage('Broadcasting packet over 2.4 GHz Bluetooth Hopping channels...');

    try {
      const delivered = await bluetoothHoppingService.transmitPacket(
        payloadType,
        customSummary,
        {
          timestamp: new Date().toISOString(),
          isOffline: isOfflineMode,
          emergency_level: 'CODE_RED',
        }
      );

      setLastDeliveredPacket(delivered);
      setStatusMessage(`Packet ${delivered.packetId} reached Hospital Gateway across ${delivered.hopCount} hops in ${delivered.latencyMs}ms!`);
      if (onPacketRelayed) onPacketRelayed(delivered);
    } catch (err: any) {
      setStatusMessage(`Transmission error: ${err.message}`);
    } finally {
      setIsTransmitting(false);
    }
  };

  const handleScanRealDevices = async () => {
    setIsScanningBt(true);
    setStatusMessage('Opening Web Bluetooth hardware scanner...');
    const result = await bluetoothHoppingService.scanRealBluetoothDevices();
    setStatusMessage(result.message);
    setIsScanningBt(false);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8" id="bluetooth-hopping-view">
      {/* Sleek Black & Red Header */}
      <div className="border-b border-red-950/60 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center space-x-2 px-2.5 py-1 bg-red-950/50 border border-red-800/60 rounded-full mb-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
            <span className="text-[10px] font-mono uppercase tracking-widest text-red-400">
              OFF-GRID RF MESH PROTOCOL • 2.4 GHz ISM BAND
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight flex items-center space-x-3">
            <Radio className="w-8 h-8 text-red-500" />
            <span>Bluetooth Hopping Engine</span>
          </h2>
          <p className="text-neutral-400 text-sm mt-1 max-w-2xl">
            Adaptive Frequency Hopping Spread Spectrum (AFH) & multi-hop BLE mesh relay. Bypasses damaged cellular towers by hopping emergency packets peer-to-peer.
          </p>
        </div>

        {/* Quick Action Controls */}
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={handleToggleHopping}
            className={`px-4 py-2.5 rounded-lg border text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
              isHopping 
                ? 'bg-red-950/40 text-red-300 border-red-700/60 hover:bg-red-900/40' 
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            {isHopping ? <Pause className="w-3.5 h-3.5 text-red-400" /> : <Play className="w-3.5 h-3.5 text-green-400" />}
            <span>{isHopping ? 'Pause FHSS' : 'Resume Hopping'}</span>
          </button>

          <button
            type="button"
            onClick={handleScanRealDevices}
            disabled={isScanningBt}
            className="px-4 py-2.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-mono uppercase tracking-wider flex items-center space-x-2 transition-colors cursor-pointer"
          >
            <Bluetooth className={`w-3.5 h-3.5 text-blue-400 ${isScanningBt ? 'animate-spin' : ''}`} />
            <span>{isScanningBt ? 'Scanning...' : 'Pair BLE Beacon'}</span>
          </button>
        </div>
      </div>

      {/* Live Frequency Hopping Telemetry Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl">
          <span className="text-[10px] font-mono uppercase text-neutral-500">ACTIVE FREQUENCY</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {activeChannel.freq} <span className="text-xs text-red-500 font-normal">MHz</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">BLE Ch {activeChannel.index} ({activeChannel.index >= 37 ? 'Adv' : 'Data'})</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl">
          <span className="text-[10px] font-mono uppercase text-neutral-500">HOPPING VELOCITY</span>
          <div className="text-2xl font-black text-red-500 font-mono mt-1">
            {isHopping ? '10.0' : '0.0'} <span className="text-xs text-neutral-400 font-normal">hops/s</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">Spread Spectrum Cycle</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl">
          <span className="text-[10px] font-mono uppercase text-neutral-500">MESH TOPOLOGY</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {nodes.length} <span className="text-xs text-neutral-400 font-normal">Nodes</span>
          </div>
          <span className="text-[10px] font-mono text-green-400">All Nodes Synchronized</span>
        </div>

        <div className="bg-neutral-950 border border-neutral-900 p-4 rounded-xl">
          <span className="text-[10px] font-mono uppercase text-neutral-500">PACKETS RELAYED</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {packets.length} <span className="text-xs text-neutral-400 font-normal">Dispatches</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-400">CRC32 Zero Loss</span>
        </div>
      </div>

      {/* Multi-Hop Mesh Relay Visualizer */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-neutral-900 pb-4">
          <div className="flex items-center space-x-2">
            <Layers className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Live Mesh Relay Nodes (End-to-End Route)
            </h3>
          </div>
          <span className="text-xs font-mono text-neutral-400">Max Hops: 3 • Latency ~58ms</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
          {nodes.map((node, index) => {
            const isOrigin = index === 0;
            const isGateway = index === nodes.length - 1;
            const isTransmittingThisNode = node.status === 'transmitting';

            return (
              <div 
                key={node.id} 
                className={`p-4 rounded-xl border transition-all relative ${
                  isTransmittingThisNode 
                    ? 'bg-red-950/40 border-red-500 shadow-lg shadow-red-950/60 scale-[1.02]' 
                    : isGateway
                    ? 'bg-neutral-900/60 border-red-900/60'
                    : isOrigin
                    ? 'bg-neutral-900/80 border-neutral-700'
                    : 'bg-neutral-950 border-neutral-800'
                }`}
              >
                {/* Node type badge */}
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded ${
                    isOrigin 
                      ? 'bg-white text-black font-bold' 
                      : isGateway
                      ? 'bg-red-600 text-white font-bold'
                      : 'bg-neutral-800 text-neutral-300'
                  }`}>
                    {isOrigin ? 'HOP 0 (DISPATCHER)' : isGateway ? 'GATEWAY SINK' : `HOP ${index} RELAY`}
                  </span>
                  <div className="flex items-center space-x-1 text-xs font-mono text-neutral-400">
                    <Activity className="w-3 h-3 text-red-400" />
                    <span>{node.rssi} dBm</span>
                  </div>
                </div>

                <h4 className="text-sm font-bold text-white tracking-tight">{node.name}</h4>
                <p className="text-xs text-neutral-400 font-mono mt-1">
                  Range: {node.distanceMeters === 0 ? 'Local' : `~${node.distanceMeters}m`} • Bat: {node.batteryPercent}%
                </p>

                <div className="mt-3 pt-3 border-t border-neutral-900 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-neutral-500">HOP DELAY</span>
                  <span className="text-red-400 font-bold">+{node.hopDelayMs}ms</span>
                </div>

                {/* Arrow connector on desktop */}
                {index < nodes.length - 1 && (
                  <div className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-neutral-900 border border-neutral-700 items-center justify-center text-neutral-400">
                    <ArrowRight className="w-3 h-3 text-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 40-Channel Frequency Hopping Spectrum Display */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-900 pb-3">
          <div className="flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Bluetooth 2.4 GHz RF Channel Grid (40 Channels)
            </h3>
          </div>
          <div className="flex items-center space-x-4 text-xs font-mono">
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-red-600 animate-pulse"></span>
              <span className="text-neutral-300">Active Hop</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-neutral-800"></span>
              <span className="text-neutral-400">Clean</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-900"></span>
              <span className="text-neutral-400">Congested</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-20 gap-1.5 pt-2">
          {channels.map((chan) => {
            const isActive = chan.channelIndex === activeChannel.index;
            const isAdv = chan.type === 'advertising';

            return (
              <div
                key={chan.channelIndex}
                className={`p-2 rounded flex flex-col items-center justify-center text-center transition-all ${
                  isActive
                    ? 'bg-red-600 text-white font-bold scale-110 shadow-lg shadow-red-600/50 z-10 ring-2 ring-red-400'
                    : chan.status === 'jammed'
                    ? 'bg-red-950/20 border border-red-900/40 text-neutral-600'
                    : chan.status === 'congested'
                    ? 'bg-amber-950/30 border border-amber-800/40 text-amber-300'
                    : isAdv
                    ? 'bg-neutral-900 border border-neutral-700 text-neutral-300'
                    : 'bg-neutral-900/60 border border-neutral-800/60 text-neutral-400'
                }`}
                title={`Ch ${chan.channelIndex} (${chan.frequencyMHz} MHz) - ${chan.type.toUpperCase()}`}
              >
                <span className="text-[9px] font-mono leading-none">
                  {isAdv ? `ADV${chan.channelIndex}` : `CH${chan.channelIndex}`}
                </span>
                <span className="text-[8px] font-mono opacity-80 mt-1">
                  {chan.frequencyMHz}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Emergency Packet Transmitter & Hopping Log */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Transmitter Form */}
        <div className="lg:col-span-5 bg-neutral-950 border border-neutral-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center space-x-2 border-b border-neutral-900 pb-3">
            <Zap className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">
              Broadcast Emergency via BLE Mesh
            </h3>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                PACKET TYPE
              </label>
              <select
                value={payloadType}
                onChange={(e) => setPayloadType(e.target.value as any)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2.5 text-xs font-mono text-white focus:outline-none focus:border-red-600"
              >
                <option value="EMERGENCY_DISPATCH">EMERGENCY_DISPATCH (Case Intake)</option>
                <option value="SOS_BEACON">SOS_BEACON (Distress Beacon)</option>
                <option value="VITAL_TELEMETRY">VITAL_TELEMETRY (SpO2 / HR stream)</option>
                <option value="CHAT_MESSAGE">CHAT_MESSAGE (Off-grid Chat)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase text-neutral-400 mb-1">
                PACKET PAYLOAD / TRIAGE SUMMARY
              </label>
              <textarea
                rows={3}
                value={customSummary}
                onChange={(e) => setCustomSummary(e.target.value)}
                placeholder="Enter emergency distress packet content..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-3 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-red-600"
              />
            </div>

            <button
              type="button"
              onClick={handleTransmit}
              disabled={isTransmitting || !customSummary.trim()}
              className="w-full bg-red-600 hover:bg-red-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-bold py-3 px-4 rounded-lg text-xs font-mono uppercase tracking-wider flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-lg shadow-red-950/80"
            >
              {isTransmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Hopping across Bluetooth nodes...</span>
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  <span>Transmit via 2.4 GHz Hopping Mesh</span>
                </>
              )}
            </button>

            {statusMessage && (
              <p className="text-xs font-mono text-neutral-300 p-3 bg-neutral-900/80 border border-neutral-800 rounded-lg">
                {statusMessage}
              </p>
            )}
          </div>
        </div>

        {/* Live Hopping Packet Log */}
        <div className="lg:col-span-7 bg-neutral-950 border border-neutral-900 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-neutral-900 pb-3">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-red-500" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                Transmitted Mesh Packets & Routing Log
              </h3>
            </div>
            <span className="text-[10px] font-mono text-neutral-500">Live Buffer</span>
          </div>

          <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
            {packets.length === 0 ? (
              <div className="text-center py-12 text-neutral-500 text-xs font-mono">
                No packets transmitted yet. Tap "Transmit via 2.4 GHz Hopping Mesh" to start off-grid relay.
              </div>
            ) : (
              packets.map((pkt) => (
                <div 
                  key={pkt.packetId}
                  className="p-3.5 bg-neutral-900/70 border border-neutral-800 rounded-lg space-y-2 hover:border-neutral-700 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono text-red-400 font-bold">
                        {pkt.packetId}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 uppercase">
                        {pkt.payloadType}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2 text-[10px] font-mono">
                      <span className="text-green-400 flex items-center space-x-1">
                        <CheckCircle2 className="w-3 h-3 text-green-400" />
                        <span>{pkt.status.toUpperCase()}</span>
                      </span>
                      <span className="text-neutral-500">|</span>
                      <span className="text-neutral-400">+{pkt.latencyMs}ms</span>
                    </div>
                  </div>

                  <p className="text-xs text-neutral-200 font-medium">
                    {pkt.payloadSummary}
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono text-neutral-400">
                    <span>Hops: <strong className="text-white">{pkt.hopCount}/{pkt.maxHops}</strong></span>
                    <span>•</span>
                    <span>CRC: <strong className="text-neutral-300">{pkt.crc32}</strong></span>
                    <span>•</span>
                    <span>Channels Hopped: {pkt.channelsHopped.join(' ➔ ')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
