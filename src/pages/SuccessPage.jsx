import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle, Download, Printer, Home } from 'lucide-react';
import { supabase } from '../lib/supabase';
import RegistrationCard from '../components/RegistrationCard';
import Spinner from '../components/Spinner';
import { generateQRDataUrl } from '../utils/generateQR';
import { downloadAsPDF } from '../utils/generatePDF';

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-slate-500 text-lg">Registration not found.</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 py-12">
      {/* Success banner */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center">
          <CheckCircle size={24} className="text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Registration Successful!</h1>
          <p className="text-slate-500 text-sm">Save or print your registration card below.</p>
        </div>
      </div>

      {/* Registration card */}
      <div className="mb-8 shadow-lg rounded-2xl printable-card">
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
        <button onClick={handleDownload} disabled={downloading} className="btn-primary">
          {downloading ? <Spinner size="sm" /> : <Download size={16} />}
          {downloading ? 'Generating…' : 'Download PDF'}
        </button>
        <button onClick={handlePrint} className="btn-secondary">
          <Printer size={16} /> Print
        </button>
        <Link to="/" className="btn-secondary">
          <Home size={16} /> New Registration
        </Link>
      </div>

      {/* Registration ID callout */}
      <div className="mt-8 text-center">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Your Registration ID</p>
        <p className="text-2xl font-bold font-mono text-blue-600">{registrationId}</p>
        <p className="text-slate-400 text-xs mt-1">Keep this safe for attendance and certificate collection.</p>
      </div>
    </div>
  );
}
