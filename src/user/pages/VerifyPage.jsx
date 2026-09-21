import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Shield, Search, CheckCircle, XCircle, GraduationCap, ArrowLeft } from 'lucide-react';
import { supabase } from '@db/client';
import Spinner from '@shared/components/Spinner';

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
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#1c2541] border-b border-slate-700 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-sm">
            <img src="/juet-logo.png" alt="JUET Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-black text-white text-base tracking-wide">JUET CAPACITY BUILDING PROGRAM</h1>
            <p className="text-xs text-[#c9a227] font-semibold tracking-wider uppercase">Official Certificate Verification Portal</p>
          </div>
        </div>
        <Link to="/" className="text-xs text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 font-bold bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
          <ArrowLeft size={14} /> Back to Kiosk
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-[#1c2541] text-[#c9a227] border border-slate-700 flex items-center justify-center shadow-xl shadow-[#1c2541]/20">
              <Shield size={32} />
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 text-center mb-2 tracking-tight">Verify Certificate</h1>
          <p className="text-slate-600 text-sm text-center mb-8">
            Enter the unique Certificate ID printed on the student certificate or scan the QR code.
          </p>

          <form onSubmit={handleVerify} className="flex gap-2.5 mb-8">
            <input
              id="cert-id-input"
              className="w-full bg-white border-2 border-slate-300 rounded-xl px-4 py-3 text-slate-900 font-mono font-bold text-base placeholder-slate-400 focus:border-[#1c2541] focus:outline-none focus:ring-2 focus:ring-[#1c2541]/20 transition-all shadow-sm flex-1"
              placeholder="CERT-XXXXXXXX"
              value={certId}
              onChange={(e) => setCertId(e.target.value.toUpperCase())}
              autoComplete="off"
            />
            <button type="submit" className="btn-navy flex-shrink-0 px-5 py-3" disabled={loading}>
              {loading ? <Spinner size="sm" /> : <Search size={18} />}
            </button>
          </form>

          {/* Not found */}
          {notFound && (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-red-200 flex flex-col items-center gap-3 text-center">
              <XCircle size={40} className="text-red-500" />
              <p className="text-slate-900 font-bold text-lg">Certificate Not Found</p>
              <p className="text-slate-600 text-sm">
                No certificate with ID <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">{certId}</span> was found in the official registry.
              </p>
            </div>
          )}

          {/* Found */}
          {result && (
            <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                {result.verification_status === 'valid' ? (
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={28} className="stroke-[2.5]" />
                  </div>
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center flex-shrink-0">
                    <XCircle size={28} className="stroke-[2.5]" />
                  </div>
                )}
                <div>
                  <p className="text-lg font-black text-slate-900">
                    {result.verification_status === 'valid' ? 'Authentic Certificate' : 'Revoked Certificate'}
                  </p>
                  <p className="text-xs text-slate-500 font-medium">
                    Issued {new Date(result.issued_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              <div className="space-y-3.5 text-sm">
                <Row label="Certificate ID" value={<span className="font-mono font-bold text-[#1c2541]">{result.certificate_id}</span>} />
                <Row label="Student Name" value={reg?.students?.name} />
                <Row label="School / Institution" value={reg?.students?.school_name} />
                <Row label="Class / Standard" value={reg?.class} />
                <Row label="Program Session" value={reg?.sessions?.name} />
                <Row
                  label="Status"
                  value={
                    <span className={result.verification_status === 'valid' ? 'badge-green text-xs font-bold' : 'badge-red text-xs font-bold'}>
                      {result.verification_status?.toUpperCase()}
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
