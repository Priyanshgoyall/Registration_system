import { forwardRef } from 'react';
import { GraduationCap, QrCode } from 'lucide-react';

/**
 * Printable/downloadable registration card
 * Exact Physical Size: 8.5 cm × 5.5 cm (85mm × 55mm)
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
      className="bg-white text-slate-900 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-300"
      style={{
        width: '8.5cm',
        height: '5.5cm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top Header - Official University Branding */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white px-2.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <div className="w-6.5 h-6.5 bg-white/20 rounded-md flex items-center justify-center flex-shrink-0">
            <GraduationCap size={15} className="text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[10.5px] font-bold leading-tight truncate tracking-tight text-white">
              Jaypee University of Engineering & Technology
            </h2>
            <p className="text-[8px] text-blue-200 font-medium leading-none tracking-tight mt-0.5">
              Accredited Grade 'A+' by NAAC · Raghogarh, Guna (M.P.)
            </p>
          </div>
        </div>
      </div>

      {/* Program Sub-bar */}
      <div className="bg-blue-50 px-2.5 py-0.5 border-b border-blue-100 flex items-center justify-start text-[8.5px] font-bold text-blue-900">
        <span className="uppercase tracking-wider">Capacity Building Program</span>
      </div>

      {/* Body Content - 1/3 Photo Area & 2/3 Details Area */}
      <div className="px-2.5 py-1 flex gap-2 flex-1 items-stretch min-h-0 w-full overflow-hidden">
        {/* Photo Container - 1/3 Area, full height with slight top/bottom margin */}
        <div className="w-1/3 self-stretch my-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {student?.photo_url ? (
            <img
              src={student.photo_url}
              alt={student.name}
              className="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center min-h-[60px]">
              <GraduationCap size={24} className="text-slate-400" />
            </div>
          )}
        </div>

        {/* Info Grid Container - 2/3 Area */}
        <div className="w-2/3 min-w-0 flex flex-col justify-center space-y-0.5 py-0.5">
          <p className="text-[12px] font-bold text-slate-900 leading-snug truncate">{student?.name}</p>
          <p className="text-[9.5px] text-slate-500 truncate leading-none mb-1">{student?.school_name}</p>
          <div className="space-y-0.5 text-[9px] text-slate-700">
            <div className="truncate"><span className="text-slate-400 font-medium">Mail:</span> {emailVal || '—'}</div>
            <div className="truncate"><span className="text-slate-400 font-medium">Phone:</span> {student?.phone || '—'}</div>
            <div className="flex items-center justify-between">
              <span className="truncate"><span className="text-slate-400 font-medium">City:</span> {cityVal || '—'}</span>
              <span className={`text-[7.5px] font-bold px-1.5 py-0.2 rounded ${
                registration?.registration_status === 'confirmed'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {registration?.registration_status ?? 'pending'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer / QR Code & Reg ID */}
      <div className="bg-slate-50 px-2.5 py-1 border-t border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-[7.5px] text-slate-400 uppercase font-medium tracking-wider">Registration ID</p>
          <p className="text-[11px] font-bold text-slate-800 font-mono leading-tight">
            {registration?.registration_id}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="JUET QR Code" className="w-10 h-10 rounded border border-slate-200 bg-white p-0.5" />
          ) : (
            <div className="w-10 h-10 bg-slate-200 rounded flex items-center justify-center">
              <QrCode size={18} className="text-slate-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default RegistrationCard;
