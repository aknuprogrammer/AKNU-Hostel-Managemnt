import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { mobileApiRequest, setMobileToken, getApiBaseUrl, setApiBaseUrl, CURRENT_LOCAL_IP } from '../config/api';
import { heritageTheme } from '../config/heritageTheme';

const theme = heritageTheme.light;

interface StudentRegistrationModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (token: string, user: any) => void;
}

interface VerifiedData {
  identifier: string;
  studentName: string;
  regNumber: string;
  hostelName: string;
  roomNumber?: string;
  bedNumber?: string;
  maskedEmail: string;
}

export default function StudentRegistrationModal({
  visible,
  onClose,
  onSuccess
}: StudentRegistrationModalProps) {
  // Wizard step: 'request' | 'verify' | 'success'
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Identifier input
  const [identifier, setIdentifier] = useState('');
  const [verifiedData, setVerifiedData] = useState<VerifiedData | null>(null);

  // Step 2: Form fields
  const [otp, setOtp] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Admission Fee
  const [admissionFeeStatus, setAdmissionFeeStatus] = useState<'paid' | 'pending'>('paid');
  const [admissionFeePaymentMode, setAdmissionFeePaymentMode] = useState('upi');
  const [admissionFeePaymentDate, setAdmissionFeePaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [admissionFeeReceiptNo, setAdmissionFeeReceiptNo] = useState('');

  // Password fields
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (!visible) {
      setStep('request');
      setIdentifier('');
      setVerifiedData(null);
      setOtp('');
      setPhotoUrl(null);
      setPassword('');
      setConfirmPassword('');
      setError('');
      setLoading(false);
      setResendCooldown(0);
      setAdmissionFeeStatus('paid');
      setAdmissionFeePaymentMode('upi');
      setAdmissionFeeReceiptNo('');
      setAdmissionFeePaymentDate(new Date().toISOString().split('T')[0]);
    }
  }, [visible]);

  // Resend cooldown timer
  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Step 1: Request Activation OTP
  const handleSendOtp = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your University Roll Number or Registration Number.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await mobileApiRequest<{
        success: boolean;
        message: string;
        maskedEmail: string;
        identifier: string;
        studentName: string;
        regNumber: string;
        hostelName: string;
        roomNumber?: string;
        bedNumber?: string;
      }>('/auth/student-activate/send-otp', {
        method: 'POST',
        body: { identifier: cleanId }
      });

      if (res.success) {
        setVerifiedData({
          identifier: res.identifier,
          studentName: res.studentName,
          regNumber: res.regNumber,
          hostelName: res.hostelName,
          roomNumber: res.roomNumber,
          bedNumber: res.bedNumber,
          maskedEmail: res.maskedEmail
        });
        setStep('verify');
        setResendCooldown(60);
      } else {
        setError(res.message || 'Unable to initiate student activation.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to verify student record. Please verify connection.');
    } finally {
      setLoading(false);
    }
  };

  // Image capture via Camera
  const handleTakeLivePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Camera access is required to take your live biometric identification photo.'
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true,
        cameraType: ImagePicker.CameraType.front
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPhotoUrl(base64Data);
        setError('');
      }
    } catch (e: any) {
      Alert.alert('Camera Error', e.message || 'Could not open camera.');
    }
  };

  // Image select from Gallery
  const handlePickFromGallery = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Photo Library Permission Required',
          'Access to your photos is required to select a recent front-facing photo.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
        base64: true
      });

      if (!result.canceled && result.assets && result.assets[0]?.base64) {
        const base64Data = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setPhotoUrl(base64Data);
        setError('');
      }
    } catch (e: any) {
      Alert.alert('Gallery Error', e.message || 'Could not select photo.');
    }
  };

  // Step 2: Verify OTP and Register
  const handleVerifyAndRegister = async () => {
    if (!photoUrl) {
      setError('A recent face photo is required for biometric meal dining verification.');
      return;
    }

    if (!otp.trim()) {
      setError('Please enter the 6-digit OTP verification code sent to your email.');
      return;
    }

    if (otp.trim().length !== 6) {
      setError('Verification OTP must be exactly 6 digits.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await mobileApiRequest<{
        success: boolean;
        message: string;
        token: string;
        user: any;
      }>('/auth/student-activate/verify-and-register', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          otp: otp.trim(),
          password,
          photoUrl,
          admissionFeeStatus,
          admissionFeePaymentDate: admissionFeeStatus === 'paid' ? admissionFeePaymentDate : null,
          admissionFeeReceiptNo: admissionFeeStatus === 'paid' ? admissionFeeReceiptNo.trim() : null,
          admissionFeePaymentMode: admissionFeeStatus === 'paid' ? admissionFeePaymentMode : null
        }
      });

      if (res.success && res.token) {
        setMobileToken(res.token);
        setStep('success');

        // Automatically complete registration and log user in after short celebration
        setTimeout(() => {
          onSuccess(res.token, res.user);
          onClose();
        }, 1600);
      } else {
        setError(res.message || 'Registration verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Error completing registration. Please check inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <View style={styles.stepBadgeRow}>
                <Text style={styles.stepBadgeText}>
                  {step === 'request'
                    ? 'STEP 1 OF 2: RECORD VERIFICATION'
                    : step === 'verify'
                    ? 'STEP 2 OF 2: BIOMETRIC & SECURITY'
                    : 'ACTIVATION COMPLETE'}
                </Text>
              </View>
              <Text style={styles.title}>
                {step === 'request'
                  ? 'First-Time Resident Registration'
                  : step === 'verify'
                  ? 'Activate Resident Identity'
                  : 'Welcome to Hostel Portal!'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Banner */}
            {!!error && (() => {
              const isNetworkError =
                error.includes('NoRouteToHostException') ||
                error.includes('Host unreachable') ||
                error.includes('Network request failed') ||
                error.includes('Failed to fetch') ||
                error.includes('failed to connect');

              return (
                <View style={[styles.errorBanner, isNetworkError && styles.errorBannerNetwork]}>
                  <Text style={styles.errorText}>
                    {isNetworkError ? '⚠️ Server Unreachable' : `⚠️ ${error}`}
                  </Text>
                  {isNetworkError && (
                    <View style={{ marginTop: 6 }}>
                      <Text style={[styles.errorText, { fontWeight: '400', fontSize: 11, marginBottom: 8, color: '#991B1B' }]}>
                        Cannot connect to <Text style={{ fontWeight: '700' }}>{getApiBaseUrl()}</Text>.
                        Your PC's Wi-Fi IP is <Text style={{ fontWeight: '700' }}>{CURRENT_LOCAL_IP}</Text>. Please ensure your phone is connected to the same Wi-Fi network.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setApiBaseUrl(`http://${CURRENT_LOCAL_IP}:5000`);
                          setError('');
                          if (step === 'request') {
                            handleSendOtp();
                          } else if (step === 'verify') {
                            handleVerifyAndRegister();
                          }
                        }}
                        style={styles.errorQuickActionBtn}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.errorQuickActionText}>
                          🔄 Switch to Wi-Fi ({CURRENT_LOCAL_IP}) & Retry
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            {/* STEP 1: REQUEST OTP */}
            {step === 'request' && (
              <View>
                <View style={styles.infoBanner}>
                  <Text style={styles.infoBannerTitle}>🎓 Welcome to AKNU Hostel Residence</Text>
                  <Text style={styles.infoBannerText}>
                    Enter your University Roll Number or Registration Number to verify your hostel room allocation and receive your activation code.
                  </Text>
                </View>

                <Text style={styles.inputLabel}>Student Roll Number or Reg Number</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 22CSE099 or 23ECE050"
                  placeholderTextColor="#9ca3af"
                  value={identifier}
                  onChangeText={(val) => {
                    setIdentifier(val.toUpperCase());
                    setError('');
                  }}
                  autoCapitalize="characters"
                  autoFocus
                />

                <TouchableOpacity
                  onPress={handleSendOtp}
                  disabled={loading}
                  style={[styles.primaryButton, loading && styles.disabledButton, { marginTop: 12 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify Allocation & Send OTP →</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.gatekeeperNotice}>
                  <Text style={styles.gatekeeperNoticeTitle}>📌 Mandatory Requirement</Text>
                  <Text style={styles.gatekeeperNoticeText}>
                    You can only activate your resident account once your hostel room has been officially allocated by the Chief Warden office.
                  </Text>
                </View>
              </View>
            )}

            {/* STEP 2: VERIFY OTP, PHOTO & PASSWORD */}
            {step === 'verify' && verifiedData && (
              <View style={{ gap: 14 }}>
                {/* Allocation Summary Card */}
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryLabel}>RESIDENT STUDENT</Text>
                      <Text style={styles.summaryName}>{verifiedData.studentName}</Text>
                      <Text style={styles.summarySub}>{verifiedData.identifier} • {verifiedData.regNumber}</Text>
                    </View>
                  </View>

                  <View style={styles.summaryDivider} />

                  <View style={styles.summaryMetaRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryMetaLabel}>ALLOCATED HOSTEL</Text>
                      <Text style={styles.summaryMetaVal}>🏨 {verifiedData.hostelName}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.summaryMetaLabel}>ROOM & BED</Text>
                      <Text style={styles.summaryMetaVal}>
                        🚪 Rm {verifiedData.roomNumber || '—'} {verifiedData.bedNumber ? `• ${verifiedData.bedNumber}` : ''}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.otpSentPill}>
                    <Text style={styles.otpSentText}>
                      ✉️ 6-digit OTP code sent to <Text style={{ fontWeight: '700' }}>{verifiedData.maskedEmail}</Text>
                    </Text>
                  </View>
                </View>

                {/* BIOMETRIC MESS WARNING NOTICE */}
                <View style={styles.biometricWarningBox}>
                  <View style={styles.biometricWarningHeader}>
                    <Text style={styles.biometricWarningIcon}>⚠️</Text>
                    <Text style={styles.biometricWarningTitle}>
                      Biometric Face Recognition Notice
                    </Text>
                  </View>
                  <Text style={styles.biometricWarningBody}>
                    Please provide a clear, recent front-facing photo. Your face will be biometrically scanned and matched against this registered profile photo at meal dining counters. If a clear recent photo is not registered, the scanner will fail to recognize you and meal entry will not be permitted.
                  </Text>
                </View>

                {/* PHOTO CAPTURE / UPLOAD SECTION */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    📸 Resident Profile Photo <Text style={styles.requiredStar}>*</Text>
                  </Text>
                  <Text style={styles.sectionSubtitle}>
                    Take a live front-facing selfie or upload a clear passport photo
                  </Text>

                  {photoUrl ? (
                    <View style={styles.photoPreviewWrapper}>
                      <Image source={{ uri: photoUrl }} style={styles.photoPreviewImage} />
                      <View style={styles.photoPreviewRight}>
                        <View style={styles.photoSuccessBadge}>
                          <Text style={styles.photoSuccessBadgeText}>✓ Photo Ready for Biometrics</Text>
                        </View>
                        <Text style={styles.photoHintText}>Face verified. Ready for registration.</Text>
                        <TouchableOpacity
                          onPress={() => setPhotoUrl(null)}
                          style={styles.retakeBtn}
                        >
                          <Text style={styles.retakeBtnText}>Change / Retake Photo</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.photoActionRow}>
                      <TouchableOpacity
                        onPress={handleTakeLivePhoto}
                        style={[styles.photoActionBtn, styles.photoActionCamera]}
                      >
                        <Text style={styles.photoActionIcon}>📷</Text>
                        <Text style={styles.photoActionTitle}>Take Live Photo</Text>
                        <Text style={styles.photoActionSub}>Use Front Camera</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={handlePickFromGallery}
                        style={[styles.photoActionBtn, styles.photoActionGallery]}
                      >
                        <Text style={styles.photoActionIcon}>🖼️</Text>
                        <Text style={styles.photoActionTitle}>Upload Photo</Text>
                        <Text style={styles.photoActionSub}>From Photo Gallery</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* HOSTEL ADMISSION FEE SECTION */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    💳 Hostel Admission Fee Status <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      onPress={() => setAdmissionFeeStatus('paid')}
                      style={[
                        styles.toggleOption,
                        admissionFeeStatus === 'paid' && styles.toggleOptionActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleOptionText,
                          admissionFeeStatus === 'paid' && styles.toggleOptionTextActive
                        ]}
                      >
                        {admissionFeeStatus === 'paid' ? '✓ ' : ''}Yes, Fee Paid in Full
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setAdmissionFeeStatus('pending')}
                      style={[
                        styles.toggleOption,
                        admissionFeeStatus === 'pending' && styles.toggleOptionActive
                      ]}
                    >
                      <Text
                        style={[
                          styles.toggleOptionText,
                          admissionFeeStatus === 'pending' && styles.toggleOptionTextActive
                        ]}
                      >
                        {admissionFeeStatus === 'pending' ? '✓ ' : ''}Pending Verification
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {admissionFeeStatus === 'paid' && (
                    <View style={{ marginTop: 10, gap: 10 }}>
                      <Text style={styles.inputLabel}>Payment Mode</Text>
                      <View style={styles.paymentChipsRow}>
                        {[
                          { id: 'upi', label: 'UPI / QR' },
                          { id: 'bank_challan', label: 'SBI Challan' },
                          { id: 'net_banking', label: 'Net Banking' },
                          { id: 'cash', label: 'Cash Receipt' }
                        ].map((m) => (
                          <TouchableOpacity
                            key={m.id}
                            onPress={() => setAdmissionFeePaymentMode(m.id)}
                            style={[
                              styles.chip,
                              admissionFeePaymentMode === m.id && styles.chipActive
                            ]}
                          >
                            <Text
                              style={[
                                styles.chipText,
                                admissionFeePaymentMode === m.id && styles.chipTextActive
                              ]}
                            >
                              {m.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.inputLabel}>Payment Date (YYYY-MM-DD)</Text>
                          <TextInput
                            style={styles.input}
                            value={admissionFeePaymentDate}
                            onChangeText={setAdmissionFeePaymentDate}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#9ca3af"
                          />
                        </View>
                        <View style={{ flex: 1.2 }}>
                          <Text style={styles.inputLabel}>Challan / UTR Number</Text>
                          <TextInput
                            style={styles.input}
                            value={admissionFeeReceiptNo}
                            onChangeText={setAdmissionFeeReceiptNo}
                            placeholder="e.g. SBI-CH-82910"
                            placeholderTextColor="#9ca3af"
                            autoCapitalize="characters"
                          />
                        </View>
                      </View>
                    </View>
                  )}
                </View>

                {/* OTP INPUT */}
                <View style={styles.sectionCard}>
                  <View style={styles.otpHeaderRow}>
                    <Text style={styles.sectionTitle}>
                      🔑 Enter 6-Digit Email OTP <Text style={styles.requiredStar}>*</Text>
                    </Text>
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={resendCooldown > 0 || loading}
                    >
                      <Text
                        style={[
                          styles.resendLink,
                          resendCooldown > 0 && styles.resendLinkDisabled
                        ]}
                      >
                        {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Code'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#9ca3af"
                    value={otp}
                    onChangeText={(val) => setOtp(val.replace(/[^0-9]/g, '').slice(0, 6))}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                {/* CREATE PASSWORD */}
                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    🔒 Create Resident Account Password <Text style={styles.requiredStar}>*</Text>
                  </Text>

                  <Text style={styles.inputLabel}>New Password (min 6 chars)</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Enter new password"
                      placeholderTextColor="#9ca3af"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.eyeBtn}
                    >
                      <Text style={styles.eyeBtnText}>{showPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.inputLabel, { marginTop: 8 }]}>Confirm New Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, { flex: 1, marginBottom: 0 }]}
                      placeholder="Re-enter new password"
                      placeholderTextColor="#9ca3af"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                    >
                      <Text style={styles.eyeBtnText}>{showConfirmPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* SUBMIT BUTTON */}
                <TouchableOpacity
                  onPress={handleVerifyAndRegister}
                  disabled={loading}
                  style={[styles.primaryButton, loading && styles.disabledButton, { marginTop: 4 }]}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Verify & Complete Registration ✓</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep('request')}
                  disabled={loading}
                  style={styles.backLinkBtn}
                >
                  <Text style={styles.backLinkText}>← Change Roll Number</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* STEP 3: SUCCESS */}
            {step === 'success' && (
              <View style={styles.successContainer}>
                <View style={styles.successBadgeCircle}>
                  <Text style={styles.successBadgeIcon}>✓</Text>
                </View>
                <Text style={styles.successTitle}>Registration Confirmed!</Text>
                <Text style={styles.successSub}>
                  Welcome to the AKNU Hostel Resident Portal. Your biometric profile and room allocation credentials have been successfully activated.
                </Text>
                <ActivityIndicator color={theme.primary} style={{ marginTop: 18 }} />
                <Text style={styles.successRedirectText}>Opening your Resident Portal...</Text>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: theme.surface,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: theme.border
  },
  header: {
    backgroundColor: theme.primary,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  stepBadgeRow: {
    marginBottom: 2
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#E0AD83',
    letterSpacing: 0.8
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#ffffff'
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ffffff'
  },
  scrollArea: {
    flexGrow: 0
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24
  },
  errorBanner: {
    backgroundColor: theme.dangerBg,
    borderColor: '#fca5a5',
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 12
  },
  errorBannerNetwork: {
    backgroundColor: '#FEF2F2',
    borderColor: '#F87171',
    borderWidth: 1.5,
    padding: 12
  },
  errorQuickActionBtn: {
    backgroundColor: theme.accent,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4
  },
  errorQuickActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700'
  },
  errorText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.danger
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14
  },
  infoBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
    marginBottom: 4
  },
  infoBannerText: {
    fontSize: 12,
    color: '#3B82F6',
    lineHeight: 18
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  requiredStar: {
    color: '#ef4444'
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1E293B',
    marginBottom: 8
  },
  primaryButton: {
    backgroundColor: theme.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3
  },
  disabledButton: {
    opacity: 0.6
  },
  gatekeeperNotice: {
    backgroundColor: '#FDF8F6',
    borderWidth: 1,
    borderColor: '#F3E8E2',
    borderRadius: 10,
    padding: 12,
    marginTop: 14
  },
  gatekeeperNoticeTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: theme.accentText,
    marginBottom: 2
  },
  gatekeeperNoticeText: {
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16
  },
  summaryCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  summaryLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.8
  },
  summaryName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1
  },
  summarySub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 8
  },
  summaryMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8
  },
  summaryMetaLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5
  },
  summaryMetaVal: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    marginTop: 1
  },
  otpSentPill: {
    backgroundColor: '#DCFCE7',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#BBF7D0'
  },
  otpSentText: {
    fontSize: 11,
    color: '#166534'
  },
  biometricWarningBox: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 12
  },
  biometricWarningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4
  },
  biometricWarningIcon: {
    fontSize: 14
  },
  biometricWarningTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#92400E'
  },
  biometricWarningBody: {
    fontSize: 11,
    color: '#B45309',
    lineHeight: 16
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B'
  },
  sectionSubtitle: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
    marginBottom: 10
  },
  photoPreviewWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 4
  },
  photoPreviewImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: '#10B981',
    backgroundColor: '#F1F5F9'
  },
  photoPreviewRight: {
    flex: 1
  },
  photoSuccessBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 3
  },
  photoSuccessBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#15803D'
  },
  photoHintText: {
    fontSize: 10,
    color: '#64748B',
    marginBottom: 6
  },
  retakeBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 3
  },
  retakeBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent
  },
  photoActionRow: {
    flexDirection: 'row',
    gap: 10
  },
  photoActionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  photoActionCamera: {
    borderColor: '#93C5FD',
    backgroundColor: '#F0F7FF'
  },
  photoActionGallery: {
    borderColor: '#D8B4FE',
    backgroundColor: '#FAF5FF'
  },
  photoActionIcon: {
    fontSize: 22,
    marginBottom: 4
  },
  photoActionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B'
  },
  photoActionSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6
  },
  toggleOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center'
  },
  toggleOptionActive: {
    borderColor: theme.accent,
    backgroundColor: '#FEF3EB'
  },
  toggleOptionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B'
  },
  toggleOptionTextActive: {
    color: theme.accentText,
    fontWeight: '800'
  },
  paymentChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6
  },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  chipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6'
  },
  chipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#475569'
  },
  chipTextActive: {
    color: '#1D4ED8',
    fontWeight: '800'
  },
  otpHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  resendLink: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.accent
  },
  resendLinkDisabled: {
    color: '#94A3B8'
  },
  otpInput: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    color: theme.primary,
    paddingVertical: 8,
    marginBottom: 0
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    top: 10
  },
  eyeBtnText: {
    fontSize: 14
  },
  backLinkBtn: {
    alignItems: 'center',
    paddingVertical: 8
  },
  backLinkText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B'
  },
  successContainer: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center'
  },
  successBadgeCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successBadgeIcon: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '900'
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8
  },
  successSub: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12
  },
  successRedirectText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 8
  }
});
