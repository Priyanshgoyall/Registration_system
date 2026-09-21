import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, Download, Printer, Home } from 'lucide-react';
import { supabase } from '@db/client';
import RegistrationCard from '@shared/components/RegistrationCard';
import Spinner from '@shared/components/Spinner';
import { generateQRDataUrl } from '@shared/utils/generateQR';
import { downloadAsPDF } from '@shared/utils/generatePDF';

export default function SuccessPage() {
  const { registrationId } = useParams();
  const location = useLocation();
  const cardRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      // Set initial data from location state if available (for instant UI render)
      if (location.state?.registrationData) {
        setData(location.state.registrationData);
        const qr = await generateQRDataUrl('https://www.juet.ac.in/');
        setQrDataUrl(qr);
        setLoading(false);
      }

      if (!registrationId) {
        setLoading(false);
        return;
      }

      const cleanRegId = String(registrationId).trim();

      // 1. Try RPC function get_registration_public
      const { data: rpcReg, error: rpcError } = await supabase.rpc('get_registration_public', { p_reg_id: cleanRegId });
      if (!rpcError && rpcReg && (rpcReg.id || rpcReg.registration_id)) {
        setData(rpcReg);
        const qrUrl = 'https://www.juet.ac.in/';
        const qr = await generateQRDataUrl(qrUrl);
        setQrDataUrl(qr);
        setLoading(false);
        return;
      }

      // 2. Fallback direct table query by registration_id
      let { data: reg } = await supabase
        .from('registrations')
        .select(`
          *,
          students (*),
          sessions (*)
        `)
        .ilike('registration_id', cleanRegId)
        .maybeSingle();

      // 3. Fallback direct table query by UUID id
      if (!reg && cleanRegId.length > 20) {
        const { data: regById } = await supabase
          .from('registrations')
          .select(`
            *,
            students (*),
            sessions (*)
          `)
          .eq('id', cleanRegId)
          .maybeSingle();
        reg = regById;
      }

      if (reg) {
        setData(reg);
        const qrUrl = 'https://www.juet.ac.in/';
        const qr = await generateQRDataUrl(qrUrl);
        setQrDataUrl(qr);
      } else if (!location.state?.registrationData) {
        toast.error('Registration not found');
      }

      setLoading(false);
    }
    fetchData();
  }, [registrationId, location.state]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    const ok = await downloadAsPDF(cardRef.current, `reg-card-${registrationId}`);
    if (!ok) toast.error('PDF download failed');
    setDownloading(false);
  };

  const handlePrint = () => window.print();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex flex-col items-center justify-center gap-4 p-4 text-white">
        <p className="text-slate-300 text-lg font-semibold">Registration not found.</p>
        <Link to="/" className="btn-gold">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col items-center justify-center p-4 py-12 relative overflow-hidden">
      {/* Header Institution Banner */}
      <div className="w-full max-w-xl flex items-center justify-between mb-8 bg-[#1c2541] px-6 py-4 rounded-2xl shadow-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white p-1 shadow-md">
            <img src="/juet-logo.png" alt="JUET Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-black text-white tracking-wide">JUET CAPACITY BUILDING PROGRAM</h1>
            <p className="text-xs text-[#c9a227] font-semibold uppercase tracking-wider">Registration Confirmation</p>
          </div>
        </div>
        <Link to="/" className="text-xs text-slate-300 hover:text-white font-semibold flex items-center gap-1">
          <Home size={14} /> New
        </Link>
      </div>

      {/* Success banner */}
      <div className="flex flex-col items-center text-center gap-2 mb-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-xl ring-4 ring-emerald-400/20 mb-1">
          <CheckCircle size={36} className="stroke-[2.5]" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Registration Successful!</h1>
        <p className="text-slate-600 text-sm max-w-md">Your official Capacity Building Program registration card has been generated.</p>
      </div>

      {/* Registration card */}
      <div className="mb-8 shadow-2xl rounded-2xl printable-card transition-all transform hover:scale-[1.01]">
        <RegistrationCard
          ref={cardRef}
          student={data.students}
          session={data.sessions}
          registration={data}
          qrDataUrl={qrDataUrl}
        />
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3 justify-center">
        <button onClick={handleDownload} disabled={downloading} className="btn-gold px-6 py-3 text-sm">
          {downloading ? <Spinner size="sm" /> : <Download size={18} />}
          {downloading ? 'Generating PDF…' : 'Download ID Card (PDF)'}
        </button>
        <button onClick={handlePrint} className="btn-navy px-6 py-3 text-sm">
          <Printer size={18} /> Print Card
        </button>
        <Link to="/" className="btn-secondary px-5 py-3 text-sm">
          <Home size={18} /> New Registration
        </Link>
      </div>

      {/* Registration ID callout */}
      <div className="mt-8 text-center bg-white border border-slate-200 shadow-md rounded-2xl px-8 py-4">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Official Registration ID</p>
        <p className="text-2xl font-black font-mono text-[#1c2541] tracking-wider">{registrationId}</p>
        <p className="text-slate-500 text-xs mt-1">Keep this ID safe for desk check-in and certificate distribution.</p>
      </div>
    </div>
  );
}
