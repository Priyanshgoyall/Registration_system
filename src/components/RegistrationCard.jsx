// import { forwardRef } from 'react';
// import { GraduationCap, QrCode } from 'lucide-react';

// /**
//  * Printable/downloadable registration card
//  * Exact Physical Size: 8.5 cm × 5.5 cm (85mm × 55mm)
//  */
// const RegistrationCard = forwardRef(function RegistrationCard(
//   { student, session, registration, qrDataUrl },
//   ref
// ) {
//   const emailVal = student?.email || registration?.email;
//   const cityVal = student?.city || registration?.city;
//   const nameVal = student?.name || '—';
//   const schoolVal = student?.school_name || '—';
//   const regIdVal = registration?.registration_id || student?.registration_id || registration?.id || '—';

//   // Dynamic font sizing for long student names
//   const nameFontSize = nameVal.length > 22 ? 'text-[10px]' : nameVal.length > 17 ? 'text-[11px]' : 'text-[12px]';
//   const emailFontSize = (emailVal || '').length > 25 ? 'text-[7.5px]' : 'text-[8.5px]';

//   return (
//     <div
//       ref={ref}
//       className="bg-white text-slate-900 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-300 print:shadow-none print:border print:border-slate-400"
//       style={{
//         width: '8.5cm',
//         height: '5.5cm',
//         boxSizing: 'border-box',
//         fontFamily: 'Inter, system-ui, sans-serif',
//       }}
//     >
//       {/* Top Header - Official University Branding */}
//       <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white px-2.5 py-1.5 flex items-center justify-between">
//         <div className="flex items-center gap-2 min-w-0">
//           <img
//             src="/juet-logo.png"
//             alt="JUET Logo"
//             className="w-7 h-7 object-contain flex-shrink-0 bg-white/95 rounded-md p-0.5 shadow-sm"
//             crossOrigin="anonymous"
//           />
//           <div className="min-w-0">
//             <h2 className="text-[10.5px] font-bold leading-tight truncate tracking-tight text-white">
//               Jaypee University of Engineering & Technology
//             </h2>
//             <p className="text-[8px] text-blue-200 font-medium leading-none tracking-tight mt-0.5">
//               Accredited Grade 'A+' by NAAC · Raghogarh, Guna (M.P.)
//             </p>
//           </div>
//         </div>
//       </div>

//       {/* Program Sub-bar */}
//       <div className="bg-blue-50 px-2.5 py-0.5 border-b border-blue-100 flex items-center justify-start text-[8.5px] font-bold text-blue-900">
//         <span className="uppercase tracking-wider">PARTICIPATION IN CAPACITY BUILDING PROGRAM</span>
//       </div>

//       {/* Body Content - 1/3 Photo Area & 2/3 Details Area */}
//       <div className="px-2.5 py-1 flex gap-2 flex-1 items-stretch min-h-0 w-full overflow-hidden">
//         {/* Photo Container - 1/3 Area */}
//         <div className="w-1/3 self-stretch my-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
//           {student?.photo_url ? (
//             <img
//               src={student.photo_url}
//               alt={nameVal}
//               className="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm"
//               crossOrigin="anonymous"
//             />
//           ) : (
//             <div className="w-full h-full bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center min-h-[55px]">
//               <GraduationCap size={22} className="text-slate-400" />
//             </div>
//           )}
//         </div>

//         {/* Info Grid Container - 2/3 Area */}
//         <div className="w-2/3 min-w-0 flex flex-col justify-center space-y-0.5 py-0.5">
//           <p className={`${nameFontSize} font-bold text-slate-900 leading-snug truncate`} title={nameVal}>
//             {nameVal}
//           </p>
//           <p className="text-[9px] text-slate-500 truncate leading-tight mb-0.5" title={schoolVal}>
//             {schoolVal}
//           </p>
//           <div className="space-y-0.5 text-[8.5px] text-slate-700">
//             <div className="truncate" title={emailVal}>
//               <span className="text-slate-400 font-medium">Mail:</span> <span className={emailFontSize}>{emailVal || '—'}</span>
//             </div>
//             <div className="truncate">
//               <span className="text-slate-400 font-medium">Phone:</span> {student?.phone || '—'}
//             </div>
//             <div className="flex items-center justify-between">
//               <span className="truncate">
//                 <span className="text-slate-400 font-medium">City:</span> {cityVal || '—'}
//               </span>
//               <span
//                 className={`text-[7px] font-bold px-1.5 py-0.2 rounded uppercase ${
//                   registration?.registration_status === 'confirmed'
//                     ? 'bg-emerald-100 text-emerald-800'
//                     : 'bg-yellow-100 text-yellow-800'
//                 }`}
//               >
//                 {registration?.registration_status ?? 'confirmed'}
//               </span>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* Footer / QR Code & Reg ID */}
//       <div className="bg-slate-50 px-2.5 py-1 border-t border-slate-200 flex items-center justify-between">
//         <div>
//           <p className="text-[7px] text-slate-400 uppercase font-medium tracking-wider">Registration ID</p>
//           <p className="text-[10.5px] font-bold text-slate-800 font-mono leading-tight">
//             {regIdVal}
//           </p>
//         </div>
//         <div className="flex items-center gap-1.5">
//           {qrDataUrl ? (
//             <img src={qrDataUrl} alt="JUET QR Code" className="w-9 h-9 rounded border border-slate-200 bg-white p-0.5" />
//           ) : (
//             <div className="w-9 h-9 bg-slate-200 rounded flex items-center justify-center">
//               <QrCode size={16} className="text-slate-400" />
//             </div>
//           )}
//         </div>
//       </div>
//     </div>
//   );
// });

// export default RegistrationCard;







