import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  SafeAreaView,
  StatusBar
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { mobileApiRequest, setMobileToken } from './src/config/api';
import { heritageTheme } from './src/config/heritageTheme';

export default function App() {
  const [currentRole, setCurrentRole] = useState<'student' | 'warden' | 'security'>('student');
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  // Warden Scanner state
  const [scanResult, setScanResult] = useState<any | null>(null);
  const [testQrInput, setTestQrInput] = useState('');
  const [scanCount, setScanCount] = useState(0);

  // Student state
  const [studentLeaveReason, setStudentLeaveReason] = useState('');
  const [leaveDestination, setLeaveDestination] = useState('');

  // Security state
  const [gateCode, setGateCode] = useState('');
  const [verifiedPass, setVerifiedPass] = useState<any | null>(null);

  // Authenticate as role persona
  const switchPersona = async (role: 'student' | 'warden' | 'security') => {
    setLoading(true);
    setScanResult(null);
    setCurrentRole(role);

    const emailMap = {
      student: 'student.rahul@aknu.edu.in',
      warden: 'warden.boys@aknu.edu.in',
      security: 'security@aknu.edu.in'
    };

    try {
      const res = await mobileApiRequest<{ success: boolean; token: string; user: any }>('/auth/login', {
        method: 'POST',
        body: { email: emailMap[role], password: 'Aknu@2026!' }
      });
      if (res.success) {
        setMobileToken(res.token);
        setCurrentUser(res.user);
      }
    } catch (e: any) {
      Alert.alert('Connection', 'Backend at localhost:5000: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    switchPersona('student');
  }, []);

  // Simulate or process meal scan
  const handleProcessScan = async (qrToken: string) => {
    if (!qrToken) return;
    try {
      const res = await mobileApiRequest<any>('/meal-scans/scan', {
        method: 'POST',
        body: {
          qrToken: qrToken.trim(),
          mealSessionId: 'ms-lunch',
          hostelId: 'hostel-bh1',
          checkpointName: 'Android Mobile Mess Counter'
        }
      });
      setScanResult(res);
      if (res.resultStatus === 'SUCCESS') {
        setScanCount((prev) => prev + 1);
      }
    } catch (e: any) {
      Alert.alert('Scan Result', e.message);
    }
  };

  // Student submit leave
  const handleSubmitLeave = async () => {
    if (!studentLeaveReason || !leaveDestination) {
      Alert.alert('Validation', 'Please provide destination and reason');
      return;
    }
    try {
      const res = await mobileApiRequest<any>('/leave/apply', {
        method: 'POST',
        body: {
          leaveType: 'home',
          departureDate: '2026-10-25 18:00:00',
          returnDate: '2026-10-28 20:00:00',
          destination: leaveDestination,
          reason: studentLeaveReason,
          guardianPhone: '9848099881'
        }
      });
      if (res.success) {
        Alert.alert('Success', 'Hostel Leave Application submitted for Warden approval');
        setStudentLeaveReason('');
        setLeaveDestination('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
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
        Alert.alert('Movement Logged', `Student ${type} verified and recorded`);
        setVerifiedPass(null);
        setGateCode('');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  const sampleStudentToken =
    currentUser?.student?.qr_credential_token ||
    'aknu_v1.eyJzdHVkZW50SWQiOiJzdHUtcmFodWwiLCJyZWdOdW1iZXIiOiJBS05VMjZDU0UwNDIiLCJzYWx0IjoiNmVlZjRiZTAxNmNlNGE5OGM1YWRmYjY1YTQ2NDZiOTYiLCJpc3N1ZWRBdCI6MTc5MTc4MTExNjg0OSwidmVyc2lvbiI6MX0.JO1yc9sHKRoq9oDK-Xy18GebObW0NIWYoOttCORZrbE';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0f2744" />

      {/* University Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.universityTitle}>ADIKAVI NANNAYA UNIVERSITY</Text>
          <Text style={styles.appSubtitle}>Hostels Android Mobile App</Text>
        </View>

        {/* Persona Switcher Tabs */}
        <View style={styles.personaRow}>
          <TouchableOpacity
            onPress={() => switchPersona('student')}
            style={[styles.personaTab, currentRole === 'student' && styles.personaTabActive]}
          >
            <Text style={[styles.personaText, currentRole === 'student' && styles.personaTextActive]}>
              Student
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => switchPersona('warden')}
            style={[styles.personaTab, currentRole === 'warden' && styles.personaTabActive]}
          >
            <Text style={[styles.personaText, currentRole === 'warden' && styles.personaTextActive]}>
              Warden Scanner
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => switchPersona('security')}
            style={[styles.personaTab, currentRole === 'security' && styles.personaTabActive]}
          >
            <Text style={[styles.personaText, currentRole === 'security' && styles.personaTextActive]}>
              Security Gate
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* ========================================================= */}
        {/* VIEW 1: STUDENT HOME & DIGITAL QR ID */}
        {/* ========================================================= */}
        {currentRole === 'student' && (
          <View style={styles.section}>
            {/* Student ID Card */}
            <View style={styles.idCard}>
              <View style={styles.idCardHeader}>
                <Text style={styles.idCardUniName}>ADIKAVI NANNAYA UNIVERSITY</Text>
                <Text style={styles.idCardSub}>Hostel Resident Digital Credential</Text>
              </View>

              <View style={styles.idCardBody}>
                <Image
                  source={{
                    uri:
                      currentUser?.student?.photo_url ||
                      'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop'
                  }}
                  style={styles.studentPhoto}
                />
                <Text style={styles.studentName}>{currentUser?.student?.full_name || 'Rahul Varma'}</Text>
                <Text style={styles.studentRoll}>
                  Roll: {currentUser?.student?.roll_number || '22CSE042'} • Reg: {currentUser?.student?.reg_number || 'AKNU26CSE042'}
                </Text>
                <Text style={styles.studentHostel}>
                  Godavari Bhavan (BH-1) • Room 101, Bed 1
                </Text>

                {/* Personal Signed QR Code */}
                <View style={styles.qrContainer}>
                  <QRCode value={sampleStudentToken} size={160} color="#0f2744" backgroundColor="white" />
                  <Text style={styles.qrFootnote}>HMAC-SHA256 Verifiable Credential</Text>
                </View>

                <View style={styles.messBadge}>
                  <Text style={styles.messBadgeText}>Mess Status: ACTIVE • ALL MEALS</Text>
                </View>
              </View>
            </View>

            {/* Daily Mess Menu Preview */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today's Hostel Mess Timetable</Text>
              <Text style={styles.menuItem}>• Breakfast: Idli, Sambar, Chutney, Tea (07:30 - 09:30)</Text>
              <Text style={styles.menuItem}>• Lunch: Andhra Pappu, Rice, Curry, Curd (12:30 - 14:30)</Text>
              <Text style={styles.menuItem}>• Snacks: Tea & Mirchi Bajji (16:45 - 18:00)</Text>
              <Text style={styles.menuItem}>• Dinner: Phulka Chapati, Paneer, Dal (19:30 - 21:30)</Text>
            </View>

            {/* Quick Leave Application */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Quick Out-Pass / Leave Application</Text>
              <TextInput
                placeholder="Destination City (e.g. Vijayawada)"
                value={leaveDestination}
                onChangeText={setLeaveDestination}
                style={styles.input}
              />
              <TextInput
                placeholder="Reason for leaving hostel"
                value={studentLeaveReason}
                onChangeText={setStudentLeaveReason}
                style={styles.input}
              />
              <TouchableOpacity onPress={handleSubmitLeave} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Submit Leave Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: WARDEN MEAL SCANNER */}
        {/* ========================================================= */}
        {currentRole === 'warden' && (
          <View style={styles.section}>
            {/* Active Session Info */}
            <View style={styles.sessionBanner}>
              <Text style={styles.sessionTitle}>Live Meal Session: Lunch (Serving Now)</Text>
              <Text style={styles.sessionMeta}>Godavari Bhavan (BH-1) Counter 1 • Today's Scans: {scanCount}</Text>
            </View>

            {/* Result Banner if Scanned */}
            {scanResult && (
              <View
                style={[
                  styles.resultCard,
                  scanResult.resultStatus === 'SUCCESS'
                    ? styles.resultCardSuccess
                    : scanResult.resultStatus === 'DUPLICATE'
                    ? styles.resultCardDuplicate
                    : styles.resultCardError
                ]}
              >
                <Text style={styles.resultTitle}>{scanResult.title}</Text>
                <Text style={styles.resultMessage}>{scanResult.message}</Text>
                {scanResult.student && (
                  <Text style={styles.resultStudent}>
                    Student: {scanResult.student.fullName} ({scanResult.student.rollNumber})
                  </Text>
                )}
              </View>
            )}

            {/* Camera Viewport Simulation */}
            <View style={styles.cameraBox}>
              <View style={styles.scanTargetFrame} />
              <Text style={styles.cameraText}>Android Camera Barcode Scanner View</Text>
              <Text style={styles.cameraSub}>Focus on student's personal digital QR credential</Text>
            </View>

            {/* Fast Test Action Buttons */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Simulate Scan on Device</Text>
              <TouchableOpacity
                onPress={() => handleProcessScan(sampleStudentToken)}
                style={styles.primaryButton}
              >
                <Text style={styles.primaryButtonText}>Scan Rahul's QR (22CSE042)</Text>
              </TouchableOpacity>

              <Text style={styles.testHint}>
                Tap the scan button above twice to test atomic duplicate scan suppression!
              </Text>
            </View>
          </View>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: SECURITY GATE VERIFIER */}
        {/* ========================================================= */}
        {currentRole === 'security' && (
          <View style={styles.section}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Security Gate Pass Verification</Text>
              <TextInput
                placeholder="Enter Student Pass Code (e.g. GP-529182)"
                value={gateCode}
                onChangeText={setGateCode}
                style={styles.input}
              />
              <TouchableOpacity onPress={handleVerifyGateCode} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Verify Pass</Text>
              </TouchableOpacity>
            </View>

            {verifiedPass && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Pass Details</Text>
                <Text style={styles.menuItem}>Student: {verifiedPass.student_name} ({verifiedPass.roll_number})</Text>
                <Text style={styles.menuItem}>Destination: {verifiedPass.destination}</Text>
                <Text style={styles.menuItem}>Reason: {verifiedPass.reason}</Text>

                <View style={styles.rowButtons}>
                  <TouchableOpacity
                    onPress={() => handleGateMovement('EXIT')}
                    style={[styles.primaryButton, { flex: 1, backgroundColor: '#dc2626' }]}
                  >
                    <Text style={styles.primaryButtonText}>Log Exit</Text>
                  </TouchableOpacity>
                  <View style={{ width: 10 }} />
                  <TouchableOpacity
                    onPress={() => handleGateMovement('ENTRY')}
                    style={[styles.primaryButton, { flex: 1, backgroundColor: '#16a34a' }]}
                  >
                    <Text style={styles.primaryButtonText}>Log Entry</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: heritageTheme.light.background
  },
  header: {
    backgroundColor: heritageTheme.light.primary,
    paddingTop: 10,
    paddingBottom: 15,
    paddingHorizontal: 16
  },
  headerContent: {
    marginBottom: 10
  },
  universityTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5
  },
  appSubtitle: {
    color: heritageTheme.light.accent,
    fontSize: 12,
    fontWeight: '600'
  },
  personaRow: {
    flexDirection: 'row',
    backgroundColor: heritageTheme.light.primaryPressed,
    borderRadius: 8,
    padding: 3
  },
  personaTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 6
  },
  personaTabActive: {
    backgroundColor: heritageTheme.light.accent
  },
  personaText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '700'
  },
  personaTextActive: {
    color: '#ffffff'
  },
  scrollContent: {
    padding: 16
  },
  section: {
    gap: 16
  },
  idCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#0f2744',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3
  },
  idCardHeader: {
    backgroundColor: '#0f2744',
    paddingVertical: 10,
    alignItems: 'center'
  },
  idCardUniName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  idCardSub: {
    color: '#d4af37',
    fontSize: 9,
    fontWeight: '700'
  },
  idCardBody: {
    alignItems: 'center',
    padding: 16
  },
  studentPhoto: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#0f2744',
    marginBottom: 8
  },
  studentName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f2744'
  },
  studentRoll: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2
  },
  studentHostel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e40af',
    marginTop: 2
  },
  qrContainer: {
    marginVertical: 14,
    padding: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    alignItems: 'center'
  },
  qrFootnote: {
    fontSize: 9,
    color: '#94a3b8',
    marginTop: 6,
    fontFamily: 'monospace'
  },
  messBadge: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 8
  },
  messBadgeText: {
    color: '#065f46',
    fontSize: 10,
    fontWeight: '800'
  },
  card: {
    backgroundColor: heritageTheme.light.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: heritageTheme.light.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: heritageTheme.light.primary,
    marginBottom: 8
  },
  menuItem: {
    fontSize: 12,
    color: heritageTheme.light.text,
    marginBottom: 4
  },
  input: {
    backgroundColor: heritageTheme.light.surfaceElevated,
    borderWidth: 1,
    borderColor: heritageTheme.light.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    marginBottom: 8,
    color: heritageTheme.light.text
  },
  primaryButton: {
    backgroundColor: heritageTheme.light.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center'
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800'
  },
  rowButtons: {
    flexDirection: 'row',
    marginTop: 8
  },
  sessionBanner: {
    backgroundColor: heritageTheme.light.primary,
    borderRadius: 12,
    padding: 12
  },
  sessionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800'
  },
  sessionMeta: {
    color: heritageTheme.light.accentSoft,
    fontSize: 11,
    marginTop: 2
  },
  cameraBox: {
    height: 200,
    backgroundColor: '#020617',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: heritageTheme.light.border
  },
  scanTargetFrame: {
    width: 140,
    height: 140,
    borderWidth: 2,
    borderColor: heritageTheme.light.focus,
    borderRadius: 12,
    marginBottom: 8
  },
  cameraText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700'
  },
  cameraSub: {
    color: '#64748b',
    fontSize: 10,
    marginTop: 2
  },
  resultCard: {
    padding: 14,
    borderRadius: 12
  },
  resultCardSuccess: {
    backgroundColor: heritageTheme.light.success
  },
  resultCardDuplicate: {
    backgroundColor: heritageTheme.light.danger
  },
  resultCardError: {
    backgroundColor: heritageTheme.light.warning
  },
  resultTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800'
  },
  resultMessage: {
    color: '#f8fafc',
    fontSize: 11,
    marginTop: 2
  },
  resultStudent: {
    color: '#f8fafc',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4
  },
  testHint: {
    fontSize: 10,
    color: '#64748b',
    fontStyle: 'italic',
    marginTop: 6,
    textAlign: 'center'
  }
});
