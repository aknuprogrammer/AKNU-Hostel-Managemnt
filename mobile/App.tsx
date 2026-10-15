import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  ActivityIndicator,
  Modal,
  Platform,
  Vibration,
  LogBox
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { mobileApiRequest, setMobileToken, getApiBaseUrl, setApiBaseUrl } from './src/config/api';
import { heritageTheme } from './src/config/heritageTheme';

// Silence non-breaking development warning overlays
LogBox.ignoreLogs([
  'SafeAreaView has been deprecated',
  'Cannot connect to Expo CLI'
]);

type AppRole = 'student' | 'warden' | 'security';

export default function App() {
  // Auth state
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [currentRole, setCurrentRole] = useState<AppRole>('student');
  const [authLoading, setAuthLoading] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [serverUrl, setServerUrl] = useState(getApiBaseUrl().replace('/api/v1', ''));
  const [showServerConfig, setShowServerConfig] = useState(false);

  // Active Meal Session state
  const [activeSession, setActiveSession] = useState<any | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  // Warden Scanner state
  const [permission, requestPermission] = useCameraPermissions();
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [manualCodeInput, setManualCodeInput] = useState('');
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanProcessing, setScanProcessing] = useState(false);
  const [sessionScansCount, setSessionScansCount] = useState(0);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const isCooldownLocked = useRef(false);

  // Student state
  const [studentLeaveReason, setStudentLeaveReason] = useState('');
  const [leaveDestination, setLeaveDestination] = useState('');
  const [submittingLeave, setSubmittingLeave] = useState(false);

  // Security state
  const [gateCode, setGateCode] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<any | null>(null);

  // Setup password state
  const [setupModalVisible, setSetupModalVisible] = useState(false);
  const [setupIdentifier, setSetupIdentifier] = useState('');
  const [setupTempPassword, setSetupTempPassword] = useState('');
  const [setupNewPassword, setSetupNewPassword] = useState('');
  const [setupConfirmPassword, setSetupConfirmPassword] = useState('');
  const [showSetupTemp, setShowSetupTemp] = useState(false);
  const [showSetupNew, setShowSetupNew] = useState(false);
  const [showSetupConfirm, setShowSetupConfirm] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  const handleSetupPassword = async () => {
    if (setupNewPassword.length < 6) {
      Alert.alert('Validation', 'New password must be at least 6 characters long.');
      return;
    }
    if (setupNewPassword !== setupConfirmPassword) {
      Alert.alert('Validation', 'New password and confirm password do not match.');
      return;
    }

    try {
      setSettingPassword(true);

      if (currentUser) {
        // Authenticated user changing password
        const res = await mobileApiRequest<{ success: boolean; message: string }>('/auth/change-password', {
          method: 'POST',
          body: {
            newPassword: setupNewPassword
          }
        });
        if (res.success) {
          Alert.alert('Success', 'Password updated successfully!');
          setSetupModalVisible(false);
          setSetupNewPassword('');
          setSetupConfirmPassword('');
        }
      } else {
        // Unauthenticated user setting up new password with temporary credentials
        if (!setupIdentifier.trim() || !setupTempPassword) {
          Alert.alert('Validation', 'Please provide email/roll number and temporary password from the login screen.');
          return;
        }

        const res = await mobileApiRequest<{ success: boolean; message: string; token?: string; user?: any }>('/auth/setup-password', {
          method: 'POST',
          body: {
            identifier: setupIdentifier.trim(),
            temporaryPassword: setupTempPassword,
            newPassword: setupNewPassword
          }
        });

        if (res.success) {
          Alert.alert('Success', 'Your new password has been set! You are now signed in.');
          const savedEmail = setupIdentifier.trim();
          const savedPass = setupNewPassword;
          setSetupModalVisible(false);
          setSetupTempPassword('');
          setSetupNewPassword('');
          setSetupConfirmPassword('');
          if (res.token && res.user) {
            setMobileToken(res.token);
            setCurrentUser(res.user);
            if (res.user.role === 'student') {
              setCurrentRole('student');
            } else if (res.user.role === 'security_staff' || res.user.role === 'security') {
              setCurrentRole('security');
            } else {
              setCurrentRole('warden');
            }
          } else {
            handleLogin(savedEmail, savedPass);
          }
        }
      }
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update password. Please verify credentials.');
    } finally {
      setSettingPassword(false);
    }
  };

  // Fetch session & recent scans whenever Warden screen is active
  useEffect(() => {
    if (currentUser && (currentRole === 'warden' || currentUser.role?.includes('warden') || currentUser.role === 'super_admin')) {
      fetchActiveSession();
      fetchRecentScans();
      const interval = setInterval(() => {
        fetchRecentScans();
      }, 8000); // 8s auto-refresh
      return () => clearInterval(interval);
    }
  }, [currentUser, currentRole]);

  // Fetch active meal session from backend
  const fetchActiveSession = async () => {
    try {
      setSessionLoading(true);
      const res = await mobileApiRequest<{ success: boolean; data: any }>('/meal-scans/active-session');
      if (res.success && res.data) {
        setActiveSession(res.data.activeSession);
      }
    } catch (e: any) {
      console.log('Session fetch error:', e.message);
    } finally {
      setSessionLoading(false);
    }
  };

  // Fetch recent scans for live counter & feed
  const fetchRecentScans = async () => {
    try {
      const res = await mobileApiRequest<{ success: boolean; data: any[] }>('/meal-scans/recent-scans?limit=10');
      if (res.success && Array.isArray(res.data)) {
        setRecentScans(res.data);
        setSessionScansCount(res.data.length);
      }
    } catch (e: any) {
      console.log('Recent scans error:', e.message);
    }
  };

  // Login handler
  const handleLogin = async (email?: string, password?: string) => {
    const loginEmail = (email || emailInput).trim();
    const loginPassword = password || passwordInput;

    if (!loginEmail || !loginPassword) {
      Alert.alert('Authentication', 'Please provide both email/roll number and password');
      return;
    }

    try {
      setAuthLoading(true);
      const res = await mobileApiRequest<{
        success: boolean;
        token?: string;
        user?: any;
        requiresPasswordChange?: boolean;
        identifier?: string;
        message?: string;
      }>('/auth/login', {
        method: 'POST',
        body: { email: loginEmail, password: loginPassword }
      });

      if (res.requiresPasswordChange) {
        setSetupIdentifier(loginEmail);
        setSetupTempPassword(loginPassword);
        setSetupModalVisible(true);
        return;
      }

      if (res.success && res.token) {
        setMobileToken(res.token);
        setCurrentUser(res.user);

        // Directly navigate to the user's respected module based on their backend role
        if (res.user.role === 'student') {
          setCurrentRole('student');
        } else if (res.user.role === 'security_staff' || res.user.role === 'security') {
          setCurrentRole('security');
        } else {
          setCurrentRole('warden');
        }
      }
    } catch (e: any) {
      Alert.alert('Login Failed', e.message || 'Could not connect to server at ' + getApiBaseUrl());
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    setMobileToken('');
    setCurrentUser(null);
    setScanResult(null);
    setRecentScans([]);
    setEmailInput('');
    setPasswordInput('');
  };

  // Process QR Scan (Triggered by camera or manual submission)
  const processScanToken = async (qrToken: string) => {
    const token = (qrToken || '').trim();
    if (!token || isCooldownLocked.current || scanProcessing) return;

    // Lock scanner to prevent duplicate bursts on same frame
    isCooldownLocked.current = true;
    setScanProcessing(true);

    try {
      const res = await mobileApiRequest<any>('/meal-scans/scan', {
        method: 'POST',
        body: {
          qrToken: token,
          checkpointName: 'Mobile Dining Counter',
          mealSessionId: activeSession?.id || undefined
        }
      });

      setScanResult(res);
      setScanModalVisible(true);

      if (res.resultStatus === 'SUCCESS') {
        Vibration.vibrate([0, 100, 50, 100]); // double beep vibe
        setSessionScansCount((prev) => prev + 1);
        fetchRecentScans();
      } else {
        Vibration.vibrate(400); // long warning vibe
      }
    } catch (e: any) {
      Alert.alert('Scan Failed', e.message || 'Network error processing scan');
    } finally {
      setScanProcessing(false);
      // Release lock after 2 seconds
      setTimeout(() => {
        isCooldownLocked.current = false;
      }, 2000);
    }
  };

  // Handle Camera Barcode Detection
  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (!scanModalVisible && !isCooldownLocked.current) {
      processScanToken(data);
    }
  };

  // Student submit leave
  const handleSubmitLeave = async () => {
    if (!studentLeaveReason || !leaveDestination) {
      Alert.alert('Validation', 'Please provide destination and reason');
      return;
    }
    try {
      setSubmittingLeave(true);
      const res = await mobileApiRequest<any>('/leave/apply', {
        method: 'POST',
        body: {
          leaveType: 'home',
          departureDate: new Date().toISOString().replace('T', ' ').substring(0, 19),
          returnDate: new Date(Date.now() + 86400000 * 3).toISOString().replace('T', ' ').substring(0, 19),
          destination: leaveDestination,
          reason: studentLeaveReason,
          guardianPhone: currentUser?.student?.guardian_phone || '9848099881'
        }
      });
      if (res.success) {
        Alert.alert('Leave Submitted', 'Your Out-Pass application has been forwarded to the Hostel Warden for digital clearance.');
        setStudentLeaveReason('');
        setLeaveDestination('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSubmittingLeave(false);
    }
  };

  // Security verify gate pass
  const handleVerifyGateCode = async () => {
    if (!gateCode) return;
    try {
      const res = await mobileApiRequest<any>(`/leave/gate-pass/${gateCode.trim()}`);
      if (res.success) {
        setVerifiedPass(res.data.pass);
      }
    } catch (e: any) {
      Alert.alert('Gate Check', 'Pass not found or invalid');
    }
  };

  const handleGateMovement = async (type: 'EXIT' | 'ENTRY') => {
    if (!verifiedPass) return;
    try {
      const res = await mobileApiRequest<any>('/leave/gate-movements', {
        method: 'POST',
        body: {
          gatePassId: verifiedPass.id,
          studentId: verifiedPass.student_id,
          movementType: type,
          checkpoint: 'Main University Campus Gate'
        }
      });
      if (res.success) {
        Alert.alert('Movement Logged', `Student ${type} recorded successfully in central university gate log.`);
        setVerifiedPass(null);
        setGateCode('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  // Helper for Student QR Token
  const studentQrToken =
    currentUser?.student?.qr_credential_token ||
    currentUser?.student?.roll_number ||
    'aknu_v1.default';

  // =========================================================================
  // VIEW: AUTHENTICATION / LOGIN SCREEN
  // =========================================================================
  if (!currentUser) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0f2744" />
        <ScrollView contentContainerStyle={styles.loginScroll}>
          {/* AKNU Header */}
          <View style={styles.loginHeader}>
            <View style={styles.logoBadge}>
              <Text style={styles.logoBadgeText}>AKNU</Text>
            </View>
            <Text style={styles.uniMainTitle}>ADIKAVI NANNAYA UNIVERSITY</Text>
            <Text style={styles.uniSubTitle}>Hostels Management System</Text>
          </View>

          {/* Login Card */}
          <View style={styles.loginCard}>
            <Text style={styles.loginCardTitle}>Sign In</Text>
            <Text style={styles.loginCardSub}>
              Enter your university email address or roll number to access your portal
            </Text>

            {/* Credential Inputs */}
            <Text style={styles.inputLabel}>University Email or Roll Number</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 22CSE042 or warden.boys@aknu.edu.in"
              placeholderTextColor="#9ca3af"
              value={emailInput}
              onChangeText={setEmailInput}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter password"
                placeholderTextColor="#9ca3af"
                value={passwordInput}
                onChangeText={setPasswordInput}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeBtn}
                accessibilityLabel="Toggle password visibility"
              >
                <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => handleLogin()}
              disabled={authLoading}
              style={[styles.primaryButton, authLoading && styles.disabledButton]}
            >
              {authLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Setup / Change Password Link */}
            <TouchableOpacity
              onPress={() => {
                if (!emailInput.trim() || !passwordInput) {
                  Alert.alert(
                    'Credentials Required',
                    'Please enter your University Email or Roll Number and your Temporary Password in the fields above first, then tap Change Password.'
                  );
                  return;
                }
                setSetupIdentifier(emailInput.trim());
                setSetupTempPassword(passwordInput);
                setSetupNewPassword('');
                setSetupConfirmPassword('');
                setSetupModalVisible(true);
              }}
              style={styles.setupLinkBtn}
            >
              
            </TouchableOpacity>

            {/* Server URL configuration toggle */}
            <TouchableOpacity
              onPress={() => setShowServerConfig(!showServerConfig)}
              style={styles.serverConfigToggle}
            >
              <Text style={styles.serverConfigToggleText}>
                ⚙️ Server Address: {getApiBaseUrl()}
              </Text>
            </TouchableOpacity>

            {showServerConfig && (
              <View style={styles.serverConfigBox}>
                <Text style={styles.inputLabel}>Backend Base URL (Host & Port)</Text>
                <TextInput
                  style={styles.input}
                  value={serverUrl}
                  onChangeText={(val) => {
                    setServerUrl(val);
                    setApiBaseUrl(val);
                  }}
                  placeholder="http://192.168.29.54:5000"
                  placeholderTextColor="#9ca3af"
                  autoCapitalize="none"
                />
                <View style={styles.serverPresetRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setServerUrl('http://192.168.29.54:5000');
                      setApiBaseUrl('http://192.168.29.54:5000');
                    }}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>Wi-Fi (192.168.29.54)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setServerUrl('http://10.0.2.2:5000');
                      setApiBaseUrl('http://10.0.2.2:5000');
                    }}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>Android (10.0.2.2)</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setServerUrl('http://localhost:5000');
                      setApiBaseUrl('http://localhost:5000');
                    }}
                    style={styles.presetChip}
                  >
                    <Text style={styles.presetChipText}>Localhost</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>

        {/* Modal: Setup / Change Password with Temporary Password (strictly New & Confirm Password) */}
        <Modal
          visible={setupModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSetupModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.setupCard}>
              <View style={styles.setupHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.setupTitle}>Setup New Password</Text>
                  <Text style={styles.setupSub}>Replace temporary credentials with private password</Text>
                </View>
                <TouchableOpacity onPress={() => setSetupModalVisible(false)} style={styles.setupCloseBtn}>
                  <Text style={styles.setupCloseBtnText}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ padding: 18 }}>
                {/* Account info pill */}
                <View style={styles.setupAccountPill}>
                  <View>
                    <Text style={styles.setupAccountLabel}>ACCOUNT</Text>
                    <Text style={styles.setupAccountVal}>{setupIdentifier || 'Current Student'}</Text>
                  </View>
                  <View style={styles.setupVerifiedBadge}>
                    <Text style={styles.setupVerifiedText}>✓ Temp Password Verified</Text>
                  </View>
                </View>

                {/* Field 1: New Password with Eye Icon */}
                <Text style={styles.inputLabel}>New Password (min 6 chars)</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Create your new private password"
                    placeholderTextColor="#9ca3af"
                    value={setupNewPassword}
                    onChangeText={setSetupNewPassword}
                    secureTextEntry={!showSetupNew}
                    autoFocus
                  />
                  <TouchableOpacity onPress={() => setShowSetupNew(!showSetupNew)} style={styles.eyeBtn}>
                    <Text style={styles.eyeBtnText}>{showSetupNew ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>

                {/* Field 2: Confirm New Password with Eye Icon */}
                <Text style={styles.inputLabel}>Confirm New Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder="Re-enter your new password"
                    placeholderTextColor="#9ca3af"
                    value={setupConfirmPassword}
                    onChangeText={setSetupConfirmPassword}
                    secureTextEntry={!showSetupConfirm}
                  />
                  <TouchableOpacity onPress={() => setShowSetupConfirm(!showSetupConfirm)} style={styles.eyeBtn}>
                    <Text style={styles.eyeBtnText}>{showSetupConfirm ? '👁️' : '🔒'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  onPress={handleSetupPassword}
                  disabled={settingPassword}
                  style={[styles.primaryButton, settingPassword && styles.disabledButton, { marginTop: 14 }]}
                >
                  {settingPassword ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save & Set New Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // =========================================================================
  // AUTHENTICATED PORTAL VIEW
  // =========================================================================
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f2744" />

      {/* Top University Header */}
      <View style={styles.appHeader}>
        <View style={styles.appHeaderTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appHeaderUni}>ADIKAVI NANNAYA UNIVERSITY</Text>
            <Text style={styles.appHeaderRole}>
              Logged in: <Text style={{ fontWeight: '700', color: '#f59e0b' }}>{currentUser.fullName}</Text> (
              {currentUser.roleDisplay || currentUser.role})
            </Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <TouchableOpacity
              onPress={() => {
                setSetupIdentifier(currentUser.email || currentUser?.student?.roll_number || '');
                setSetupTempPassword('');
                setSetupNewPassword('');
                setSetupConfirmPassword('');
                setSetupModalVisible(true);
              }}
              style={styles.changePasswordHeaderBtn}
            >
              <Text style={styles.changePasswordHeaderBtnText}>🔑 Password</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutBtnText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* =================================================================== */}
        {/* VIEW 1: CHIEF WARDEN & HOSTEL WARDEN MEAL SCANNER                   */}
        {/* =================================================================== */}
        {currentRole === 'warden' && (
          <View style={styles.section}>
            {/* Active Session Status Card */}
            <View style={styles.sessionCard}>
              <View style={styles.sessionHeaderRow}>
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveText}>
                    {activeSession ? `${activeSession.name.toUpperCase()} (SERVING NOW)` : 'MEAL SESSION ACTIVE'}
                  </Text>
                </View>

                <TouchableOpacity onPress={fetchActiveSession} style={styles.refreshBtn}>
                  <Text style={styles.refreshBtnText}>🔄 Refresh</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sessionTimeInfo}>
                {activeSession
                  ? `Window: ${activeSession.start_time} - ${activeSession.end_time}`
                  : 'Dining Counter Active • All Wings'}
              </Text>

              <View style={styles.sessionStatRow}>
                <View style={styles.sessionStatBox}>
                  <Text style={styles.sessionStatNum}>{sessionScansCount}</Text>
                  <Text style={styles.sessionStatLbl}>Meals Served Today</Text>
                </View>
                <View style={styles.sessionStatDivider} />
                <View style={styles.sessionStatBox}>
                  <Text style={[styles.sessionStatNum, { color: '#16a34a' }]}>100%</Text>
                  <Text style={styles.sessionStatLbl}>Real-time Sync</Text>
                </View>
              </View>
            </View>

            {/* Live Camera Scanner Viewport */}
            <View style={styles.scannerWrapper}>
              <View style={styles.scannerHeaderRow}>
                <Text style={styles.scannerTitle}>Focus Camera on Student QR</Text>
                <TouchableOpacity
                  onPress={() => setTorchEnabled(!torchEnabled)}
                  style={[styles.torchBtn, torchEnabled && styles.torchBtnActive]}
                >
                  <Text style={styles.torchBtnText}>{torchEnabled ? '🔦 Light ON' : '💡 Flashlight'}</Text>
                </TouchableOpacity>
              </View>

              {permission?.granted ? (
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={StyleSheet.absoluteFill}
                    facing="back"
                    enableTorch={torchEnabled}
                    barcodeScannerSettings={{
                      barcodeTypes: ['qr']
                    }}
                    onBarcodeScanned={scanProcessing ? undefined : handleBarcodeScanned}
                  />

                  {/* High Visibility Scanning Target Reticle */}
                  <View style={styles.reticleOverlay}>
                    <View style={styles.reticleBox}>
                      <View style={[styles.corner, styles.cornerTL]} />
                      <View style={[styles.corner, styles.cornerTR]} />
                      <View style={[styles.corner, styles.cornerBL]} />
                      <View style={[styles.corner, styles.cornerBR]} />
                      <View style={styles.scanLaser} />
                    </View>
                    <Text style={styles.reticleInstruction}>Align student QR code within frame</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.cameraPermissionBox}>
                  <Text style={styles.cameraPermTitle}>Camera Permission Required</Text>
                  <Text style={styles.cameraPermSub}>
                    Allow camera access to scan student meal credentials at dining counters.
                  </Text>
                  <TouchableOpacity onPress={requestPermission} style={styles.grantPermBtn}>
                    <Text style={styles.grantPermBtnText}>Enable Camera Scanner</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Quick Test / Manual Scan Entry (Fallback) */}
            <View style={styles.manualScanCard}>
              <Text style={styles.manualCardTitle}>Manual Scan or Roll Number Verification</Text>
              <Text style={styles.manualCardSub}>
                If camera is unavailable or screen is damaged, enter roll number or paste token:
              </Text>

              <View style={styles.manualInputRow}>
                <TextInput
                  style={styles.manualInput}
                  placeholder="Enter Roll Number (e.g. 22CSE042)"
                  placeholderTextColor="#9ca3af"
                  value={manualCodeInput}
                  onChangeText={setManualCodeInput}
                />
                <TouchableOpacity
                  onPress={() => {
                    processScanToken(manualCodeInput);
                    setManualCodeInput('');
                  }}
                  style={styles.manualSubmitBtn}
                >
                  <Text style={styles.manualSubmitBtnText}>Verify</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Recent Scans Live Feed */}
            <View style={styles.recentScansCard}>
              <View style={styles.recentHeader}>
                <Text style={styles.recentTitle}>Live Mess Feed (Last 10 Scans)</Text>
                <TouchableOpacity onPress={fetchRecentScans}>
                  <Text style={styles.recentRefresh}>Sync Now</Text>
                </TouchableOpacity>
              </View>

              {recentScans.length === 0 ? (
                <Text style={styles.emptyRecentText}>No students scanned in this session yet.</Text>
              ) : (
                recentScans.map((item, idx) => (
                  <View key={item.id || idx} style={styles.recentItemRow}>
                    <View style={styles.recentStudentBadge}>
                      <Text style={styles.recentStudentBadgeText}>
                        {item.student_name ? item.student_name.charAt(0) : 'S'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={styles.recentStudentName}>
                        {item.student_name || item.student?.full_name || 'Resident Student'}
                      </Text>
                      <Text style={styles.recentStudentMeta}>
                        Roll: {item.roll_number || item.student?.roll_number} • {item.session_name || 'Meal'}
                      </Text>
                    </View>
                    <View style={styles.recentTimeBadge}>
                      <Text style={styles.recentTimeText}>
                        {new Date(item.scanned_at || Date.now()).toLocaleTimeString('en-IN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* VIEW 2: STUDENT ONLY DIGITAL QR ID CARD & SCHEDULE                  */}
        {/* =================================================================== */}
        {currentRole === 'student' && (
          <View style={styles.section}>
            {/* Student ID Card: Text on Left, QR on Right, No Photo, No Reg Number */}
            <View style={styles.idCard}>
              {/* Card Ribbon */}
              <View style={styles.idCardHeader}>
                <Text style={styles.idCardUni}>ADIKAVI NANNAYA UNIVERSITY</Text>
                <Text style={styles.idCardSub}>Hostel Resident Official Digital Credential</Text>
              </View>

              {/* Card Body: Left Details, Right QR */}
              <View style={styles.idCardHorizontal}>
                {/* Left Side: All Text Details */}
                <View style={styles.idCardLeft}>
                  <Text style={styles.studentName}>
                    {currentUser?.student?.full_name || currentUser.fullName || 'Rahul Varma'}
                  </Text>

                  <View style={styles.rollBadgeRow}>
                    <Text style={styles.rollLabel}>Roll No:</Text>
                    <View style={styles.rollBadge}>
                      <Text style={styles.rollBadgeText}>
                        {currentUser?.student?.roll_number || '22CSE042'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.hostelBadgeCompact}>
                    <Text style={styles.hostelBadgeTextCompact}>
                      🏢 {currentUser?.student?.hostel_name || 'Godavari Bhavan (BH-1)'}
                    </Text>
                    <Text style={styles.hostelBadgeSub}>
                      Room {currentUser?.student?.room_number || '101'} • Bed {currentUser?.student?.bed_number || '1'}
                    </Text>
                  </View>

                  {/* Mess Status */}
                  <View
                    style={[
                      styles.messPillCompact,
                      currentUser?.student?.mess_eligibility !== false
                        ? styles.messPillActive
                        : styles.messPillInactive
                    ]}
                  >
                    <Text style={styles.messPillTextCompact}>
                      {currentUser?.student?.mess_eligibility !== false
                        ? '✓ MESS ACTIVE • ALL MEALS'
                        : '✕ MESS STATUS: SUSPENDED'}
                    </Text>
                  </View>
                </View>

                {/* Right Side: QR Code */}
                <View style={styles.idCardRight}>
                  <View style={styles.qrContainerCompact}>
                    <QRCode
                      value={studentQrToken}
                      size={130}
                      color="#0f2744"
                      backgroundColor="#ffffff"
                    />
                  </View>
                  <Text style={styles.qrFootnoteCompact}>HMAC-SHA256 Token</Text>
                  <Text style={styles.scanHint}>Scan at Dining Counter</Text>
                </View>
              </View>

              <View style={styles.idCardFooter}>
                <Text style={styles.idCardFooterText}>
                  💡 Keep screen brightness high when presenting at dining counter
                </Text>
              </View>
            </View>

            {/* Daily Mess Menu Schedule with updated timings */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.cardTitle, { marginBottom: 0 }]}>Today's Dining Schedule</Text>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#92400e', backgroundColor: '#fef3c7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 }}>
                  {currentUser?.student?.gender === 'female' || (currentUser?.student?.hostel_name || '').toLowerCase().includes('girl') ? 'Girls Dining Wing' : 'Boys Dining Wing'}
                </Text>
              </View>
              <View style={styles.menuRow}>
                <Text style={styles.menuMealName}>Breakfast (07:00 - 10:00)</Text>
                <Text style={styles.menuItems}>
                  {currentUser?.student?.gender === 'female' || (currentUser?.student?.hostel_name || '').toLowerCase().includes('girl')
                    ? 'Masala Dosa, Upma, Coconut Chutney, Sambar, Tea / Coffee'
                    : 'Idli, Medu Vada, Peanut Chutney, Sambar, Tea / Coffee'}
                </Text>
              </View>
              <View style={styles.menuDivider} />
              <View style={styles.menuRow}>
                <Text style={styles.menuMealName}>Lunch (12:00 - 15:00)</Text>
                <Text style={styles.menuItems}>
                  {currentUser?.student?.gender === 'female' || (currentUser?.student?.hostel_name || '').toLowerCase().includes('girl')
                    ? 'Steamed Rice, Palak Pappu, Mixed Veg Kurma, Majjiga Pulusu, Fresh Curd'
                    : 'Steamed Rice, Andhra Tomato Pappu, Aloo Fry, Sambar, Curd, Papad'}
                </Text>
              </View>
              <View style={styles.menuDivider} />
              <View style={styles.menuRow}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.menuMealName}>Snacks (16:30 - 18:00)</Text>
                  <Text style={styles.optionalBadge}>Optional</Text>
                </View>
                <Text style={styles.menuItems}>
                  {currentUser?.student?.gender === 'female' || (currentUser?.student?.hostel_name || '').toLowerCase().includes('girl')
                    ? 'Green Tea / Fresh Milk, Osmania Biscuits (Not currently serving)'
                    : 'Evening Tea / Coffee, Salted Biscuits (Not currently serving)'}
                </Text>
              </View>
              <View style={styles.menuDivider} />
              <View style={styles.menuRow}>
                <Text style={styles.menuMealName}>Dinner (19:00 - 22:30)</Text>
                <Text style={styles.menuItems}>
                  {currentUser?.student?.gender === 'female' || (currentUser?.student?.hostel_name || '').toLowerCase().includes('girl')
                    ? 'Phulka Roti, Paneer Butter Masala, Veg Biryani, Rasam, Curd'
                    : 'Phulka Chapati, Chana Masala, Jeera Rice, Rasam, Fresh Curd'}
                </Text>
              </View>
            </View>

            {/* Quick Out-Pass / Leave Application */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Out-Pass / Leave Request</Text>
              <TextInput
                placeholder="Destination City (e.g. Vijayawada, Vizag)"
                placeholderTextColor="#9ca3af"
                value={leaveDestination}
                onChangeText={setLeaveDestination}
                style={styles.input}
              />
              <TextInput
                placeholder="Reason for leaving campus"
                placeholderTextColor="#9ca3af"
                value={studentLeaveReason}
                onChangeText={setStudentLeaveReason}
                style={styles.input}
              />
              <TouchableOpacity
                onPress={handleSubmitLeave}
                disabled={submittingLeave}
                style={[styles.primaryButton, submittingLeave && styles.disabledButton]}
              >
                {submittingLeave ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Submit Leave Application</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* =================================================================== */}
        {/* VIEW 3: SECURITY GATE PASS VERIFIER                                 */}
        {/* =================================================================== */}
        {currentRole === 'security' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security Gate Pass Verification</Text>
              <TextInput
                placeholder="Enter Student Pass Code (e.g. GP-529182)"
                placeholderTextColor="#9ca3af"
                value={gateCode}
                onChangeText={setGateCode}
                style={styles.input}
                autoCapitalize="characters"
              />
              <TouchableOpacity onPress={handleVerifyGateCode} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Verify Gate Pass</Text>
              </TouchableOpacity>
            </View>

            {verifiedPass && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pass Details</Text>
                <Text style={styles.passDetailText}>
                  Student: <Text style={{ fontWeight: '700' }}>{verifiedPass.student_name}</Text> (
                  {verifiedPass.roll_number})
                </Text>
                <Text style={styles.passDetailText}>Destination: {verifiedPass.destination}</Text>
                <Text style={styles.passDetailText}>Reason: {verifiedPass.reason}</Text>

                <View style={styles.rowButtons}>
                  <TouchableOpacity
                    onPress={() => handleGateMovement('EXIT')}
                    style={[styles.primaryButton, { flex: 1, backgroundColor: '#dc2626' }]}
                  >
                    <Text style={styles.primaryButtonText}>Log Student Exit</Text>
                  </TouchableOpacity>
                  <View style={{ width: 10 }} />
                  <TouchableOpacity
                    onPress={() => handleGateMovement('ENTRY')}
                    style={[styles.primaryButton, { flex: 1, backgroundColor: '#16a34a' }]}
                  >
                    <Text style={styles.primaryButtonText}>Log Student Entry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ===================================================================== */}
      {/* MODAL: INSTANT SCAN RESULT MODAL OVERLAY                              */}
      {/* ===================================================================== */}
      <Modal
        visible={scanModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScanModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalCard,
              scanResult?.resultStatus === 'SUCCESS'
                ? styles.modalSuccessBorder
                : scanResult?.resultStatus === 'DUPLICATE'
                ? styles.modalDuplicateBorder
                : styles.modalErrorBorder
            ]}
          >
            {/* Result Header Badge */}
            <View
              style={[
                styles.resultBadge,
                scanResult?.resultStatus === 'SUCCESS'
                  ? styles.resultBadgeSuccess
                  : scanResult?.resultStatus === 'DUPLICATE'
                  ? styles.resultBadgeDuplicate
                  : styles.resultBadgeError
              ]}
            >
              <Text style={styles.resultBadgeIcon}>
                {scanResult?.resultStatus === 'SUCCESS' ? '✓' : '⚠️'}
              </Text>
              <Text style={styles.resultBadgeText}>
                {scanResult?.resultStatus === 'SUCCESS'
                  ? 'MEAL VERIFIED & RECORDED'
                  : scanResult?.resultStatus === 'DUPLICATE'
                  ? 'DUPLICATE SCAN DETECTED'
                  : 'VERIFICATION FAILED'}
              </Text>
            </View>

            {/* Student Identity Section */}
            {scanResult?.student ? (
              <View style={styles.modalStudentInfo}>
                <Text style={styles.modalStudentName}>{scanResult.student.fullName}</Text>
                <Text style={styles.modalStudentRoll}>
                  Roll No: {scanResult.student.rollNumber}
                </Text>
                <Text style={styles.modalStudentRoom}>
                  {scanResult.student.hostelName || 'Godavari Bhavan'} • Room{' '}
                  {scanResult.student.roomNumber || '101'}, Bed {scanResult.student.bedNumber || '1'}
                </Text>
              </View>
            ) : null}

            {/* Explanation Message */}
            <Text style={styles.modalMessage}>{scanResult?.message || scanResult?.error}</Text>

            {/* Close / Next Student Button */}
            <TouchableOpacity
              onPress={() => setScanModalVisible(false)}
              style={[
                styles.modalActionBtn,
                scanResult?.resultStatus === 'SUCCESS'
                  ? { backgroundColor: '#166534' }
                  : { backgroundColor: '#991b1b' }
              ]}
            >
              <Text style={styles.modalActionBtnText}>
                {scanResult?.resultStatus === 'SUCCESS' ? '✓ Scan Next Student' : 'Dismiss Alert'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Setup / Change Password for Authenticated User */}
      <Modal
        visible={setupModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSetupModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.setupCard}>
            <View style={styles.setupHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.setupTitle}>Setup New Password</Text>
                <Text style={styles.setupSub}>Update your account password</Text>
              </View>
              <TouchableOpacity onPress={() => setSetupModalVisible(false)} style={styles.setupCloseBtn}>
                <Text style={styles.setupCloseBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={{ padding: 18 }}>
              {/* Account info pill */}
              <View style={styles.setupAccountPill}>
                <View>
                  <Text style={styles.setupAccountLabel}>ACCOUNT</Text>
                  <Text style={styles.setupAccountVal}>{currentUser?.student?.roll_number || currentUser?.email || 'Logged In Account'}</Text>
                </View>
                <View style={styles.setupVerifiedBadge}>
                  <Text style={styles.setupVerifiedText}>✓ Session Authenticated</Text>
                </View>
              </View>

              {/* Field 1: New Password with Eye Icon */}
              <Text style={styles.inputLabel}>New Password (min 6 chars)</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Create your new private password"
                  placeholderTextColor="#9ca3af"
                  value={setupNewPassword}
                  onChangeText={setSetupNewPassword}
                  secureTextEntry={!showSetupNew}
                  autoFocus
                />
                <TouchableOpacity onPress={() => setShowSetupNew(!showSetupNew)} style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{showSetupNew ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>

              {/* Field 2: Confirm New Password with Eye Icon */}
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, { flex: 1, marginBottom: 0 }]}
                  placeholder="Re-enter your new password"
                  placeholderTextColor="#9ca3af"
                  value={setupConfirmPassword}
                  onChangeText={setSetupConfirmPassword}
                  secureTextEntry={!showSetupConfirm}
                />
                <TouchableOpacity onPress={() => setShowSetupConfirm(!showSetupConfirm)} style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{showSetupConfirm ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleSetupPassword}
                disabled={settingPassword}
                style={[styles.primaryButton, settingPassword && styles.disabledButton, { marginTop: 14 }]}
              >
                {settingPassword ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.primaryButtonText}>Save & Set New Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// =========================================================================
// STYLES
// =========================================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f2744',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    backgroundColor: '#f8fafc'
  },

  // Login Styles
  loginScroll: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#0f2744'
  },
  loginHeader: {
    alignItems: 'center',
    marginBottom: 24
  },
  logoBadge: {
    backgroundColor: '#f59e0b',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12
  },
  logoBadgeText: {
    color: '#0f2744',
    fontSize: 20,
    fontWeight: '900'
  },
  uniMainTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
    textAlign: 'center'
  },
  uniSubTitle: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 4,
    textAlign: 'center'
  },
  loginCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4
  },
  loginCardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f2744'
  },
  loginCardSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    marginBottom: 16
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 6,
    marginTop: 8
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f2744',
    marginBottom: 10
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingRight: 10,
    marginBottom: 12
  },
  eyeBtn: {
    padding: 8
  },
  eyeBtnText: {
    fontSize: 16
  },
  primaryButton: {
    backgroundColor: '#0f2744',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700'
  },
  serverConfigToggle: {
    alignSelf: 'center',
    marginTop: 16,
    paddingVertical: 4
  },
  serverConfigToggleText: {
    fontSize: 11,
    color: '#64748b',
    textDecorationLine: 'underline'
  },
  serverConfigBox: {
    marginTop: 10,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  serverPresetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6
  },
  presetChip: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4
  },
  presetChipText: {
    fontSize: 10,
    color: '#334155',
    fontWeight: '600'
  },

  // App Shell Header
  appHeader: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12
  },
  appHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  appHeaderUni: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.5
  },
  appHeaderRole: {
    fontSize: 11,
    color: '#cbd5e1',
    marginTop: 2
  },
  logoutBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  logoutBtnText: {
    color: '#fca5a5',
    fontSize: 11,
    fontWeight: '700'
  },

  // Section Styles
  section: {
    gap: 16
  },

  // Warden Session Card
  sessionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  sessionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16a34a'
  },
  liveText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#166534',
    letterSpacing: 0.5
  },
  refreshBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#f1f5f9',
    borderRadius: 4
  },
  refreshBtnText: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600'
  },
  sessionTimeInfo: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 12
  },
  sessionStatRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  sessionStatBox: {
    flex: 1,
    alignItems: 'center'
  },
  sessionStatDivider: {
    width: 1,
    backgroundColor: '#e2e8f0'
  },
  sessionStatNum: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0f2744'
  },
  sessionStatLbl: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },

  // Scanner Viewport
  scannerWrapper: {
    backgroundColor: '#0f2744',
    borderRadius: 14,
    padding: 14,
    elevation: 3
  },
  scannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  scannerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  torchBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6
  },
  torchBtnActive: {
    backgroundColor: '#f59e0b'
  },
  torchBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700'
  },
  cameraContainer: {
    height: 280,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative'
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center'
  },
  reticleBox: {
    width: 200,
    height: 200,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center'
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#f59e0b'
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLaser: {
    width: '90%',
    height: 2,
    backgroundColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOpacity: 0.8,
    shadowRadius: 5
  },
  reticleInstruction: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4
  },
  cameraPermissionBox: {
    height: 240,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  cameraPermTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6
  },
  cameraPermSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16
  },
  grantPermBtn: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8
  },
  grantPermBtnText: {
    color: '#0f2744',
    fontSize: 13,
    fontWeight: '700'
  },

  // Manual Scan Card
  manualScanCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  manualCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f2744'
  },
  manualCardSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 10
  },
  manualInputRow: {
    flexDirection: 'row',
    gap: 8
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f2744'
  },
  manualSubmitBtn: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 8
  },
  manualSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700'
  },

  // Recent Scans Feed
  recentScansCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f2744'
  },
  recentRefresh: {
    fontSize: 11,
    color: '#2563eb',
    fontWeight: '600'
  },
  emptyRecentText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    paddingVertical: 12
  },
  recentItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9'
  },
  recentStudentBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0f2744',
    justifyContent: 'center',
    alignItems: 'center'
  },
  recentStudentBadgeText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },
  recentStudentName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b'
  },
  recentStudentMeta: {
    fontSize: 11,
    color: '#64748b'
  },
  recentTimeBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  recentTimeText: {
    fontSize: 10,
    color: '#475569',
    fontWeight: '600'
  },

  // Student Digital ID Card (Horizontal Left-Right Layout)
  idCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3
  },
  idCardHeader: {
    backgroundColor: '#0f2744',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center'
  },
  idCardUni: {
    color: '#f59e0b',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.8
  },
  idCardSub: {
    color: '#cbd5e1',
    fontSize: 10,
    marginTop: 2
  },
  idCardHorizontal: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
    gap: 12
  },
  idCardLeft: {
    flex: 1,
    justifyContent: 'center'
  },
  studentName: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f2744',
    lineHeight: 22
  },
  rollBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8
  },
  rollLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b'
  },
  rollBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  rollBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f2744',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace'
  },
  hostelBadgeCompact: {
    backgroundColor: '#f8fafc',
    padding: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8
  },
  hostelBadgeTextCompact: {
    fontSize: 11,
    color: '#1e293b',
    fontWeight: '700'
  },
  hostelBadgeSub: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2
  },
  messPillCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start'
  },
  messPillActive: {
    backgroundColor: '#dcfce7'
  },
  messPillInactive: {
    backgroundColor: '#fee2e2'
  },
  messPillTextCompact: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  idCardRight: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 6
  },
  qrContainerCompact: {
    backgroundColor: '#ffffff',
    padding: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0f2744',
    alignItems: 'center',
    elevation: 2
  },
  qrFootnoteCompact: {
    fontSize: 8,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600'
  },
  scanHint: {
    fontSize: 8,
    color: '#94a3b8',
    marginTop: 2
  },
  idCardFooter: {
    backgroundColor: '#fffbeb',
    borderTopWidth: 1,
    borderTopColor: '#fef3c7',
    paddingVertical: 6,
    paddingHorizontal: 12
  },
  idCardFooterText: {
    fontSize: 10,
    color: '#92400e',
    textAlign: 'center',
    fontWeight: '600'
  },

  // Generic Card Styles
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    elevation: 2
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f2744',
    marginBottom: 12
  },
  menuRow: {
    paddingVertical: 4
  },
  menuMealName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1e293b'
  },
  optionalBadge: {
    fontSize: 9,
    fontWeight: '700',
    color: '#d97706',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10
  },
  menuItems: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 6
  },
  passDetailText: {
    fontSize: 12,
    color: '#334155',
    marginBottom: 6
  },
  rowButtons: {
    flexDirection: 'row',
    marginTop: 10
  },

  // Modal Result Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    borderWidth: 3
  },
  modalSuccessBorder: { borderColor: '#16a34a' },
  modalDuplicateBorder: { borderColor: '#dc2626' },
  modalErrorBorder: { borderColor: '#e11d48' },
  resultBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6
  },
  resultBadgeSuccess: { backgroundColor: '#dcfce7' },
  resultBadgeDuplicate: { backgroundColor: '#fee2e2' },
  resultBadgeError: { backgroundColor: '#ffe4e6' },
  resultBadgeIcon: { fontSize: 14, fontWeight: '800' },
  resultBadgeText: { fontSize: 12, fontWeight: '800' },
  modalStudentInfo: {
    alignItems: 'center',
    marginBottom: 12
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744'
  },
  modalStudentRoll: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2
  },
  modalStudentRoom: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
    marginTop: 2
  },
  modalMessage: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginBottom: 18,
    lineHeight: 18
  },
  modalActionBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  modalActionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700'
  },

  // Setup / Change Password Modal Styles
  setupLinkBtn: {
    marginTop: 14,
    alignItems: 'center',
    paddingVertical: 6
  },
  setupLinkBtnText: {
    color: '#0f2744',
    fontSize: 12,
    fontWeight: '700',
    textDecorationLine: 'underline',
    textAlign: 'center'
  },
  setupCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5
  },
  setupHeader: {
    backgroundColor: '#0f2744',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  setupTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800'
  },
  setupSub: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2
  },
  setupCloseBtn: {
    padding: 6
  },
  setupCloseBtnText: {
    color: '#cbd5e1',
    fontSize: 16,
    fontWeight: '700'
  },
  setupAccountPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  setupAccountLabel: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600'
  },
  setupAccountVal: {
    fontSize: 12,
    color: '#0f2744',
    fontWeight: '800'
  },
  setupVerifiedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0'
  },
  setupVerifiedText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  changePasswordHeaderBtn: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#f59e0b'
  },
  changePasswordHeaderBtnText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '700'
  }
});