// New code by Atharva to fix id card



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
  const nameVal = student?.name || '—';
  const schoolVal = student?.school_name || '—';
  const regIdVal = registration?.registration_id || student?.registration_id || registration?.id || '—';

  // Dynamic font sizing for long student names
  const nameFontSize = nameVal.length > 22 ? 'text-[10px]' : nameVal.length > 17 ? 'text-[11px]' : 'text-[12px]';
  const emailFontSize = (emailVal || '').length > 25 ? 'text-[7.5px]' : 'text-[8.5px]';

  // SVG badge data URL ensures 100% pixel-perfect vector alignment in both screen and html2canvas PDF rendering
  const statusText = (registration?.registration_status ?? 'confirmed').toUpperCase();
  const isConfirmed = statusText === 'CONFIRMED';
  const badgeBg = isConfirmed ? '#d1fae5' : '#fef9c3';
  const badgeTextColor = isConfirmed ? '#065f46' : '#854d0e';
  const badgeWidth = Math.max(68, statusText.length * 7 + 16);
  const centerX = badgeWidth / 2;
  const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badgeWidth}" height="16" viewBox="0 0 ${badgeWidth} 16"><rect width="${badgeWidth}" height="16" rx="8" fill="${badgeBg}"/><text x="${centerX}" y="11" font-family="Inter, system-ui, -apple-system, sans-serif" font-size="8" font-weight="700" fill="${badgeTextColor}" text-anchor="middle" letter-spacing="0.5">${statusText}</text></svg>`;
  const badgeDataUrl = `data:image/svg+xml;base64,${typeof btoa !== 'undefined' ? btoa(badgeSvg) : ''}`;

  return (
    <div
      ref={ref}
      className="registration-card-root bg-white text-slate-900 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between border border-slate-300 print:shadow-none print:border print:border-slate-400"
      style={{
        width: '8.5cm',
        height: '5.5cm',
        boxSizing: 'border-box',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Top Header - Official University Branding */}
      <div className="bg-gradient-to-r from-blue-950 via-blue-900 to-blue-800 text-white px-2.5 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <img
            src="/juet-logo.png"
            alt="JUET Logo"
            className="w-7 h-7 object-contain flex-shrink-0 bg-white/95 rounded-md p-0.5 shadow-sm"
            crossOrigin="anonymous"
          />
          <div className="min-w-0">
            <h2 className="text-[10px] font-bold leading-normal tracking-tight text-white whitespace-nowrap overflow-visible">
              Jaypee University of Engineering & Technology
            </h2>
            <p className="text-[7.5px] text-blue-200 font-medium leading-normal tracking-tight mt-0.5 whitespace-nowrap overflow-visible">
              Accredited Grade 'A+' by NAAC · Raghogarh, Guna (M.P.)
            </p>
          </div>
        </div>
      </div>

      {/* Program Sub-bar */}
      <div className="bg-blue-50 px-2.5 py-0.5 border-b border-blue-100 flex items-center justify-start text-[8px] font-bold text-blue-900">
        <span className="uppercase tracking-wider leading-normal">PARTICIPATION IN CAPACITY BUILDING PROGRAM</span>
      </div>

      {/* Body Content - 1/3 Photo Area & 2/3 Details Area */}
      <div className="px-2.5 py-1 flex gap-2 flex-1 items-stretch min-h-0 w-full overflow-visible">
        {/* Photo Container - 1/3 Area */}
        <div className="w-1/3 self-stretch my-0.5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {student?.photo_url ? (
            <img
              src={student.photo_url}
              alt={nameVal}
              className="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm"
              crossOrigin="anonymous"
            />
          ) : (
            <div className="w-full h-full bg-slate-100 rounded-lg border border-slate-300 flex items-center justify-center min-h-[55px]">
              <GraduationCap size={22} className="text-slate-400" />
            </div>
          )}
        </div>

        {/* Info Grid Container - 2/3 Area */}
        <div className="w-2/3 min-w-0 flex flex-col justify-center space-y-0.5 py-0.5 overflow-visible">
          <p className={`${nameFontSize} font-bold text-slate-900 leading-normal whitespace-nowrap overflow-visible`} title={nameVal}>
            {nameVal}
          </p>
          <p className="text-[9px] text-slate-500 leading-normal mb-0.5 whitespace-nowrap overflow-visible" title={schoolVal}>
            {schoolVal}
          </p>
          <div className="space-y-0.5 text-[8px] text-slate-700 leading-normal">
            <div className="whitespace-nowrap overflow-visible" title={emailVal}>
              <span className="text-slate-400 font-medium">Mail:</span> <span className={emailFontSize}>{emailVal || '—'}</span>
            </div>
            <div className="whitespace-nowrap overflow-visible">
              <span className="text-slate-400 font-medium">Phone:</span> {student?.phone || '—'}
            </div>
            <div className="flex items-center justify-between overflow-visible">
              <span className="whitespace-nowrap overflow-visible">
                <span className="text-slate-400 font-medium">City:</span> {cityVal || '—'}
              </span>
              <img
                src={badgeDataUrl}
                alt={statusText}
                className="h-4 w-auto object-contain flex-shrink-0"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer / QR Code & Reg ID */}
      <div className="bg-slate-50 px-2.5 py-1 border-t border-slate-200 flex items-center justify-between">
        <div>
          <p className="text-[7px] text-slate-400 uppercase font-medium tracking-wider">Registration ID</p>
          <p className="text-[10.5px] font-bold text-slate-800 font-mono leading-tight">
            {regIdVal}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="JUET QR Code" className="w-9 h-9 rounded border border-slate-200 bg-white p-0.5" />
          ) : (
            <div className="w-9 h-9 bg-slate-200 rounded flex items-center justify-center">
              <QrCode size={16} className="text-slate-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default RegistrationCard;
