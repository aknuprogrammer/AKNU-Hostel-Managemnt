import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../services/api.js';
import { MealScanResult, MealSession } from '../types.js';
import {
  Camera,
  CheckCircle2,
  AlertOctagon,
  Clock,
  History,
  Search,
  Volume2,
  VolumeX,
  RotateCcw,
  ShieldAlert,
  Building,
  UserCheck
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { useConfirm } from '../context/ConfirmContext.js';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge
} from '../components/ui/index.js';

export const MealScannerPage: React.FC = () => {
  const { user } = useAuth();
  const { confirm, showSuccess, showError, showWarning } = useConfirm();
  const [activeSession, setActiveSession] = useState<MealSession | null>(null);
  const [allSessions, setAllSessions] = useState<MealSession[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [checkpointName, setCheckpointName] = useState<string>('Main Dining Counter 1');

  // Scanner state
  const [scanning, setScanning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanResult, setScanResult] = useState<MealScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [todayScansCount, setTodayScansCount] = useState(0);

  // Recent transactions
  const [recentScans, setRecentScans] = useState<any[]>([]);

  // Manual Roll Number Override modal
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideRoll, setOverrideRoll] = useState('');
  const [overrideReason, setOverrideReason] = useState('QR Camera / Phone Unreadable');

  // Correction / Reversal modal
  const [reversalTx, setReversalTx] = useState<any | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);

  // Web Audio synth for instant audible feedback
  const playSound = (type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      if (type === 'success') {
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1320, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'duplicate') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.setValueAtTime(180, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } else {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      }
    } catch (e) {
      // AudioContext not allowed before user gesture
    }
  };

  useEffect(() => {
    fetchHostels();
    fetchSessionInfo();
    fetchRecentScans();
    const interval = setInterval(fetchRecentScans, 10000);
    return () => {
      clearInterval(interval);
      stopCameraScanner();
    };
  }, [selectedHostelId]);

  const fetchHostels = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/hostels');
      if (res.success) {
        setHostels(res.data);
        if (res.data.length > 0) {
          setSelectedHostelId((prev) => prev || res.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to load hostels:', e);
    }
  };

  const fetchSessionInfo = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: { activeSession: MealSession; allSessions: MealSession[] } }>(
        '/meal-scans/active-session'
      );
      if (res.success) {
        setActiveSession(res.data.activeSession);
        setAllSessions(res.data.allSessions);
        if (res.data.activeSession) {
          setSelectedSessionId(res.data.activeSession.id);
        } else if (res.data.allSessions.length > 0) {
          setSelectedSessionId(res.data.allSessions[0].id);
        }
      }
    } catch (e) {
      console.error('Error fetching session info:', e);
    }
  };

  const fetchRecentScans = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>(
        `/meal-scans/recent-scans?hostelId=${selectedHostelId}&limit=15`
      );
      if (res.success) {
        setRecentScans(res.data);
        setTodayScansCount(res.data.length);
      }
    } catch (e) {
      console.error('Error fetching recent scans:', e);
    }
  };

  // Process a QR Scan Submission
  const handleScanToken = async (qrToken: string) => {
    if (processing || !qrToken) return;
    setProcessing(true);

    try {
      const res = await apiRequest<{ success: boolean; result: MealScanResult }>('/meal-scans/verify-scan', {
        method: 'POST',
        body: {
          qrToken,
          mealSessionId: selectedSessionId,
          hostelId: selectedHostelId,
          checkpointName
        }
      });

      if (res.success) {
        setScanResult(res.result);
        if (res.result.resultStatus === 'SUCCESS') {
          playSound('success');
        } else if (res.result.resultStatus === 'DUPLICATE') {
          playSound('duplicate');
        } else {
          playSound('error');
        }
        fetchRecentScans();
      }
    } catch (err: any) {
      const errResult: MealScanResult = {
        success: false,
        resultStatus: err.status === 409 ? 'DUPLICATE' : 'INVALID_CREDENTIAL',
        title: err.status === 409 ? 'ALREADY SCANNED / DOUBLE-DIP DETECTED' : 'VERIFICATION ERROR',
        message: err.message || 'Verification could not proceed.'
      };
      setScanResult(errResult);
      playSound(err.status === 409 ? 'duplicate' : 'error');
    } finally {
      setProcessing(false);
      setManualToken('');
    }
  };

  const startCameraScanner = async () => {
    try {
      setScanning(true);
      const html5QrCode = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        (decodedText) => {
          handleScanToken(decodedText);
        },
        () => {}
      );
    } catch (err) {
      await showError('Unable to access camera: ' + err, 'Camera Access Error');
      setScanning(false);
    }
  };

  const stopCameraScanner = async () => {
    if (html5QrCodeRef.current && scanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (e) {
        // ignore
      }
      setScanning(false);
    }
  };

  // Manual Roll Number Override
  const handleManualOverride = async () => {
    if (!overrideRoll || !overrideReason) {
      await showWarning('Roll number and justification reason are required', 'Missing Information');
      return;
    }

    try {
      const res = await apiRequest<{ success: boolean; message: string; data: any }>('/meal-scans/manual-override', {
        method: 'POST',
        body: {
          rollNumber: overrideRoll.trim(),
          mealSessionId: selectedSessionId,
          hostelId: selectedHostelId,
          checkpointName,
          overrideReason
        }
      });

      if (res.success) {
        playSound('success');
        await showSuccess(res.message, 'Manual Override Logged');
        setShowOverrideModal(false);
        setOverrideRoll('');
        fetchRecentScans();
      }
    } catch (e: any) {
      playSound('error');
      await showError('Manual override rejected: ' + e.message, 'Override Rejected');
    }
  };

  // Transaction Reversal
  const handleReverseTransaction = async () => {
    if (!reversalTx || !reversalReason) {
      await showWarning('Please provide a justification reason for the reversal', 'Justification Required');
      return;
    }

    const confirmed = await confirm({
      title: 'Reverse Meal Transaction',
      message: `Are you sure you want to reverse this meal attendance record for roll ${reversalTx.student_roll}? This will adjust dining counts and record audit reversal.`,
      confirmText: 'Confirm Reversal',
      variant: 'warning'
    });
    if (!confirmed) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string }>('/meal-scans/correct-transaction', {
        method: 'POST',
        body: {
          transactionId: reversalTx.id,
          newStatus: 'REVERSED',
          reason: reversalReason
        }
      });

      if (res.success) {
        await showSuccess(res.message, 'Transaction Reversed');
        setReversalTx(null);
        setReversalReason('');
        fetchRecentScans();
      }
    } catch (e: any) {
      await showError('Reversal failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Session Controls */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900">Warden Meal Scanning Terminal</h1>
            <Badge variant="success" dot>
              High-Volume Counter Mode
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric & cryptographic QR verification with atomic double-scan locks.
          </p>
        </div>

        {/* Hostel & Session Selector Form */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-56">
            <Select
              value={selectedHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              options={
                hostels.length > 0
                  ? hostels.map((h) => ({
                      value: h.id,
                      label: `${h.name} (${h.code})`
                    }))
                  : [{ value: '', label: '-- No Hostels Configured --' }]
              }
            />
          </div>

          <div className="w-56">
            <Select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              options={allSessions.map((s) => ({
                value: s.id,
                label: `${s.name} (${s.start_time} - ${s.end_time})`
              }))}
            />
          </div>

          <Button
            variant={soundEnabled ? 'primary' : 'secondary'}
            size="md"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Audio Feedback Enabled' : 'Audio Muted'}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* SCAN RESULT PROMINENT BANNER */}
      {scanResult && (
        <div
          className={`rounded-lg p-6 shadow-xl border-2 transition-all transform animate-in fade-in zoom-in-95 duration-200 ${
            scanResult.resultStatus === 'SUCCESS'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 text-white border-emerald-400'
              : scanResult.resultStatus === 'DUPLICATE'
              ? 'bg-gradient-to-r from-rose-700 to-red-800 text-white border-red-400 ring-4 ring-red-400/30'
              : 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border-amber-400'
          }`}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm flex-shrink-0">
                {scanResult.resultStatus === 'SUCCESS' ? (
                  <CheckCircle2 className="w-10 h-10 text-white" />
                ) : (
                  <AlertOctagon className="w-10 h-10 text-white animate-bounce" />
                )}
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-white/80 block">
                  Result: {scanResult.resultStatus}
                </span>
                <h2 className="text-2xl font-black tracking-tight">{scanResult.title}</h2>
                <p className="text-sm text-white/90 mt-1 max-w-xl">{scanResult.message}</p>

                {scanResult.student && (
                  <div className="mt-3 flex items-center gap-3 bg-black/20 px-3 py-2 rounded-md w-fit">
                    <span className="font-bold text-sm">{scanResult.student.fullName}</span>
                    <span className="font-mono text-xs bg-white/20 px-2 py-0.5 rounded font-bold">
                      {scanResult.student.rollNumber}
                    </span>
                    {scanResult.student.hostelName && (
                      <span className="text-xs text-white/80">• {scanResult.student.hostelName}</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={() => setScanResult(null)}
              className="self-end md:self-center"
            >
              Ready Next
            </Button>
          </div>
        </div>
      )}

      {/* Main Scanner Section Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Camera Viewport & Test Simulation */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 rounded-lg p-6 text-white border border-slate-800 shadow-xl overflow-hidden relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Mess Camera Feed
                </span>
              </div>
              <span className="text-xs font-mono text-slate-400">FPS: 10 • Auto-Lock</span>
            </div>

            {/* Camera Viewport */}
            <div className="relative aspect-video rounded-lg bg-slate-900 border-2 border-slate-800 flex flex-col items-center justify-center overflow-hidden">
              <div id="qr-reader" className="w-full h-full" />

              {!scanning && (
                <div className="text-center p-6 space-y-3">
                  <div className="w-16 h-16 rounded-lg bg-slate-800 text-slate-400 flex items-center justify-center mx-auto border border-slate-700">
                    <Camera className="w-8 h-8 text-amber-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">Camera Inactive</h4>
                    <p className="text-xs text-slate-400 mt-1 max-w-xs">
                      Enable device camera for real-time barcode scanning, or enter student credentials directly below.
                    </p>
                  </div>
                  <Button
                    onClick={startCameraScanner}
                    variant="primary"
                    size="md"
                  >
                    Start Camera Scanner
                  </Button>
                </div>
              )}

              {scanning && (
                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-center bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-md text-xs">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Scanning Active... Point student QR at camera
                  </span>
                  <button
                    onClick={stopCameraScanner}
                    className="text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40"
                  >
                    Stop Camera
                  </button>
                </div>
              )}
            </div>

            {/* Manual QR Token Input */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block mb-2">
                Manual Token Verification
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Input
                    placeholder="Paste signed cryptographic QR credential token here (aknu_v1...)"
                    value={manualToken}
                    onChange={(e) => setManualToken(e.target.value)}
                  />
                </div>
                <Button
                  disabled={processing || !manualToken}
                  onClick={() => handleScanToken(manualToken)}
                  variant="secondary"
                >
                  Verify
                </Button>
              </div>
            </div>
          </div>

          {/* Authorized Warden Manual Override Button */}
          <div className="bg-amber-50 rounded-lg p-4 border border-amber-200 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold">
                <Search className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">Student Phone Dead / QR Unreadable?</h4>
                <p className="text-[11px] text-amber-700">Warden authorized manual student search & override entry.</p>
              </div>
            </div>
            <Button
              onClick={() => setShowOverrideModal(true)}
              variant="accent"
              size="sm"
            >
              Manual Override
            </Button>
          </div>
        </div>

        {/* Right Column: Live Counters & Recent Transactions Stream */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                Session Counter
              </span>
              <h3 className="text-3xl font-black text-slate-900 mt-1">{todayScansCount}</h3>
              <p className="text-xs text-slate-500 mt-0.5">Verified dining transactions</p>
            </div>
            <div className="text-right">
              <Badge variant="success" dot>
                Counter 1 Online
              </Badge>
              <p className="text-[11px] text-slate-400 mt-1">Staff: {user?.fullName}</p>
            </div>
          </div>

          <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col h-[520px]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-slate-400" />
                <h3 className="text-sm font-bold text-slate-800">Recent Mess Scan Log</h3>
              </div>
              <button onClick={fetchRecentScans} className="text-slate-400 hover:text-slate-600 p-1">
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {recentScans.length > 0 ? (
                recentScans.map((tx) => (
                  <div
                    key={tx.id}
                    className="p-3 rounded-md bg-slate-50 hover:bg-slate-100/80 border border-slate-200/70 transition flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-xs text-slate-700">
                        {tx.student_name ? tx.student_name.charAt(0) : 'S'}
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">
                          {tx.student_name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                          <span>{tx.roll_number}</span>
                          <span>•</span>
                          <span>{new Date(tx.scanned_at).toLocaleTimeString('en-IN')}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Badge variant={tx.status === 'SUCCESS' ? 'success' : 'danger'}>
                        {tx.status}
                      </Badge>
                      {['super_admin', 'chief_warden', 'hostel_warden'].includes(user?.role || '') && (
                        <button
                          onClick={() => setReversalTx(tx)}
                          className="text-[10px] text-slate-400 hover:text-red-600 font-semibold"
                          title="Correct or reverse mistake transaction"
                        >
                          Correct
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-16 text-slate-400 text-xs">
                  No meal transactions recorded yet today for this counter.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL: MANUAL OVERRIDE */}
      <Modal
        isOpen={showOverrideModal}
        onClose={() => setShowOverrideModal(false)}
        title="Authorized Manual Meal Override"
        size="md"
        icon={<UserCheck className="w-5 h-5 text-amber-500" />}
      >
        <div className="space-y-3.5">
          <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
            Record a meal entry when a student cannot produce their digital QR credential. An audit log is permanently created.
          </p>

          <Input
            label="Student University Roll Number *"
            placeholder="Enter Student Roll Number (e.g. 22CSE001)"
            value={overrideRoll}
            onChange={(e) => setOverrideRoll(e.target.value.toUpperCase())}
          />

          <Input
            label="Mandatory Justification Reason *"
            placeholder="e.g. Student phone low battery, verified physically with hostel ID"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
          />

          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <Button
              variant="secondary"
              onClick={() => setShowOverrideModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={handleManualOverride}
            >
              Confirm & Record
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: TRANSACTION REVERSAL / CORRECTION */}
      <Modal
        isOpen={!!reversalTx}
        onClose={() => setReversalTx(null)}
        title="Correct / Reverse Meal Transaction"
        size="md"
        icon={<ShieldAlert className="w-5 h-5 text-rose-500" />}
      >
        {reversalTx && (
          <div className="space-y-3.5">
            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
              Reversing transaction for <strong className="text-slate-800">{reversalTx.student_name}</strong> ({reversalTx.roll_number}). This does not delete history; an audit trail is preserved.
            </p>

            <Input
              label="Reversal Reason *"
              placeholder="e.g. Accidental scan duplicate or wrong student token"
              value={reversalReason}
              onChange={(e) => setReversalReason(e.target.value)}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                variant="secondary"
                onClick={() => setReversalTx(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleReverseTransaction}
              >
                Confirm Reversal
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
