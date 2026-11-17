import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { mobileApiRequest, getApiBaseUrl, setApiBaseUrl, CURRENT_LOCAL_IP } from '../config/api';
import { heritageTheme } from '../config/heritageTheme';

const theme = heritageTheme.light;

interface ForgotPasswordModalProps {
  visible: boolean;
  initialIdentifier?: string;
  onClose: () => void;
  onSuccess?: (identifier?: string) => void;
}

export default function ForgotPasswordModal({
  visible,
  initialIdentifier = '',
  onClose,
  onSuccess
}: ForgotPasswordModalProps) {
  const [step, setStep] = useState<'request' | 'verify' | 'success'>('request');
  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Sync initial identifier whenever modal opens or initialIdentifier changes
  useEffect(() => {
    if (visible) {
      if (initialIdentifier) {
        setIdentifier(initialIdentifier);
      }
      setError('');
    }
  }, [visible, initialIdentifier]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleClose = () => {
    setStep('request');
    setError('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setMaskedEmail('');
    onClose();
  };

  // Step 1: Send OTP to user's registered email
  const handleSendOtp = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your University Email or Student Roll Number.');
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
      }>('/auth/forgot-password/send-otp', {
        method: 'POST',
        body: { identifier: cleanId }
      });

      if (res.success) {
        setMaskedEmail(res.maskedEmail || 'your registered email');
        setStep('verify');
        setResendCooldown(60);
      } else {
        setError(res.message || 'Unable to send OTP. Please check your roll number or email.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect to the server. Please verify network connection.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP and reset password
  const handleVerifyOtpAndReset = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length < 6) {
      setError('Please enter the full 6-digit OTP received in your email.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const res = await mobileApiRequest<{
        success: boolean;
        message: string;
      }>('/auth/forgot-password/verify-otp', {
        method: 'POST',
        body: {
          identifier: identifier.trim(),
          otp: cleanOtp,
          newPassword
        }
      });

      if (res.success) {
        setStep('success');
      } else {
        setError(res.message || 'Invalid or expired OTP. Please check and try again.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinishSuccess = () => {
    const finalId = identifier.trim();
    handleClose();
    if (onSuccess) {
      onSuccess(finalId);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.modalBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardContainer}
        >
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.headerTitle}>
                  {step === 'success'
                    ? 'Password Reset'
                    : step === 'verify'
                    ? 'Verify OTP & Reset'
                    : 'Forgot Password'}
                </Text>
                <Text style={styles.headerSub}>
                  {step === 'success'
                    ? 'Credentials updated successfully'
                    : step === 'verify'
                    ? 'Enter the OTP sent to your registered email'
                    : 'Enter your Roll Number or University Email'}
                </Text>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Error Banner */}
            {Boolean(error) && (() => {
              const isNetworkError =
                error.includes('NoRouteToHostException') ||
                error.includes('Host unreachable') ||
                error.includes('Network request failed') ||
                error.includes('Failed to fetch') ||
                error.includes('failed to connect');

              return (
                <View style={[styles.errorBanner, isNetworkError && { flexDirection: 'column', alignItems: 'stretch' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.errorBannerIcon}>⚠️</Text>
                    <Text style={styles.errorBannerText}>
                      {isNetworkError ? 'Server Unreachable' : error}
                    </Text>
                  </View>
                  {isNetworkError && (
                    <View style={{ marginTop: 6, marginLeft: 20 }}>
                      <Text style={[styles.errorBannerText, { fontWeight: '400', fontSize: 11, marginBottom: 8 }]}>
                        Cannot reach backend at <Text style={{ fontWeight: '700' }}>{getApiBaseUrl()}</Text>.
                        Ensure your device is connected to the same Wi-Fi.
                      </Text>
                      <TouchableOpacity
                        onPress={() => {
                          setApiBaseUrl(`http://${CURRENT_LOCAL_IP}:5000`);
                          setError('');
                          if (step === 'request') {
                            handleSendOtp();
                          } else if (step === 'verify') {
                            handleVerifyOtpAndReset();
                          }
                        }}
                        style={{
                          backgroundColor: theme.accent,
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: 6,
                          alignItems: 'center'
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '700' }}>
                          🔄 Switch to Wi-Fi ({CURRENT_LOCAL_IP}) & Retry
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })()}

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
            >
              {/* ================= STEP 1: REQUEST OTP ================= */}
              {step === 'request' && (
                <View>
                  <View style={styles.infoCallout}>
                    <Text style={styles.infoCalloutTitle}>🔐 Password Recovery</Text>
                    <Text style={styles.infoCalloutText}>
                      Enter your registered Student Roll / Registration Number or University Email.
                      A secure 6-digit OTP will be dispatched to your registered inbox to verify your identity.
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>University Email or Roll Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 238312001 or student@aknu.edu.in"
                    placeholderTextColor="#9ca3af"
                    value={identifier}
                    onChangeText={(val) => {
                      setIdentifier(val);
                      if (error) setError('');
                    }}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                  />

                  <TouchableOpacity
                    onPress={handleSendOtp}
                    disabled={loading}
                    style={[styles.primaryButton, loading && styles.disabledButton]}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Send OTP to Email →</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleClose}
                    style={styles.cancelLinkBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelLinkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ================= STEP 2: VERIFY OTP & RESET ================= */}
              {step === 'verify' && (
                <View>
                  {/* Account / Masked Email Pill */}
                  <View style={styles.accountPill}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.accountPillLabel}>VERIFICATION CODE SENT TO</Text>
                      <Text style={styles.accountPillEmail}>{maskedEmail}</Text>
                      <Text style={styles.accountPillSub}>Account: {identifier.trim()}</Text>
                    </View>
                    <View style={styles.otpActiveBadge}>
                      <Text style={styles.otpActiveBadgeText}>✓ Active</Text>
                    </View>
                  </View>

                  {/* 6-Digit OTP Field */}
                  <Text style={styles.inputLabel}>6-Digit Verification Code (OTP)</Text>
                  <TextInput
                    style={[styles.input, styles.otpInput]}
                    placeholder="• • • • • •"
                    placeholderTextColor="#9ca3af"
                    value={otp}
                    onChangeText={(val) => {
                      setOtp(val.replace(/[^0-9]/g, ''));
                      if (error) setError('');
                    }}
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />

                  {/* New Password Field */}
                  <Text style={styles.inputLabel}>New Password (min 6 characters)</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Create a strong password"
                      placeholderTextColor="#9ca3af"
                      value={newPassword}
                      onChangeText={(val) => {
                        setNewPassword(val);
                        if (error) setError('');
                      }}
                      secureTextEntry={!showNewPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowNewPassword(!showNewPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.eyeBtnText}>{showNewPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Confirm Password Field */}
                  <Text style={styles.inputLabel}>Confirm New Password</Text>
                  <View style={styles.passwordRow}>
                    <TextInput
                      style={[styles.input, styles.passwordInput]}
                      placeholder="Re-enter your new password"
                      placeholderTextColor="#9ca3af"
                      value={confirmPassword}
                      onChangeText={(val) => {
                        setConfirmPassword(val);
                        if (error) setError('');
                      }}
                      secureTextEntry={!showConfirmPassword}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                      style={styles.eyeBtn}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.eyeBtnText}>{showConfirmPassword ? '👁️' : '🔒'}</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Resend OTP Bar */}
                  <View style={styles.resendRow}>
                    <Text style={styles.resendHint}>Didn't receive code?</Text>
                    <TouchableOpacity
                      onPress={handleSendOtp}
                      disabled={resendCooldown > 0 || loading}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.resendBtnText,
                          resendCooldown > 0 && styles.resendBtnDisabled
                        ]}
                      >
                        {resendCooldown > 0 ? `Resend OTP (${resendCooldown}s)` : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Reset Password Button */}
                  <TouchableOpacity
                    onPress={handleVerifyOtpAndReset}
                    disabled={loading}
                    style={[styles.primaryButton, loading && styles.disabledButton, { marginTop: 14 }]}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color="#ffffff" size="small" />
                    ) : (
                      <Text style={styles.primaryButtonText}>✓ Reset Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setStep('request')}
                    style={styles.cancelLinkBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelLinkText}>← Change Roll Number / Email</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ================= STEP 3: SUCCESS ================= */}
              {step === 'success' && (
                <View style={styles.successContainer}>
                  <View style={styles.successIconCircle}>
                    <Text style={styles.successIconText}>✓</Text>
                  </View>
                  <Text style={styles.successTitle}>Password Reset Complete!</Text>
                  <Text style={styles.successSub}>
                    Your account password has been updated securely. You can now return to the login screen and sign in with your new password.
                  </Text>

                  <TouchableOpacity
                    onPress={handleFinishSuccess}
                    style={[styles.primaryButton, { marginTop: 22 }]}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.primaryButtonText}>Proceed to Sign In →</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
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
  keyboardContainer: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center'
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  modalHeader: {
    backgroundColor: theme.primary, // #23395D
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  headerSub: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)'
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  },
  scrollContent: {
    padding: 18
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    padding: 10,
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center'
  },
  errorBannerIcon: {
    fontSize: 14,
    marginRight: 6
  },
  errorBannerText: {
    fontSize: 11,
    color: '#991b1b',
    fontWeight: '600',
    flex: 1
  },
  infoCallout: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14
  },
  infoCalloutTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.primary,
    marginBottom: 4
  },
  infoCalloutText: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16
  },
  accountPill: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  accountPillLabel: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.5
  },
  accountPillEmail: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.primary,
    marginTop: 2
  },
  accountPillSub: {
    fontSize: 10,
    color: '#475569',
    marginTop: 2
  },
  otpActiveBadge: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#86efac',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  otpActiveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#166534'
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
    marginTop: 8
  },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a'
  },
  otpInput: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 6,
    textAlign: 'center',
    backgroundColor: '#ffffff',
    borderColor: theme.accent
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative'
  },
  passwordInput: {
    flex: 1,
    paddingRight: 42
  },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    padding: 6
  },
  eyeBtnText: {
    fontSize: 14
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingHorizontal: 2
  },
  resendHint: {
    fontSize: 11,
    color: '#64748b'
  },
  resendBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.primary,
    textDecorationLine: 'underline'
  },
  resendBtnDisabled: {
    color: '#94a3b8',
    textDecorationLine: 'none'
  },
  primaryButton: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3
  },
  disabledButton: {
    opacity: 0.6
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  cancelLinkBtn: {
    alignItems: 'center',
    marginTop: 12,
    paddingVertical: 4
  },
  cancelLinkText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600'
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 14
  },
  successIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#86efac',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14
  },
  successIconText: {
    fontSize: 28,
    color: '#166534',
    fontWeight: '900'
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center'
  },
  successSub: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12
  }
});
