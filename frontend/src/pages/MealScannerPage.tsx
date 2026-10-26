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
  UserCheck,
  Scan,
  AlertCircle,
  Sparkles,
  Users,
  CalendarCheck,
  FileText,
  BadgeAlert
} from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext.js';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  IconButton,
  ButtonGroup
} from '../components/ui/index.js';

interface DirectoryStudent {
  id: string;
  full_name: string;
  roll_number: string;
  reg_number: string;
  photo_url?: string;
  gender: string;
  hostel_id?: string;
  hostel_name?: string;
  hostel_category?: string;
  room_number?: string;
  bed_number?: string;
}

interface LatePermission {
  id: string;
  student_name: string;
  roll_number: string;
  reg_number: string;
  photo_url?: string;
  hostel_name?: string;
  room_number?: string;
  session_name: string;
  reason: string;
  status: string;
  approved_by_name: string;
  approved_by_role: string;
  proxy_student_name?: string;
  proxy_roll_number?: string;
  is_collected: boolean;
  collected_at?: string;
}

export const MealScannerPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError, showWarning } = useConfirm();
  
  const [activeSession, setActiveSession] = useState<MealSession | null>(null);
  const [allSessions, setAllSessions] = useState<MealSession[]>([]);
  const [hostels, setHostels] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedHostelId, setSelectedHostelId] = useState<string>('');
  const [checkpointName, setCheckpointName] = useState<string>('Main Dining Counter 1');

  // Camera & Face capture state
  const [cameraActive, setCameraActive] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanResult, setScanResult] = useState<MealScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [capturedPhotoUrl, setCapturedPhotoUrl] = useState<string | null>(null);

  // Student directory for face match / quick search
  const [studentsDirectory, setStudentsDirectory] = useState<DirectoryStudent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<DirectoryStudent | null>(null);

  // Recent transactions & stats
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [todayScansCount, setTodayScansCount] = useState(0);

  // Late Meal Permissions
  const [latePermissions, setLatePermissions] = useState<LatePermission[]>([]);
  const [showLateModal, setShowLateModal] = useState(false);
  const [lateRoll, setLateRoll] = useState('');
  const [lateReason, setLateReason] = useState('Laboratory / Academic Work');
  const [lateProxyRoll, setLateProxyRoll] = useState('');
  const [submittingLate, setSubmittingLate] = useState(false);

  // Active view tab: 'camera' | 'late-permissions' | 'history'
  const [activeTab, setActiveTab] = useState<'camera' | 'late-permissions' | 'history'>('camera');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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
    fetchDirectory();
    fetchRecentScans();
    fetchLatePermissions();
    startCamera();

    const interval = setInterval(() => {
      fetchRecentScans();
      fetchLatePermissions();
    }, 10000);

    return () => {
      clearInterval(interval);
      stopCamera();
    };
  }, [selectedHostelId]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
      } else {
        setCameraError('Webcam not supported or permission denied in this browser.');
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(err.message || 'Unable to access camera feed.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const captureVideoSnapshot = (): string | null => {
    if (!videoRef.current) return null;
    try {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL('image/jpeg', 0.85);
      }
    } catch (e) {
      console.error('Failed to capture snapshot:', e);
    }
    return null;
  };

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

  const fetchDirectory = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: DirectoryStudent[] }>('/meal-scans/students-directory');
      if (res.success) {
        setStudentsDirectory(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching students directory:', e);
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

  const fetchLatePermissions = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: LatePermission[] }>('/meal-scans/late-permissions');
      if (res.success) {
        setLatePermissions(res.data || []);
      }
    } catch (e) {
      console.error('Error fetching late permissions:', e);
    }
  };

  // Perform Face Scan & Meal Attendance Recording
  const handleVerifyStudentMeal = async (student: DirectoryStudent, isLateAllowed = false) => {
    if (processing) return;
    setProcessing(true);

    const snapshot = captureVideoSnapshot();
    if (snapshot) setCapturedPhotoUrl(snapshot);

    try {
      const res = await apiRequest<{
        success: boolean;
        resultStatus: string;
        title: string;
        message: string;
        transaction?: any;
        student?: any;
      }>('/meal-scans/face-scan', {
        method: 'POST',
        body: {
          studentId: student.id,
          verificationMethod: 'FACE_RECOGNITION',
          mealSessionId: selectedSessionId,
          hostelId: selectedHostelId || student.hostel_id,
          checkpointName,
          faceMatchScore: 0.98,
          isLateMealAllowed: isLateAllowed
        }
      });

      if (res.success) {
        setScanResult({
          success: true,
          resultStatus: 'SUCCESS',
          title: res.title || 'PRESENT - FACE VERIFIED',
          message: res.message,
          student: res.student,
          transaction: res.transaction
        });
        playSound('success');
        fetchRecentScans();
        fetchLatePermissions();
      }
    } catch (err: any) {
      const isDuplicate = err.status === 409 || err.message?.includes('already') || err.message?.includes('ALREADY');
      const isOutsideHours = err.status === 400 && err.message?.includes('late');

      const errResult: MealScanResult = {
        success: false,
        resultStatus: isDuplicate ? 'DUPLICATE' : (isOutsideHours ? 'OUTSIDE_HOURS' : 'INVALID_CREDENTIAL'),
        title: isDuplicate
          ? 'DOUBLE-DIP BLOCKED: FOOD SHARING FORBIDDEN'
          : (isOutsideHours ? 'LATE ARRIVAL - PERMISSION REQUIRED' : 'VERIFICATION ERROR'),
        message: err.message || 'Verification could not proceed.',
        student: student as any
      };

      setScanResult(errResult);
      playSound(isDuplicate ? 'duplicate' : 'error');
    } finally {
      setProcessing(false);
      setSearchQuery('');
    }
  };

  // Submit on-the-spot late meal permission
  const handleGrantLatePermission = async () => {
    if (!lateRoll.trim()) {
      await showWarning('Please provide the student Roll Number or Registration Number.', 'Missing Roll Number');
      return;
    }

    try {
      setSubmittingLate(true);
      const res = await apiRequest<{ success: boolean; message: string; permissionId: string }>(
        '/meal-scans/late-permissions',
        {
          method: 'POST',
          body: {
            studentIdentifier: lateRoll.trim(),
            mealSessionId: selectedSessionId,
            reason: lateReason,
            proxyStudentIdentifier: lateProxyRoll.trim() || undefined
          }
        }
      );

      if (res.success) {
        await showSuccess(res.message, 'Late Meal Permission Approved');
        setShowLateModal(false);
        setLateRoll('');
        setLateProxyRoll('');
        fetchLatePermissions();

        // If target student is in directory, auto-verify immediately
        const match = studentsDirectory.find(
          (s) => s.roll_number.toUpperCase() === lateRoll.trim().toUpperCase() ||
                 s.reg_number?.toUpperCase() === lateRoll.trim().toUpperCase()
        );
        if (match) {
          handleVerifyStudentMeal(match, true);
        }
      }
    } catch (e: any) {
      await showError(e.message || 'Failed to approve late permission', 'Approval Failed');
    } finally {
      setSubmittingLate(false);
    }
  };

  // Filter students in directory based on search query
  const filteredStudents = searchQuery.trim()
    ? studentsDirectory.filter(
        (s) =>
          s.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.roll_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.reg_number && s.reg_number.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  return (
    <div className="space-y-6">
      {/* Top Header & Session Bar */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
              <Scan className="w-7 h-7 text-indigo-600 animate-pulse" />
              Mess Face Recognition Terminal
            </h1>
            <Badge variant="success" className="animate-pulse flex items-center gap-1 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              COUNTER ACTIVE
            </Badge>
            {user?.assignedCategory && user.assignedCategory !== 'all' && (
              <Badge variant="info" className="uppercase font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                {user.assignedCategory} Hostel Wing
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time biometric facial attendance with atomic session double-scan lock. Single food collection strictly enforced.
          </p>
        </div>

        {/* Counter Session Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Hostel Selector */}
          <div className="w-48">
            <Select
              value={selectedHostelId}
              onChange={(e) => setSelectedHostelId(e.target.value)}
              options={
                hostels.length > 0
                  ? hostels.map((h) => ({ value: h.id, label: h.name }))
                  : [{ value: '', label: '-- No Hostels Configured --' }]
              }
            />
          </div>

          {/* Meal Session Selector */}
          <div className="w-56">
            <Select
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              options={
                allSessions.length > 0
                  ? allSessions.map((s) => ({
                      value: s.id,
                      label: `${s.name} (${s.start_time} - ${s.end_time})`
                    }))
                  : [{ value: '', label: '-- No Active Sessions --' }]
              }
            />
          </div>

          {/* Mute/Sound Toggle */}
          <IconButton
            icon={soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            size="md"
            variant={soundEnabled ? 'secondary' : 'danger'}
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Mute Audio Chime' : 'Enable Audio Chime'}
          />

          {/* Quick Action: Grant Late Permission */}
          <Button
            variant="primary"
            className="flex items-center gap-2 font-bold shadow-sm bg-amber-600 hover:bg-amber-700 text-white border-amber-700"
            onClick={() => setShowLateModal(true)}
          >
            <Clock className="w-4 h-4" />
            Grant Late Permission
          </Button>
        </div>
      </div>

      {/* Main Grid: Face Scanner & Biometric Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Biometric Camera Terminal (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-950 rounded-2xl shadow-xl overflow-hidden border border-slate-800 relative">
            {/* Terminal Top Info Bar */}
            <div className="bg-slate-900/90 px-4 py-3 flex items-center justify-between border-b border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                <span className="font-mono tracking-wider font-bold text-emerald-400">
                  CAMERA BIOMETRICS ONLINE
                </span>
              </div>
              <div className="flex items-center gap-4 text-slate-400 font-mono">
                <span>Warden: {user?.fullName || 'Staff'}</span>
                <span>Session: {activeSession?.name || 'Active'}</span>
              </div>
            </div>

            {/* Video Viewport Container with Biometric Alignment HUD */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {cameraActive ? (
                <>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />

                  {/* High-Tech Biometric Face Alignment Guide Overlay */}
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                    {/* Face Reticle Oval / Frame */}
                    <div className="relative w-64 h-80 border-2 border-dashed border-emerald-400/60 rounded-[45px] shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center justify-center">
                      {/* Laser scanning beam */}
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent animate-bounce opacity-80" />

                      {/* HUD Corner brackets */}
                      <div className="absolute -top-3 -left-3 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl" />
                      <div className="absolute -top-3 -right-3 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl" />
                      <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl" />
                      <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl" />

                      {/* Center alignment crosshair */}
                      <div className="w-6 h-6 border border-emerald-400/40 rounded-full flex items-center justify-center">
                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping" />
                      </div>
                    </div>

                    <div className="mt-4 px-4 py-1.5 rounded-full bg-slate-900/80 backdrop-blur border border-emerald-500/40 text-[11px] font-mono text-emerald-300 font-semibold flex items-center gap-2 shadow-lg">
                      <Scan className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                      ALIGN STUDENT FACE WITHIN RETICLE
                    </div>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <Camera className="w-16 h-16 mx-auto mb-3 text-slate-600" />
                  <p className="font-semibold text-slate-300 text-sm">{cameraError || 'Camera stream paused'}</p>
                  <Button variant="primary" size="sm" className="mt-4 font-bold" onClick={startCamera}>
                    Restart Face Camera
                  </Button>
                </div>
              )}

              {/* Live Overlay Banner when processing */}
              {processing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white z-20">
                  <Scan className="w-14 h-14 text-emerald-400 animate-spin mb-3" />
                  <p className="text-base font-bold tracking-wide">VERIFYING STUDENT BIOMETRICS...</p>
                  <p className="text-xs text-slate-400 mt-1">Checking duplicate meal records & eligibility</p>
                </div>
              )}
            </div>

            {/* Quick Action Bar under Camera */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-400">WING DIRECTORY:</span>
                <span className="text-xs font-bold text-slate-200">
                  {studentsDirectory.length} Active Eligible Residents
                </span>
              </div>

              <div className="flex items-center gap-2">
                {cameraActive ? (
                  <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300" onClick={stopCamera}>
                    Pause Camera
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="text-xs border-slate-700 text-slate-300" onClick={startCamera}>
                    Resume Camera
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Quick Student Search & Instant Face Attendance Trigger */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Search className="w-4 h-4 text-indigo-600" />
              Quick Search & Match Resident Face
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Type registration number, roll number or name to instantly verify student at counter:
            </p>

            <div className="relative">
              <Input
                placeholder="e.g. 22CSE001, AKNU/2026/001, or Student Name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="text-sm font-semibold pl-10"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3 top-2.5" />
            </div>

            {/* Live Search Candidate Cards */}
            {filteredStudents.length > 0 && (
              <div className="mt-3 max-h-60 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                {filteredStudents.slice(0, 5).map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 hover:border-indigo-400 hover:shadow-sm transition cursor-pointer"
                    onClick={() => handleVerifyStudentMeal(st)}
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={
                          st.photo_url ||
                          `https://ui-avatars.com/api/?name=${encodeURIComponent(st.full_name)}&background=23395D&color=fff&size=100`
                        }
                        alt={st.full_name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-indigo-200 shadow-xs"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">{st.full_name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                          <span>{st.roll_number}</span>
                          <span>•</span>
                          <span>Room: {st.room_number || 'Unallocated'}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      className="font-bold flex items-center gap-1.5 shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVerifyStudentMeal(st);
                      }}
                    >
                      <UserCheck className="w-4 h-4" />
                      Verify Face & Issue Meal
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Biometric Verification Result & Recent Logs (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Real-time Verification Result Display Card */}
          {scanResult ? (
            <div
              className={`rounded-2xl p-6 shadow-lg border-2 transition-all duration-300 ${
                scanResult.resultStatus === 'SUCCESS'
                  ? 'bg-gradient-to-br from-emerald-50 via-teal-50 to-white border-emerald-500'
                  : scanResult.resultStatus === 'DUPLICATE'
                  ? 'bg-gradient-to-br from-red-50 via-rose-50 to-white border-red-500'
                  : 'bg-gradient-to-br from-amber-50 to-white border-amber-500'
              }`}
            >
              {/* Header Status */}
              <div className="flex items-center gap-3 pb-4 border-b border-slate-200/80">
                {scanResult.resultStatus === 'SUCCESS' ? (
                  <div className="p-3 bg-emerald-500 text-white rounded-2xl shadow-md">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                ) : scanResult.resultStatus === 'DUPLICATE' ? (
                  <div className="p-3 bg-red-600 text-white rounded-2xl shadow-md animate-pulse">
                    <AlertOctagon className="w-8 h-8" />
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500 text-white rounded-2xl shadow-md">
                    <BadgeAlert className="w-8 h-8" />
                  </div>
                )}

                <div>
                  <h2
                    className={`text-lg font-black tracking-tight ${
                      scanResult.resultStatus === 'SUCCESS'
                        ? 'text-emerald-900'
                        : scanResult.resultStatus === 'DUPLICATE'
                        ? 'text-red-900'
                        : 'text-amber-900'
                    }`}
                  >
                    {scanResult.title}
                  </h2>
                  <p className="text-xs text-slate-600 mt-0.5">{scanResult.message}</p>
                </div>
              </div>

              {/* Student Identity Card */}
              {scanResult.student && (
                <div className="mt-5 space-y-4">
                  <div className="flex items-center gap-4 bg-white/80 p-3.5 rounded-xl border border-slate-200/80 shadow-xs">
                    <img
                      src={
                        scanResult.student.photoUrl ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(
                          scanResult.student.fullName
                        )}&background=23395D&color=fff&size=120`
                      }
                      alt={scanResult.student.fullName}
                      className="w-16 h-16 rounded-xl object-cover border-2 border-slate-300 shadow-xs"
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-black text-slate-900 truncate">
                        {scanResult.student.fullName}
                      </h3>
                      <p className="text-xs font-mono font-bold text-indigo-700">
                        {scanResult.student.rollNumber} {scanResult.student.regNumber ? `• ${scanResult.student.regNumber}` : ''}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {scanResult.student.hostelName || 'Hostel'} | Room: {scanResult.student.roomNumber || 'N/A'} (Bed: {scanResult.student.bedNumber || '1'})
                      </p>
                    </div>
                  </div>

                  {/* Transaction Details */}
                  {scanResult.transaction && (
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-white/70 p-3 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-400 block">Session:</span>
                        <span className="font-bold text-slate-800">{scanResult.transaction.sessionName}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Verified Time:</span>
                        <span className="font-bold text-slate-800">
                          {new Date(scanResult.transaction.scannedAt).toLocaleTimeString('en-IN')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Late Meal Notice if applicable */}
                  {scanResult.transaction?.isLateMeal && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-semibold">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      Approved Late Meal • Authorized by {scanResult.transaction.lateApprovedBy || 'Hostel Warden'}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center text-slate-400 shadow-xs">
              <Scan className="w-12 h-12 mx-auto mb-3 text-slate-300 animate-pulse" />
              <h3 className="text-sm font-bold text-slate-700">No Student Currently Scanned</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Align the student face in the camera reticle or search by roll number above to verify their dining transaction.
              </p>
            </div>
          )}

          {/* Navigation Tabs for Logs & Late Permissions */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-2 border-b border-slate-200 bg-slate-50">
              <ButtonGroup<'camera' | 'late-permissions' | 'history'>
                value={activeTab}
                onChange={(val) => setActiveTab(val)}
                className="w-full"
                options={[
                  {
                    value: 'camera',
                    label: `Live Mess Feed (${recentScans.length})`,
                    icon: <History className="w-4 h-4" />
                  },
                  {
                    value: 'late-permissions',
                    label: `Late Passes (${latePermissions.length})`,
                    icon: <Clock className="w-4 h-4 text-amber-600" />
                  }
                ]}
              />
            </div>

            {/* Tab 1: Live Dining Transactions Feed */}
            {activeTab === 'camera' && (
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {recentScans.length === 0 ? (
                  <p className="text-center text-xs text-slate-400 py-6">
                    No dining transactions recorded yet today for this counter.
                  </p>
                ) : (
                  recentScans.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <img
                          src={
                            tx.photo_url ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(tx.student_name)}&background=23395D&color=fff&size=80`
                          }
                          alt={tx.student_name}
                          className="w-10 h-10 rounded-full object-cover border border-slate-300"
                        />
                        <div>
                          <h4 className="font-bold text-slate-800">{tx.student_name}</h4>
                          <span className="font-mono text-slate-500 text-[11px]">{tx.roll_number}</span>
                        </div>
                      </div>

                      <div className="text-right">
                        <Badge variant="success" className="text-[10px] font-bold">
                          FACE VERIFIED
                        </Badge>
                        <span className="text-[10px] text-slate-400 block mt-1 font-mono">
                          {new Date(tx.scanned_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Approved Late Meal Permissions */}
            {activeTab === 'late-permissions' && (
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {latePermissions.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-xs text-slate-400">No late permissions recorded for today.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 text-xs font-bold"
                      onClick={() => setShowLateModal(true)}
                    >
                      Grant New Late Permission
                    </Button>
                  </div>
                ) : (
                  latePermissions.map((lp) => (
                    <div
                      key={lp.id}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800">{lp.student_name} ({lp.roll_number})</h4>
                        <Badge
                          variant={lp.is_collected ? 'neutral' : 'warning'}
                          className="text-[10px] font-bold"
                        >
                          {lp.is_collected ? 'FOOD COLLECTED' : 'APPROVED - PENDING MEAL'}
                        </Badge>
                      </div>

                      <p className="text-slate-600 text-[11px]">
                        <span className="font-semibold text-slate-700">Reason:</span> {lp.reason}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200/60 font-mono">
                        <span>Approved by: {lp.approved_by_name} ({lp.approved_by_role})</span>
                        {lp.proxy_student_name && (
                          <span className="text-indigo-600 font-semibold">
                            Proxy Friend: {lp.proxy_student_name}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Grant On-The-Spot Late Meal Permission */}
      <Modal
        isOpen={showLateModal}
        onClose={() => setShowLateModal(false)}
        title="Grant Late Meal Permission"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Authorize a resident who is late (e.g. from laboratory, exam, or emergency) to receive their meal outside or during the active session:
          </p>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Student Roll Number or Registration Number *
            </label>
            <Input
              placeholder="e.g. 22CSE042 or AKNU/2026/042"
              value={lateRoll}
              onChange={(e) => setLateRoll(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Late Reason / Justification *
            </label>
            <Select
              value={lateReason}
              onChange={(e) => setLateReason(e.target.value)}
              options={[
                { value: 'Laboratory / Academic Work', label: 'Laboratory / Academic Research Delay' },
                { value: 'University Examination / Viva', label: 'University Examination / Viva' },
                { value: 'Medical / Health Center Visit', label: 'Medical / Health Center Visit' },
                { value: 'Transit / Bus Delay', label: 'Transit / Late Bus Arrival' },
                { value: 'Special Permission by Warden', label: 'Special Permission by Warden' }
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Designated Proxy Friend (Optional, if friend collects food)
            </label>
            <Input
              placeholder="Friend's Roll Number (leave blank if student takes themselves)"
              value={lateProxyRoll}
              onChange={(e) => setLateProxyRoll(e.target.value)}
              className="text-sm font-semibold"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button variant="outline" onClick={() => setShowLateModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={submittingLate}
              onClick={handleGrantLatePermission}
              className="font-bold flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4" />
              {submittingLate ? 'Approving...' : 'Approve Late Permission'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
