import { forwardRef } from 'react';
import { GraduationCap, QrCode } from 'lucide-react';

/**
 * Printable/downloadable registration card
 * Ref is forwarded so parent can capture it with html2canvas
 */
const RegistrationCard = forwardRef(function RegistrationCard(
  { student, session, registration, qrDataUrl },
  ref
) {
  const emailVal = student?.email || registration?.email;
  const cityVal = student?.city || registration?.city;

  return (
    <div
      ref={ref}
      className="bg-white text-slate-900 rounded-2xl overflow-hidden shadow-2xl"
      style={{ width: '400px', fontFamily: 'Inter, system-ui, sans-serif' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-5 flex items-center gap-3">
        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <GraduationCap size={22} className="text-white" />
        </div>
        <div>
          <p className="text-xs text-blue-200 font-medium uppercase tracking-widest">Registration Card</p>
          <p className="text-base font-bold text-white">{session?.name ?? 'Session'}</p>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 flex gap-4">
        {/* Photo */}
        <div className="flex-shrink-0">
          {student?.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.name}
              className="w-20 h-24 object-cover rounded-xl border-2 border-slate-200"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-20 h-24 bg-slate-100 rounded-xl border-2 border-slate-200 flex items-center justify-center">
              <GraduationCap size={28} className="text-slate-400" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-slate-900 truncate">{student?.name}</p>
          <p className="text-sm text-slate-500 mb-2 truncate">{student?.school_name}</p>
          <div className="space-y-1">
            <Row label="Gmail" value={emailVal} />
            <Row label="City" value={cityVal} />
            <Row label="Phone" value={student?.phone} />
            <Row
              label="Status"
              value={
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  registration?.registration_status === 'confirmed'
                    ? 'bg-green-100 text-green-700'
                    : registration?.registration_status === 'cancelled'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {registration?.registration_status ?? 'pending'}
                </span>
              }
            />
          </div>
        </div>
      </div>

      {/* Registration ID + QR */}
      <div className="border-t border-dashed border-slate-200 px-6 py-4 flex items-center justify-between bg-slate-50">
        <div>
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Registration ID</p>
          <p className="text-base font-bold text-slate-800 font-mono mt-0.5">
            {registration?.registration_id}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {registration?.registered_at
              ? new Date(registration.registered_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })
              : ''}
          </p>
        </div>
        <div>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code" className="w-16 h-16" />
          ) : (
            <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center">
              <QrCode size={24} className="text-slate-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

function Row({ label, value }) {
  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-slate-400 w-12 flex-shrink-0">{label}:</span>
      <span className="text-slate-700 font-medium truncate">{value || '—'}</span>
    </div>
  );
}

export default RegistrationCard;
