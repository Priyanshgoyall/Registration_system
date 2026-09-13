import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, Search, CheckCircle, XCircle, GraduationCap, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Spinner from '../components/Spinner';

export default function VerifyPage() {
  const [searchParams] = useSearchParams();
  const [certId, setCertId] = useState(() => searchParams.get('cert') ?? '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);

  // Auto-verify when a cert ID is in the URL (e.g. from a QR scan)
  useEffect(() => {
    const certFromUrl = searchParams.get('cert');
    if (certFromUrl && certFromUrl.trim()) {
      setCertId(certFromUrl.trim().toUpperCase());
      doVerify(certFromUrl.trim().toUpperCase());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doVerify = async (id) => {
    const trimmed = (id || certId).trim();
    if (!trimmed) return;
    setLoading(true);
    setResult(null);
    setNotFound(false);

    try {
      // 1. Try secure RPC function (which works even when anonymous table scanning is disabled)
      const { data: rpcData, error: rpcError } = await supabase.rpc('verify_certificate', { p_cert_id: trimmed });
      if (!rpcError && rpcData && rpcData.id) {
        setResult(rpcData);
        setLoading(false);
        return;
      }

      // 2. Fallback to direct table query
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          registrations (
            registration_id,
            class,
            registration_status,
            students ( name, school_name ),
            sessions ( name, start_date, end_date )
          )
        `)
        .eq('certificate_id', trimmed)
        .single();

      setLoading(false);

      if (error || !data) {
        setNotFound(true);
      } else {
        setResult(data);
      }
    } catch {
      setLoading(false);
      setNotFound(true);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    doVerify(certId);
  };

  const reg = result?.registrations;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <span className="font-bold text-slate-800 text-lg">Certificate Verification</span>
        </div>
        <Link to="/" className="text-sm text-slate-500 hover:text-slate-700 transition-colors flex items-center gap-1 font-medium">
          <ArrowLeft size={14} /> Register
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center">
              <Shield size={28} className="text-blue-600" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 text-center mb-2">Verify Certificate</h1>
          <p className="text-slate-500 text-sm text-center mb-8">
            Enter a certificate ID to verify its authenticity.
          </p>

          <form onSubmit={handleVerify} className="flex gap-3 mb-8">
            <input
              id="cert-id-input"
              className="input-field flex-1"
              placeholder="CERT-XXXXXXXX"
              value={certId}
              onChange={(e) => setCertId(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button type="submit" className="btn-primary flex-shrink-0" disabled={loading}>
              {loading ? <Spinner size="sm" /> : <Search size={16} />}
            </button>
          </form>

          {/* Not found */}
          {notFound && (
            <div className="card p-6 flex flex-col items-center gap-3">
              <XCircle size={36} className="text-red-500" />
              <p className="text-slate-900 font-semibold">Certificate Not Found</p>
              <p className="text-slate-500 text-sm text-center">
                No certificate with ID <span className="font-mono text-slate-700">{certId}</span> exists.
                Please double-check the ID.
              </p>
            </div>
          )}

          {/* Found */}
          {result && (
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-5">
                {result.verification_status === 'valid' ? (
                  <CheckCircle size={28} className="text-emerald-600 flex-shrink-0" />
                ) : (
                  <XCircle size={28} className="text-red-500 flex-shrink-0" />
                )}
                <div>
                  <p className="text-lg font-bold text-slate-900">
                    {result.verification_status === 'valid' ? 'Valid Certificate' : 'Revoked Certificate'}
                  </p>
                  <p className="text-xs text-slate-500">
                    Issued {new Date(result.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="space-y-3 text-sm">
                <Row label="Certificate ID" value={<span className="font-mono">{result.certificate_id}</span>} />
                <Row label="Student" value={reg?.students?.name} />
                <Row label="School" value={reg?.students?.school_name} />
                <Row label="Class" value={reg?.class} />
                <Row label="Session" value={reg?.sessions?.name} />
                <Row
                  label="Status"
                  value={
                    <span className={result.verification_status === 'valid' ? 'badge-green' : 'badge-red'}>
                      {result.verification_status}
                    </span>
                  }
                />
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium text-right">{value ?? '—'}</span>
    </div>
  );
}
