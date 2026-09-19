import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Webcam from 'react-webcam';
import toast from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';
import {
  GraduationCap, ChevronRight, ChevronLeft, Camera, CameraOff,
  RefreshCw, CheckCircle, Shield, User, School, Phone, Mail, MapPin,
  Mic, MicOff, AlertCircle, Edit2, Check, X, UserCheck, LogIn, LogOut, Lock, ClipboardList,
  Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { generateRegistrationId } from '../utils/generateId';
import { normalizePhone, normalizeEmail, normalizeName, normalizeSchool, normalizeCity } from '../utils/speechNormalize';
import Spinner from '../components/Spinner';
import Modal from '../components/Modal';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ─── Step definitions ─────────────────────────────────────────────────────────
const STEPS = ['Session', 'Photo', 'Voice', 'Confirm'];

// ─── Voice field sequence (order matters) ────────────────────────────────────
const VOICE_FIELDS = [
  { key: 'name', label: 'Full Name', icon: User, placeholder: 'e.g. Priyansh Goyal', hint: 'Say your full name (e.g. "My name is Priyansh Goyal")' },
  { key: 'email', label: 'Gmail ID / Email', icon: Mail, placeholder: 'e.g. priyansh123@gmail.com', hint: 'Say email (e.g. "priyansh 1 2 3 at the rate gmail dot com")' },
  { key: 'phone', label: 'Phone Number', icon: Phone, placeholder: 'e.g. 9876543210', hint: 'Say 10 digit phone number clearly' },
  { key: 'school_name', label: 'School Name', icon: School, placeholder: 'e.g. Delhi Public School', hint: 'Say your school or college name' },
  { key: 'city', label: 'City', icon: MapPin, placeholder: 'e.g. Bhopal, New Delhi', hint: 'Say your city name' },
];

// ─── Voice state machine ──────────────────────────────────────────────────────
const MIC_STATE = { IDLE: 'idle', LISTENING: 'listening', PROCESSING: 'processing', CAPTURED: 'captured', COMPLETE: 'complete', ERROR: 'error' };

function FieldError({ message }) {
  if (!message) return null;
  return (
    <p className="flex items-center gap-1 mt-1.5 text-xs font-semibold text-red-600">
      <AlertCircle size={12} /> {message}
    </p>
  );
}

function StepIndicator({ step }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 ${i <= step ? 'text-blue-600' : 'text-slate-400'}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${i < step
              ? 'bg-blue-600 border-blue-600 text-white'
              : i === step
                ? 'border-blue-500 text-blue-600 bg-blue-50'
                : 'border-slate-300 text-slate-400 bg-white'
              }`}>
              {i < step ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className="text-xs font-medium hidden sm:block">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px ${i < step ? 'bg-blue-500' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function KioskPage() {
  const navigate = useNavigate();
  const webcamRef = useRef(null);
  const recognitionRef = useRef(null);
  const { user, session, profile, role, loading: authLoading } = useAuth();

  // ── Dedicated Coordinator Desk Auth state (Independent from Admin Auth Session) ──
  const [coordDeskSession, setCoordDeskSession] = useState(() => {
    try {
      const stored = sessionStorage.getItem('coord_desk_session');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [coordEmail, setCoordEmail] = useState('');
  const [coordPass, setCoordPass] = useState('');
  const [showCoordPass, setShowCoordPass] = useState(false);
  const [loggingInCoord, setLoggingInCoord] = useState(false);

  // ── Rate-limit: 3 failed coord login attempts → 30s lockout ──
  const [loginFailCount, setLoginFailCount] = useState(0);
  const [loginLockedUntil, setLoginLockedUntil] = useState(0);
  const isLoginLocked = Date.now() < loginLockedUntil;
  const loginLockSecondsLeft = Math.ceil((loginLockedUntil - Date.now()) / 1000);

  // ── 8-hour coordinator desk session timeout ──
  const SESSION_MAX_MS = 8 * 60 * 60 * 1000; // 8 hours
  const isDeskSessionExpired = coordDeskSession &&
    Date.now() - (coordDeskSession.authenticatedAt || 0) > SESSION_MAX_MS;

  // Auto-clear expired desk session
  useEffect(() => {
    if (isDeskSessionExpired) {
      sessionStorage.removeItem('coord_desk_session');
      sessionStorage.setItem('coord_desk_logged_out', 'true');
      setCoordDeskSession(null);
      toast.error('Coordinator desk session expired. Please log in again.', { duration: 5000 });
    }
  }, [isDeskSessionExpired]);

  // Active desk user calculation (coordDeskSession takes precedence, fallback to main auth if not logged out on desk)
  const isDeskLoggedOut = sessionStorage.getItem('coord_desk_logged_out') === 'true';
  const activeDeskUser = (!isDeskSessionExpired && coordDeskSession) || (!isDeskLoggedOut && session?.user ? {
    id: session.user.id,
    email: session.user.email,
    full_name: profile?.full_name || session.user.email,
    role: profile?.role || 'admin',
  } : null);

  // ── Coordinator Regs Checker Modal State ──
  const [checkRegsOpen, setCheckRegsOpen] = useState(false);
  const [sessionRegs, setSessionRegs] = useState([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  // ── Wizard state ──
  const [step, setStep] = useState(0);
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});

  // ── Form state ──
  const [form, setForm] = useState({ sessionId: '', name: '', email: '', phone: '', school_name: '', city: '' });
  const [photoDataUrl, setPhotoDataUrl] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(false);

  // ── Voice state ──
  const [micState, setMicState] = useState(MIC_STATE.IDLE);
  const [activeFieldIndex, setActiveFieldIndex] = useState(0);
  const [capturedFields, setCapturedFields] = useState(new Set());
  const [speechSupported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const fieldRefs = useRef([]);

  // ── Auto scroll active field into view whenever column/active field changes in Step 2 ──
  useEffect(() => {
    if (step === 2 && fieldRefs.current[activeFieldIndex]) {
      const el = fieldRefs.current[activeFieldIndex];
      const timer = setTimeout(() => {
        el?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeFieldIndex, step]);

  // ── Confirm edit mode ──
  const [editingField, setEditingField] = useState(null);

  // ── Coordinator Desk Login Handler (Strict Verification + Rate Limiting) ──
  const handleCoordLogin = async (e) => {
    e.preventDefault();

    // Rate-limit check
    if (isLoginLocked) {
      toast.error(`Too many failed attempts. Try again in ${loginLockSecondsLeft}s.`);
      return;
    }

    if (!coordEmail.trim() || !coordPass.trim()) {
      toast.error('Please enter your coordinator email and password');
      return;
    }
    setLoggingInCoord(true);
    try {
      const emailClean = coordEmail.trim().toLowerCase();

      // 1. Verify email against approved user_profiles table (using RPC function first)
      let userProf = null;
      const { data: rpcProf, error: rpcProfErr } = await supabase.rpc('check_coordinator_profile', { p_email: emailClean });

      if (!rpcProfErr && rpcProf) {
        if (rpcProf.total_profiles > 0 && !rpcProf.exists) {
          throw new Error(`Access Denied: "${emailClean}" is not an approved coordinator email created by the admin.`);
        }
        if (rpcProf.exists && !rpcProf.is_active) {
          throw new Error('Your coordinator account has been disabled by the admin.');
        }
        userProf = rpcProf.exists ? { full_name: rpcProf.full_name, is_active: rpcProf.is_active } : null;
      } else {
        // Direct table query fallback
        const { data: directProf, error: profErr } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', emailClean)
          .maybeSingle();

        if (profErr) {
          console.warn('User profile check warning:', profErr);
        }

        if (directProf && directProf.is_active === false) {
          throw new Error('Your coordinator account has been disabled by the admin.');
        }

        if (directProf === null) {
          const { count } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
          if (count && count > 0) {
            throw new Error(`Access Denied: "${emailClean}" is not an approved coordinator email created by the admin.`);
          }
        }
        userProf = directProf;
      }

      // 2. Sign in with password using an isolated auth client (persistSession: false)
      // This prevents overwriting the main Admin session in localStorage!
      const tempAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: authData, error } = await tempAuthClient.auth.signInWithPassword({
        email: emailClean,
        password: coordPass,
      });

      if (error) throw new Error(error.message);

      // Reset fail count on success
      setLoginFailCount(0);
      setLoginLockedUntil(0);

      const nameDisp = userProf?.full_name || emailClean;
      const deskUserObj = {
        id: authData?.user?.id,
        email: emailClean,
        full_name: nameDisp,
        role: userProf?.role || 'coordinator',
        authenticatedAt: Date.now(),
      };

      sessionStorage.removeItem('coord_desk_logged_out');
      sessionStorage.setItem('coord_desk_session', JSON.stringify(deskUserObj));
      setCoordDeskSession(deskUserObj);
      toast.success(`Coordinator Authenticated: Welcome ${nameDisp}!`);
    } catch (err) {
      // Track failed attempts and lock after 3
      setLoginFailCount((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          setLoginLockedUntil(Date.now() + 30_000);
          toast.error(`Account locked for 30 seconds after 3 failed attempts.`, { duration: 5000 });
        } else {
          toast.error(`${err.message} (${next}/3 attempts)`);
        }
        return next;
      });
    } finally {
      setLoggingInCoord(false);
    }
  };

  // ── Desk Logout (Clears Desk session ONLY, never logs out Admin Portal) ──
  const handleDeskLogout = () => {
    sessionStorage.removeItem('coord_desk_session');
    sessionStorage.setItem('coord_desk_logged_out', 'true');
    setCoordDeskSession(null);
    setCoordEmail('');
    setCoordPass('');
    setShowCoordPass(false);
    setStep(0);
    setForm({ sessionId: '', name: '', email: '', phone: '', school_name: '', city: '' });
    toast.success('Coordinator Desk logged out successfully.');
  };

  // ── Load sessions with automatic end_date expiration check (00:00 AM) ──
  useEffect(() => {
    async function fetchSessions() {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('status', 'active')
        .order('start_date', { ascending: true });

      if (error) {
        toast.error('Failed to load sessions');
      } else {
        const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
        // Exclude sessions where today's date > end_date (expired at 00:00 AM on next day)
        const activeSessions = (data ?? []).filter((s) => {
          if (!s.end_date) return true;
          return s.end_date >= todayStr;
        });
        setSessions(activeSessions);
      }
      setLoadingSessions(false);
    }
    fetchSessions();
  }, []);

  // ── Fetch session registrations for Coordinator verification modal ──
  const openCheckRegs = async () => {
    setCheckRegsOpen(true);
    setLoadingRegs(true);
    const { data } = await supabase
      .from('registrations')
      .select('registration_id, registration_status, registered_at, email, city, students(name, school_name, email, city), sessions(name)')
      .order('registered_at', { ascending: false })
      .limit(50);
    setSessionRegs(data ?? []);
    setLoadingRegs(false);
  };

  // ── Camera ──
  const capture = useCallback(() => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0);
      setPhotoDataUrl(canvas.toDataURL('image/jpeg', 0.92));
    };
    img.src = screenshot;
  }, []);
  const retake = () => setPhotoDataUrl(null);

  const selectedSession = sessions.find((s) => s.id === form.sessionId);

  // ─── Smart normalization per field ────────────────────────────────────────────
  const normalizeForField = useCallback((fieldKey, transcript) => {
    if (fieldKey === 'name') return normalizeName(transcript);
    if (fieldKey === 'email') return normalizeEmail(transcript);
    if (fieldKey === 'phone') return normalizePhone(transcript);
    if (fieldKey === 'school_name') return normalizeSchool(transcript);
    if (fieldKey === 'city') return normalizeCity(transcript);
    return transcript;
  }, []);

  // ─── Core speech recognition for a single field ───────────────────────────────
  const listenForField = useCallback((fieldIndex) => {
    if (!speechSupported) {
      toast.error('Speech recognition not supported in this browser.');
      return;
    }

    const field = VOICE_FIELDS[fieldIndex];
    if (!field) return;

    recognitionRef.current?.abort();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 3;
    recognition.continuous = false;

    // Optional JSGF phonetic grammar hints for browser speech engine
    const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList;
    if (SpeechGrammarList) {
      try {
        const speechGrammarList = new SpeechGrammarList();
        const grammar = '#JSGF V1.0; grammar keywords; public <keyword> = Priyansh | Goyal | Jaypee | Raghogarh | Guna | JUET | Bhopal | Indore | Gwalior | Delhi | DPS | KV ;';
        speechGrammarList.addFromString(grammar, 1);
        recognition.grammars = speechGrammarList;
      } catch {
        // Fallback gracefully if browser grammar list is restricted
      }
    }

    setMicState(MIC_STATE.LISTENING);

    recognition.onresult = (event) => {
      // Evaluate up to 3 speech recognition alternatives for best normalized match
      let selectedTranscript = '';
      let bestCleaned = '';

      if (event.results[0]) {
        for (let a = 0; a < event.results[0].length; a++) {
          const altText = event.results[0][a]?.transcript?.trim();
          if (altText) {
            const candidateCleaned = normalizeForField(field.key, altText);
            if (candidateCleaned && candidateCleaned.length >= 2) {
              bestCleaned = candidateCleaned;
              selectedTranscript = altText;
              break; // Pick the top valid alternative
            }
          }
        }
      }

      if (!bestCleaned && event.results[0]?.[0]?.transcript) {
        selectedTranscript = event.results[0][0].transcript.trim();
        bestCleaned = normalizeForField(field.key, selectedTranscript);
      }

      setMicState(MIC_STATE.PROCESSING);

      const cleaned = bestCleaned;

      // Strict validation for captured voice field
      let isValid = true;
      let errorMsg = '';

      if (field.key === 'phone') {
        const digitsOnly = cleaned.replace(/\D/g, '');
        if (!digitsOnly || digitsOnly.length !== 10) {
          isValid = false;
          errorMsg = 'Please say your 10-digit phone number clearly (numbers only).';
        }
      } else if (field.key === 'email') {
        if (!cleaned || !cleaned.includes('@') || !cleaned.includes('.')) {
          isValid = false;
          errorMsg = "Email incomplete. Please say full email including '@' and domain (e.g. 'priyansh123 at juetguna dot in').";
        }
      } else if (field.key === 'name') {
        if (!cleaned || cleaned.trim().length < 2) {
          isValid = false;
          errorMsg = 'Please say your full name clearly.';
        }
      } else if (!cleaned || cleaned.trim().length === 0) {
        isValid = false;
        errorMsg = `Could not capture ${field.label}. Please try again.`;
      }

      if (!isValid) {
        toast.error(errorMsg, { duration: 4000 });
        setMicState(MIC_STATE.ERROR);
        return;
      }

      setForm((f) => ({ ...f, [field.key]: cleaned }));
      setCapturedFields((prev) => new Set([...prev, field.key]));
      setMicState(MIC_STATE.CAPTURED);

      const nextIndex = fieldIndex + 1;
      if (nextIndex < VOICE_FIELDS.length) {
        setTimeout(() => {
          setActiveFieldIndex(nextIndex);
          listenForField(nextIndex);
        }, 700);
      } else {
        setTimeout(() => {
          setMicState(MIC_STATE.COMPLETE);
          toast.success('All fields captured! Reviewing details…');
          setStep(3);
        }, 800);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') {
        toast.error(`No speech detected for ${field.label}. Click mic to try again.`);
      } else if (event.error !== 'aborted') {
        toast.error(`Speech recognition error: ${event.error}`);
      }
      setMicState(MIC_STATE.ERROR);
    };

    recognition.onend = () => {
      setMicState((prev) => (prev === MIC_STATE.LISTENING ? MIC_STATE.IDLE : prev));
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setMicState(MIC_STATE.ERROR);
    }
  }, [speechSupported, normalizeForField]);

  const startVoiceRegistration = useCallback(() => {
    const firstIncomplete = VOICE_FIELDS.findIndex((f) => !capturedFields.has(f.key));
    const targetIndex = firstIncomplete !== -1 ? firstIncomplete : 0;
    setActiveFieldIndex(targetIndex);
    listenForField(targetIndex);
  }, [capturedFields, listenForField]);

  const retryField = useCallback((fieldIndex) => {
    setActiveFieldIndex(fieldIndex);
    listenForField(fieldIndex);
  }, [listenForField]);

  // ─── Validation ───────────────────────────────────────────────────────────────
  const validateDetails = () => {
    const errors = {};
    if (!form.name.trim() || form.name.trim().length < 2) errors.name = 'Full name is required.';
    if (!form.email.trim() || !form.email.includes('@')) errors.email = 'Valid Gmail / Email ID is required (e.g. name@gmail.com).';
    const phoneDigits = form.phone.replace(/\D/g, '');
    if (!form.phone.trim()) errors.phone = 'Phone number is required.';
    else if (phoneDigits.length !== 10) errors.phone = 'Phone must be exactly 10 digits.';
    if (!form.school_name.trim()) errors.school_name = 'School Name is required.';
    if (!form.city.trim()) errors.city = 'City name is required.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ─── Input sanitization — strip control chars & XSS-like content ──────────────
  const sanitizeText = (str) => {
    if (!str) return '';
    // Remove HTML tags, control characters, zero-width chars
    return str
      .replace(/<[^>]*>/g, '')        // strip HTML tags
      .replace(/[\x00-\x1F\x7F]/g, '') // strip control chars
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // strip zero-width chars
      .trim();
  };

  // ─── Submit to Supabase ───────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateDetails()) return;
    setSubmitting(true);
    try {
      const phoneDigits = form.phone.replace(/\D/g, '');

      // Reject obviously invalid phone patterns
      if (/^(\d)\1{9}$/.test(phoneDigits) || phoneDigits === '1234567890' || phoneDigits === '0987654321') {
        toast.error('Please enter a valid phone number.', { duration: 5000 });
        setSubmitting(false);
        return;
      }

      // RPC Duplicate check for email and normalized phone
      const emailClean = form.email.trim().toLowerCase();
      const { data: dupCheck, error: dupErr } = await supabase.rpc('check_existing_registration', {
        p_email: emailClean,
        p_phone: phoneDigits,
        p_session_id: form.sessionId,
      });

      if (!dupErr && dupCheck) {
        if (dupCheck.email_exists) {
          toast.error(`This email is already registered for this session (ID: ${dupCheck.existing_reg_id}). Each student can only register once per session.`, { duration: 7000 });
          setSubmitting(false);
          return;
        }
        if (dupCheck.phone_exists) {
          toast.error(`This phone number (${phoneDigits}) is already registered for this session. Duplicate registrations are not allowed.`, { duration: 7000 });
          setSubmitting(false);
          return;
        }
      } else {
        // Fallback check 1: phone check
        const { data: existingStudents } = await supabase
          .from('students')
          .select('id')
          .eq('phone', phoneDigits);

        if (existingStudents && existingStudents.length > 0) {
          const studentIds = existingStudents.map((s) => s.id);
          const { data: existingReg } = await supabase
            .from('registrations')
            .select('id, registration_id')
            .in('student_id', studentIds)
            .eq('session_id', form.sessionId)
            .neq('registration_status', 'cancelled')
            .maybeSingle();

          if (existingReg) {
            toast.error(
              `This phone number is already registered for this session (ID: ${existingReg.registration_id}).`,
              { duration: 7000 }
            );
            setSubmitting(false);
            return;
          }
        }

        // Fallback check 2: email check
        const { data: existingEmailRegs } = await supabase
          .from('registrations')
          .select('id, registration_id')
          .eq('email', emailClean)
          .eq('session_id', form.sessionId)
          .neq('registration_status', 'cancelled')
          .maybeSingle();

        if (existingEmailRegs) {
          toast.error(
            `This email is already registered for this session (ID: ${existingEmailRegs.registration_id}).`,
            { duration: 7000 }
          );
          setSubmitting(false);
          return;
        }
      }

      let photoUrl = null;
      if (photoDataUrl) {
        const blob = await (await fetch(photoDataUrl)).blob();

        // 1. File size validation (max 5MB)
        if (blob.size > 5 * 1024 * 1024) {
          toast.error('Captured photo exceeds maximum allowed size of 5MB.');
          setSubmitting(false);
          return;
        }

        // 2. MIME type validation
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (blob.type && !allowedTypes.includes(blob.type)) {
          toast.error('Invalid photo format. Only JPEG, PNG, and WEBP images are allowed.');
          setSubmitting(false);
          return;
        }

        const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
        const filename = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('student-photos')
          .upload(filename, blob, { contentType: blob.type || 'image/jpeg', upsert: false });

        if (uploadError) {
          toast.error('Photo upload failed — continuing registration without photo.');
        } else if (uploadData) {
          // Public URL
          const { data: urlData } = supabase.storage.from('student-photos').getPublicUrl(uploadData.path);
          photoUrl = urlData?.publicUrl;

          // If bucket is private or public access is disabled, generate signed URL fallback
          if (!photoUrl || photoUrl.includes('null')) {
            const { data: signedData } = await supabase.storage
              .from('student-photos')
              .createSignedUrl(uploadData.path, 60 * 60 * 24 * 365 * 5); // 5-year signed URL
            if (signedData?.signedUrl) {
              photoUrl = signedData.signedUrl;
            }
          }
        }
      }

      // Sanitize all text inputs before inserting into DB
      const safeName = sanitizeText(form.name);
      const safeEmail = emailClean;
      const safePhone = phoneDigits;
      const safeSchool = sanitizeText(form.school_name);
      const safeCity = sanitizeText(form.city);
      const registrationId = generateRegistrationId();

      // 1. Try atomic register_student RPC function (with p_coordinator_id)
      let { data: rpcRes, error: rpcErr } = await supabase.rpc('register_student', {
        p_name: safeName,
        p_email: safeEmail,
        p_phone: safePhone,
        p_school_name: safeSchool,
        p_city: safeCity,
        p_photo_url: photoUrl,
        p_session_id: form.sessionId,
        p_registration_id: registrationId,
        p_coordinator_id: activeDeskUser?.id || null,
      });

      // If RPC failed due to signature mismatch, retry without p_coordinator_id
      if (rpcErr) {
        const retryRpc = await supabase.rpc('register_student', {
          p_name: safeName,
          p_email: safeEmail,
          p_phone: safePhone,
          p_school_name: safeSchool,
          p_city: safeCity,
          p_photo_url: photoUrl,
          p_session_id: form.sessionId,
          p_registration_id: registrationId,
        });
        if (!retryRpc.error && retryRpc.data) {
          rpcRes = retryRpc.data;
          rpcErr = null;
        }
      }

      let finalRegId = registrationId;
      let finalStudentId = null;

      if (!rpcErr && rpcRes && rpcRes.success) {
        finalRegId = rpcRes.registration_id || registrationId;
        finalStudentId = rpcRes.student_id || null;
      } else {
        if (rpcRes && rpcRes.success === false && rpcRes.error) {
          if (rpcRes.error.includes('23505') || rpcRes.error.includes('duplicate')) {
            toast.error('A student with these details is already registered for this session.');
          } else {
            toast.error('Registration failed: ' + rpcRes.error);
          }
          setSubmitting(false);
          return;
        }

        // 2. Fallback to direct insertion
        const { data: student, error: studentError } = await supabase
          .from('students')
          .insert({
            name: safeName,
            email: safeEmail,
            phone: safePhone,
            school_name: safeSchool,
            city: safeCity,
            photo_url: photoUrl,
          })
          .select()
          .single();

        if (studentError) {
          if (studentError.code === '23505') {
            toast.error('A student with these details may already be registered. Please check with the coordinator.', { duration: 6000 });
          } else {
            toast.error('Registration failed: ' + studentError.message);
          }
          setSubmitting(false);
          return;
        }

        finalStudentId = student.id;

        const regPayload = {
          student_id: student.id,
          session_id: form.sessionId,
          class: safeEmail,
          email: safeEmail,
          city: safeCity,
          registration_id: registrationId,
          registration_status: 'confirmed',
        };
        if (activeDeskUser?.id) {
          regPayload.coordinator_id = activeDeskUser.id;
        }

        let { data: reg, error: regError } = await supabase
          .from('registrations')
          .insert(regPayload)
          .select()
          .single();

        // If insert failed because coordinator_id column doesn't exist, retry without it
        if (regError && regError.message?.includes('coordinator_id')) {
          delete regPayload.coordinator_id;
          const retryInsert = await supabase
            .from('registrations')
            .insert(regPayload)
            .select()
            .single();
          reg = retryInsert.data;
          regError = retryInsert.error;
        }

        if (regError) {
          if (regError.code === '23505') {
            toast.error('This student is already registered for this session.', { duration: 6000 });
          } else {
            toast.error('Registration failed: ' + regError.message);
          }
          setSubmitting(false);
          return;
        }

        if (reg?.registration_id) {
          finalRegId = reg.registration_id;
        }
      }

      const selectedSess = sessions.find((s) => s.id === form.sessionId);
      const registrationData = {
        id: finalRegId,
        registration_id: finalRegId,
        class: safeEmail,
        email: safeEmail,
        city: safeCity,
        registration_status: 'confirmed',
        registered_at: new Date().toISOString(),
        students: {
          id: finalStudentId,
          name: safeName,
          email: safeEmail,
          phone: safePhone,
          school_name: safeSchool,
          city: safeCity,
          photo_url: photoUrl,
        },
        sessions: {
          name: selectedSess?.name || 'Capacity Building Program',
        },
      };

      navigate(`/success/${finalRegId}`, { state: { registrationData } });
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
      console.error(err);
      setSubmitting(false);
    }
  };

  const getMicLabel = () => {
    const field = VOICE_FIELDS[activeFieldIndex];
    if (micState === MIC_STATE.LISTENING) return `Listening for ${field?.label}…`;
    if (micState === MIC_STATE.PROCESSING) return `Processing…`;
    if (micState === MIC_STATE.CAPTURED) return `Got it! Moving to next…`;
    if (micState === MIC_STATE.ERROR) return `Retrying…`;
    if (micState === MIC_STATE.COMPLETE) return `All done! Reviewing…`;
    return 'Tap to start voice registration';
  };

  const isListening = micState === MIC_STATE.LISTENING || micState === MIC_STATE.PROCESSING;

  // ─── RENDER ───────────────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size="lg" />
      </div>
    );
  }

  // ── Coordinator Desk Login Guard ──
  if (!activeDeskUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
          <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/95 border border-slate-200 flex items-center justify-center shadow-sm p-1">
                <img src="/juet-logo.png" alt="JUET Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">CAPACITY BUILDING PROGRAM</h1>
                <p className="text-xs text-slate-400">REGISTRATION COUNTER & KIOSK SYSTEM</p>
              </div>
            </div>
            <a
              href="/admin/login"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              title="Open Admin Portal in new tab"
            >
              <Shield size={14} className="text-blue-600" /> ADMIN PORTAL
            </a>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6 bg-slate-50">
          <div className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
                <UserCheck size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-bold text-slate-900">Coordinator Desk Login</h1>
              <p className="text-slate-500 text-sm mt-1">
                Enter the approved coordinator email and password provided by the admin to open this counter.
              </p>
            </div>

            <form onSubmit={handleCoordLogin} className="card p-8 space-y-5">
              <div>
                <label className="label text-sm font-semibold text-slate-700" htmlFor="coord-email">Coordinator Approved Email *</label>
                <input
                  id="coord-email"
                  type="email"
                  className="input-field"
                  placeholder="approved-coordinator@example.com"
                  value={coordEmail}
                  onChange={(e) => setCoordEmail(e.target.value)}
                  required
                  disabled={isLoginLocked}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label text-sm font-semibold text-slate-700" htmlFor="coord-password">Password (Given by Admin) *</label>
                <div className="relative">
                  <input
                    id="coord-password"
                    type={showCoordPass ? 'text' : 'password'}
                    className="input-field pr-11"
                    placeholder="••••••••"
                    value={coordPass}
                    onChange={(e) => setCoordPass(e.target.value)}
                    required
                    disabled={isLoginLocked}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCoordPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCoordPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Rate-limit warning */}
              {isLoginLocked && (
                <div className="flex items-center gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
                  <Lock size={13} className="flex-shrink-0" />
                  Too many failed attempts. Please wait {loginLockSecondsLeft}s before trying again.
                </div>
              )}

              <button type="submit" className="btn-primary w-full" disabled={loggingInCoord || isLoginLocked}>
                {loggingInCoord ? <Spinner size="sm" /> : <LogIn size={16} />}
                {loggingInCoord ? 'Authenticating Desk…' : isLoginLocked ? `Locked (${loginLockSecondsLeft}s)` : 'Start Processing Registrations'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/95 border border-slate-200 flex items-center justify-center shadow-sm p-1">
              <img src="/juet-logo.png" alt="JUET Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">CAPACITY BUILDING PROGRAM</h1>
              <p className="text-xs text-slate-400 font-medium">Registration Counter & Kiosk System</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/admin/login"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              title="Open Admin Portal in new tab"
            >
              <Shield size={14} className="text-blue-600" /> Admin Portal
            </a>
            <Link
              to="/verify"
              className="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
              title="Verify Certificate"
            >
              <Shield size={14} className="text-blue-600" /> Verify Certificate
            </Link>
            <button
              onClick={openCheckRegs}
              className="btn-secondary py-1.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
              title="Check Total Registrations"
            >
              <ClipboardList size={14} /> Check Registrations
            </button>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Desk Active: {activeDeskUser?.full_name || activeDeskUser?.email}
            </span>
            <button
              onClick={handleDeskLogout}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
              title="Sign Out Counter Operator"
            >
              <LogOut size={13} /> Desk Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0">
        {/* Fixed Info Sidebar — desktop only */}
        <aside className="hidden lg:flex flex-col justify-center bg-gradient-to-b from-blue-700 to-blue-800 text-white px-10 py-12 lg:w-80 xl:w-96 flex-shrink-0 h-full overflow-hidden">
          <div className="w-14 h-14 bg-white/95 rounded-2xl flex items-center justify-center mb-6 shadow-md p-1.5">
            <img src="/juet-logo.png" alt="JUET Logo" className="w-full h-full object-contain" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Register for a Program</h2>
          <p className="text-blue-200 text-sm leading-relaxed mb-8">
            Fill your details or use the 1-click voice assistant. Your ID card will be ready immediately upon submission.
          </p>
          <div className="space-y-4">
            {[
              { step: '1', label: 'Select Session', desc: 'Choose active program session' },
              { step: '2', label: 'Take Photo', desc: 'Optional — for ID card' },
              { step: '3', label: 'Fill / Voice Details', desc: 'Name, Gmail, Phone, School, City' },
              { step: '4', label: 'Review & Submit', desc: 'Confirm and download card' },
            ].map(({ step: s, label, desc }) => (
              <div key={s} className="flex items-start gap-3">
                <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold mt-0.5 ${Number(s) <= step + 1 ? 'bg-white text-blue-700' : 'bg-blue-600/60 text-blue-200'
                  }`}>{s}</div>
                <div>
                  <p className={`text-sm font-semibold ${Number(s) <= step + 1 ? 'text-white' : 'text-blue-300'}`}>{label}</p>
                  <p className="text-xs text-blue-300">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 pt-5 border-t border-blue-600/40 text-xs text-blue-200/90 space-y-1">
            <p className="font-bold text-white text-xs">Capacity Building Programm</p>
            <p className="text-[11px] text-blue-200">Jaypee University of Engineering & Technology, Guna</p>
            <p className="text-[10px] text-blue-300/80 pt-1">Designed & Developed by Priyansh goyal & Team</p>
            <p className="text-[10px] text-blue-300/60">© {new Date().getFullYear()} Priyansh goyal. All Rights Reserved.</p>
          </div>
        </aside>

        {/* Scrollable Form & Details Section */}
        <div className="flex-1 flex flex-col items-center justify-start p-4 py-8 overflow-y-auto h-full">
          <div className="w-full max-w-xl">
            <StepIndicator step={step} />

            <div className="card p-8 shadow-xl">

              {/* ── Step 0: Select Session ── */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900 mb-1">Select a Session</h1>
                    <p className="text-slate-500 text-sm">Choose the active program session to register the student.</p>
                  </div>
                  {loadingSessions ? (
                    <div className="flex justify-center py-10"><Spinner /></div>
                  ) : sessions.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-slate-500 font-semibold">No active sessions available today.</p>
                      <p className="text-slate-400 text-xs mt-1">Sessions expire automatically at 00:00 AM on their End Date.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {sessions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setForm((f) => ({ ...f, sessionId: s.id }))}
                          className={`w-full text-left p-4 rounded-xl border-2 transition-all ${form.sessionId === s.id
                            ? 'border-blue-500 bg-blue-50 text-slate-900'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                            }`}
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{s.name}</p>
                            {form.sessionId === s.id && (
                              <CheckCircle size={18} className="text-blue-600 flex-shrink-0" />
                            )}
                          </div>
                          {s.description && <p className="text-sm text-slate-500 mt-0.5">{s.description}</p>}
                          <p className="text-xs text-slate-400 mt-1">
                            {new Date(s.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {' — '}
                            {new Date(s.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="btn-primary w-full"
                    disabled={!form.sessionId}
                    onClick={() => setStep(1)}
                  >
                    Continue to Photo <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* ── Step 1: Photo ── */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Student Photo</h2>
                    <p className="text-slate-500 text-sm">Take a photo for the student ID card (Optional).</p>
                  </div>

                  <div className="flex flex-col items-center gap-4">
                    {photoDataUrl ? (
                      <div className="relative">
                        <img src={photoDataUrl} alt="Captured" className="w-44 h-52 object-cover rounded-2xl border-4 border-blue-500 shadow-md" />
                        <span className="absolute bottom-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><CheckCircle size={16} /></span>
                      </div>
                    ) : cameraEnabled ? (
                      <div className="w-full max-w-sm rounded-2xl overflow-hidden border-2 border-slate-300 bg-black">
                        <Webcam
                          audio={false}
                          ref={webcamRef}
                          screenshotFormat="image/jpeg"
                          className="w-full h-auto -scale-x-1"
                          style={{ transform: 'scaleX(-1)' }}
                        />
                      </div>
                    ) : (
                      <div className="w-44 h-52 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                        <Camera size={36} className="mb-2" />
                        <span className="text-xs text-center px-4">Camera disabled</span>
                      </div>
                    )}

                    <div className="flex gap-3 flex-wrap justify-center">
                      {!cameraEnabled && !photoDataUrl && (
                        <button className="btn-primary" onClick={() => setCameraEnabled(true)}>
                          <Camera size={16} /> Enable Camera
                        </button>
                      )}
                      {cameraEnabled && !photoDataUrl && (
                        <button className="btn-primary" onClick={capture}>
                          <Camera size={16} /> Capture Photo
                        </button>
                      )}
                      {photoDataUrl && (
                        <button className="btn-secondary" onClick={retake}>
                          <RefreshCw size={16} /> Retake
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between">
                    <button className="btn-secondary" onClick={() => setStep(0)}>
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button className="btn-primary" onClick={() => { setActiveFieldIndex(0); setCapturedFields(new Set()); setMicState(MIC_STATE.IDLE); setStep(2); }}>
                      {photoDataUrl ? 'Continue' : 'Skip Photo'} <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 2: Voice & Self Details Entry ── */}
              {step === 2 && (
                <div className="space-y-6">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-1">Student Details</h2>
                      <p className="text-slate-500 text-sm">
                        Fill details below or tap the microphone to speak naturally.
                      </p>
                    </div>
                    {photoDataUrl && (
                      <img src={photoDataUrl} alt="Photo" className="w-12 h-14 object-cover rounded-lg border-2 border-blue-300 flex-shrink-0" />
                    )}
                  </div>

                  {/* ── 1-Click Voice Assistant ── */}
                  {speechSupported && (
                    <div className="flex flex-col items-center gap-3 py-3 bg-blue-50/70 border border-blue-100 rounded-2xl p-4">
                      <button
                        type="button"
                        onClick={startVoiceRegistration}
                        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 shadow-md ${isListening
                          ? 'bg-red-500 text-white shadow-red-300 scale-105'
                          : micState === MIC_STATE.COMPLETE
                            ? 'bg-emerald-500 text-white shadow-emerald-200'
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:scale-105'
                          }`}
                      >
                        {isListening ? <MicOff size={24} /> : <Mic size={24} />}
                        {isListening && (
                          <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-40" />
                        )}
                      </button>

                      <p className={`text-xs font-semibold text-center ${isListening ? 'text-red-600' : micState === MIC_STATE.COMPLETE ? 'text-emerald-600' : 'text-slate-600'
                        }`}>
                        {getMicLabel()}
                      </p>
                    </div>
                  )}

                  {/* ── Prominent Large-Title Fields for Self Filling with Auto Scroll ── */}
                  <div className="space-y-6 pt-2">
                    {VOICE_FIELDS.map((field, i) => {
                      const isCurrent = i === activeFieldIndex;
                      const isActiveListening = isCurrent && isListening;
                      const isDone = capturedFields.has(field.key);
                      const Icon = field.icon;
                      return (
                        <div
                          key={field.key}
                          ref={(el) => (fieldRefs.current[i] = el)}
                          className={`p-4 rounded-2xl border transition-all duration-300 ${isActiveListening
                            ? 'bg-red-50/60 border-red-400 ring-2 ring-red-200 shadow-md'
                            : isCurrent
                              ? 'bg-blue-50/50 border-blue-500 ring-2 ring-blue-200 shadow-md'
                              : 'bg-slate-50/50 border-slate-200/80'
                            }`}
                        >
                          {/* Prominent Large Title */}
                          <label
                            className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2 mb-2"
                            htmlFor={`voice-${field.key}`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isCurrent ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-600'
                              }`}>
                              <Icon size={16} />
                            </div>
                            <span>{field.label} *</span>
                            {isDone && <Check size={16} className="text-emerald-600 ml-auto" />}
                          </label>

                          <div className="relative">
                            <input
                              id={`voice-${field.key}`}
                              className={
                                isDone
                                  ? 'w-full bg-emerald-50 border-2 border-emerald-400 rounded-xl px-4 py-3 text-slate-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all'
                                  : isActiveListening
                                    ? 'w-full bg-white border-2 border-red-400 rounded-xl px-4 py-3 text-slate-900 text-base font-medium focus:outline-none focus:ring-2 focus:ring-red-400 transition-all shadow-md'
                                    : fieldErrors[field.key]
                                      ? 'w-full bg-white border-2 border-red-400 rounded-xl px-4 py-3 text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-red-400 transition-all'
                                      : 'w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 text-slate-900 text-base placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all font-medium'
                              }
                              placeholder={isActiveListening ? `🎤 ${field.hint}` : field.placeholder}
                              value={form[field.key]}
                              onFocus={() => setActiveFieldIndex(i)}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, [field.key]: e.target.value }));
                                setFieldErrors((er) => ({ ...er, [field.key]: undefined }));
                              }}
                            />
                            {speechSupported && isDone && !isListening && (
                              <button
                                type="button"
                                title="Re-record voice for this field"
                                onClick={() => retryField(i)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                              >
                                <Mic size={16} />
                              </button>
                            )}
                          </div>
                          <FieldError message={fieldErrors[field.key]} />
                          <p className="text-xs text-slate-400 mt-1.5 font-medium">{field.hint}</p>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-4">
                    <button
                      className="btn-secondary"
                      onClick={() => { recognitionRef.current?.abort(); setMicState(MIC_STATE.IDLE); setStep(1); }}
                    >
                      <ChevronLeft size={16} /> Back
                    </button>
                    <button
                      className="btn-primary"
                      onClick={() => { if (validateDetails()) setStep(3); }}
                    >
                      Review Details <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* ── Step 3: Confirm & Submit ── */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">Confirm Registration</h2>
                    <p className="text-slate-500 text-sm">Review details — click any row to modify manually.</p>
                  </div>

                  {photoDataUrl && (
                    <div className="flex justify-center">
                      <img
                        src={photoDataUrl}
                        alt="Student"
                        className="w-20 h-24 object-cover rounded-xl border-2 border-blue-300 shadow-sm"
                      />
                    </div>
                  )}

                  <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-200">
                    <ConfirmRow label="Session" value={selectedSession?.name} readOnly />
                    {VOICE_FIELDS.map((field) => (
                      <EditableConfirmRow
                        key={field.key}
                        label={field.label}
                        fieldKey={field.key}
                        value={form[field.key]}
                        icon={field.icon}
                        editing={editingField === field.key}
                        error={fieldErrors[field.key]}
                        onEdit={() => setEditingField(field.key)}
                        onSave={(val) => {
                          setForm((f) => ({ ...f, [field.key]: val }));
                          setFieldErrors((e) => ({ ...e, [field.key]: undefined }));
                          setEditingField(null);
                        }}
                        onCancel={() => setEditingField(null)}
                      />
                    ))}
                    <ConfirmRow label="Photo" value={photoDataUrl ? '✓ Captured' : 'None (optional)'} readOnly />
                  </div>

                  <div className="flex gap-3">
                    <button
                      className="btn-secondary flex-1"
                      onClick={() => { setEditingField(null); setStep(2); }}
                      disabled={submitting}
                    >
                      <ChevronLeft size={16} /> Edit
                    </button>
                    <button
                      className="btn-primary flex-1"
                      onClick={handleSubmit}
                      disabled={submitting || !!editingField}
                    >
                      {submitting ? <Spinner size="sm" /> : <CheckCircle size={16} />}
                      {submitting ? 'Submitting…' : 'Confirm & Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Coordinator Check Registrations Modal ── */}
      <Modal isOpen={checkRegsOpen} onClose={() => setCheckRegsOpen(false)} title="Recent Registrations Status" size="lg">
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Check the live list of student registrations submitted at the desk to verify success.
          </p>
          {loadingRegs ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : sessionRegs.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList size={36} className="text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">No registrations recorded yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-96 scrollbar-thin">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-100 text-slate-600">
                    <th className="p-2.5 rounded-l-lg">Student Name</th>
                    <th className="p-2.5">Gmail ID / City</th>
                    <th className="p-2.5">Reg ID</th>
                    <th className="p-2.5">Status</th>
                    <th className="p-2.5 rounded-r-lg text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionRegs.map((r) => (
                    <tr key={r.registration_id} className="hover:bg-slate-50">
                      <td className="p-2.5">
                        <p className="font-semibold text-slate-900">{r.students?.name}</p>
                        <p className="text-[11px] text-slate-400">{r.students?.school_name}</p>
                      </td>
                      <td className="p-2.5 text-slate-600">
                        <p>{r.students?.email || r.email || '—'}</p>
                        <p className="text-[11px] text-slate-400">{r.students?.city || r.city || '—'}</p>
                      </td>
                      <td className="p-2.5 font-mono text-slate-500">{r.registration_id}</td>
                      <td className="p-2.5">
                        <span className="badge-green">confirmed</span>
                      </td>
                      <td className="p-2.5 text-right text-slate-400">
                        {new Date(r.registered_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex justify-end pt-2">
            <button className="btn-secondary text-xs" onClick={() => setCheckRegsOpen(false)}>Close</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ConfirmRow({ label, value }) {
  return (
    <div className="flex justify-between items-center px-5 py-3">
      <span className="text-sm text-slate-500 flex-shrink-0 w-28">{label}</span>
      <span className="text-sm text-slate-900 font-medium text-right">{value || '—'}</span>
    </div>
  );
}

function EditableConfirmRow({ label, fieldKey, value, icon: Icon, editing, error, onEdit, onSave, onCancel }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);

  if (editing) {
    return (
      <div className="px-5 py-3 bg-blue-50">
        <label className="text-xs font-medium text-blue-600 mb-1 block">
          {Icon && <Icon size={12} className="inline mr-1" />}{label}
        </label>
        <div className="flex gap-2">
          <input
            autoFocus
            className="flex-1 bg-white border-2 border-blue-400 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSave(draft); if (e.key === 'Escape') onCancel(); }}
          />
          <button
            onClick={() => onSave(draft)}
            className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
            title="Save"
          ><Check size={14} /></button>
          <button
            onClick={onCancel}
            className="p-1.5 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"
            title="Cancel"
          ><X size={14} /></button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={10} />{error}</p>}
      </div>
    );
  }

  return (
    <button
      className="w-full flex justify-between items-center px-5 py-3 hover:bg-slate-100 transition-colors text-left group"
      onClick={onEdit}
    >
      <span className="text-sm text-slate-500 flex-shrink-0 w-28">
        {Icon && <Icon size={12} className="inline mr-1" />}{label}
      </span>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-medium ${value ? 'text-slate-900' : 'text-slate-400'}`}>{value || '—'}</span>
        <Edit2 size={13} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </button>
  );
}
