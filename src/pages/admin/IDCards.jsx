// import { useEffect, useState, useRef } from 'react';
// import { Navigate } from 'react-router-dom';
// import toast from 'react-hot-toast';
// import {
//   CreditCard, Search, Filter, Printer, Download, CheckSquare, Square, RefreshCw,
//   AlertCircle, CheckCircle2, ShieldAlert, FileText, Check, X
// } from 'lucide-react';
// import { supabase } from '../../lib/supabase';
// import { useAuth } from '../../hooks/useAuth';
// import Modal from '../../components/Modal';
// import Spinner from '../../components/Spinner';
// import RegistrationCard from '../../components/RegistrationCard';
// import { generateQRDataUrl } from '../../utils/generateQR';
// import { downloadAsPDF, generateA4PrintPDF } from '../../utils/generatePDF';

// // ── Admin ID-Card Management & A4 Printing System ────────────────────────────
// // Accessible exclusively by Main Admin users.
// // Supports custom selection of 1 to 8 ID cards per A4 print sheet.

// export default function IDCards() {
//   const { isAdmin, loading: authLoading } = useAuth();

//   const [registrations, setRegistrations] = useState([]);
//   const [sessions, setSessions] = useState([]);
//   const [loading, setLoading] = useState(true);

//   // Search & Filter
//   const [searchQuery, setSearchQuery] = useState('');
//   const [filterSession, setFilterSession] = useState('');

//   // 1-8 Card Selection State
//   const [selectedIds, setSelectedIds] = useState([]);

//   // Printing & Generation state
//   const [printing, setPrinting] = useState(false);
//   const [singleDownloading, setSingleDownloading] = useState(null);

//   // Hidden Render References for selected cards
//   const cardRefs = useRef({});
//   const [qrMap, setQrMap] = useState({});

//   if (!authLoading && !isAdmin) {
//     return <Navigate to="/admin/dashboard" replace />;
//   }

//   const fetchData = async () => {
//     setLoading(true);
//     const [{ data: regs, error: regErr }, { data: sess }] = await Promise.all([
//       supabase
//         .from('registrations')
//         .select('*, students(*), sessions(*)')
//         .order('registered_at', { ascending: false }),
//       supabase.from('sessions').select('id, name').order('name'),
//     ]);

//     if (regErr) {
//       toast.error('Failed to load student registrations: ' + regErr.message);
//     } else {
//       setRegistrations(regs ?? []);
//       setSessions(sess ?? []);

//       // Generate QR codes in bulk for active registrations
//       const newQrMap = {};
//       await Promise.all(
//         (regs ?? []).map(async (r) => {
//           const qrUrl = 'https://www.juet.ac.in/';
//           const qr = await generateQRDataUrl(qrUrl);
//           newQrMap[r.id] = qr;
//         })
//       );
//       setQrMap(newQrMap);
//     }
//     setLoading(false);
//   };

//   useEffect(() => {
//     fetchData();
//   }, []);

//   // Filtered registrations list
//   const filtered = registrations.filter((r) => {
//     const q = searchQuery.toLowerCase().trim();
//     const matchesSearch =
//       !q ||
//       r.registration_id?.toLowerCase().includes(q) ||
//       r.students?.name?.toLowerCase().includes(q) ||
//       r.students?.school_name?.toLowerCase().includes(q) ||
//       r.students?.phone?.includes(q) ||
//       r.email?.toLowerCase().includes(q);

//     const matchesSession = !filterSession || r.session_id === filterSession;

//     return matchesSearch && matchesSession;
//   });

//   // Checkbox toggle logic with strict 1-8 limit enforcement
//   const toggleSelect = (id) => {
//     if (selectedIds.includes(id)) {
//       setSelectedIds((prev) => prev.filter((item) => item !== id));
//     } else {
//       if (selectedIds.length >= 8) {
//         toast.error('You can print a maximum of 8 ID cards at a time.');
//         return;
//       }
//       setSelectedIds((prev) => [...prev, id]);
//     }
//   };

//   // Select All: Selects at most 8 eligible cards from current filtered view
//   const handleSelectAll = () => {
//     const eligible = filtered.slice(0, 8).map((r) => r.id);
//     setSelectedIds(eligible);
//     if (filtered.length > 8) {
//       toast.success('Selected top 8 cards (maximum allowed limit).');
//     }
//   };

//   const handleClearSelection = () => {
//     setSelectedIds([]);
//   };

//   // Single card download handler
//   const handleSingleDownload = async (reg) => {
//     const el = cardRefs.current[reg.id];
//     if (!el) {
//       toast.error('Card element not ready');
//       return;
//     }
//     setSingleDownloading(reg.id);
//     try {
//       const ok = await downloadAsPDF(el, `id-card-${reg.registration_id}`);
//       if (ok) toast.success(`ID Card downloaded for ${reg.students?.name}`);
//       else toast.error('Download failed');
//     } catch (err) {
//       toast.error('Download error: ' + err.message);
//     } finally {
//       setSingleDownloading(null);
//     }
//   };

//   // Direct Print Panel Handler for selected 1 to 8 cards
//   const handlePrintSelectedA4 = () => {
//     if (selectedIds.length === 0) {
//       toast.error('Please select at least 1 ID card.');
//       return;
//     }
//     if (selectedIds.length > 8) {
//       toast.error('You can print a maximum of 8 ID cards at a time.');
//       return;
//     }

//     // Open browser native print panel directly
//     window.print();
//   };

//   const selectedCount = selectedIds.length;
//   const isPrintDisabled = selectedCount === 0 || selectedCount > 8 || printing;

//   return (
//     <div className="space-y-6 animate-fade-in">
//       {/* Header */}
//       <div className="flex flex-wrap items-center justify-between gap-4">
//         <div>
//           <h1 className="text-2xl font-bold text-slate-900">ID Card Management & A4 Printing</h1>
//           <p className="text-slate-500 text-sm mt-0.5">
//             Retrieve, store, and print student ID cards on standard A4 gloss paper (up to 8 cards per sheet).
//           </p>
//         </div>
//         <button className="btn-secondary" onClick={fetchData} title="Refresh data">
//           <RefreshCw size={15} />
//         </button>
//       </div>

//       {/* Control Panel / Selection Manager */}
//       <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
//         <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
//           <div className="flex items-center gap-3">
//             <div className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-bold text-sm flex items-center gap-2">
//               <CreditCard size={16} className="text-blue-600" />
//               <span>Selected: {selectedCount} / 8</span>
//             </div>
//             {selectedCount > 0 && selectedCount <= 8 && (
//               <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
//                 <CheckCircle2 size={14} /> Ready for A4 Print Sheet
//               </span>
//             )}
//             {selectedCount > 8 && (
//               <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
//                 <AlertCircle size={14} /> Exceeds 8 card maximum
//               </span>
//             )}
//           </div>

//           <div className="flex flex-wrap items-center gap-2">
//             <button
//               className="btn-secondary text-xs py-2 px-3"
//               onClick={handleSelectAll}
//               disabled={filtered.length === 0}
//             >
//               <CheckSquare size={14} /> Select Top 8
//             </button>
//             <button
//               className="btn-secondary text-xs py-2 px-3"
//               onClick={handleClearSelection}
//               disabled={selectedCount === 0}
//             >
//               <Square size={14} /> Clear Selection
//             </button>
//             <button
//               className="btn-primary text-xs py-2 px-4 shadow-md"
//               onClick={handlePrintSelectedA4}
//               disabled={isPrintDisabled}
//             >
//               {printing ? <Spinner size="sm" /> : <Printer size={15} />}
//               {printing ? 'Generating A4 PDF…' : `Print Selected (${selectedCount})`}
//             </button>
//           </div>
//         </div>

//         {/* Search & Session Filters */}
//         <div className="flex flex-wrap items-center gap-3">
//           <div className="relative flex-1 min-w-[240px]">
//             <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
//             <input
//               className="input-field pl-10 text-sm"
//               placeholder="Search by student name, registration ID, school, or phone..."
//               value={searchQuery}
//               onChange={(e) => setSearchQuery(e.target.value)}
//             />
//           </div>
//           <div className="w-48 min-w-[160px]">
//             <select
//               className="input-field text-sm"
//               value={filterSession}
//               onChange={(e) => setFilterSession(e.target.value)}
//             >
//               <option value="">All Sessions</option>
//               {sessions.map((s) => (
//                 <option key={s.id} value={s.id}>{s.name}</option>
//               ))}
//             </select>
//           </div>
//         </div>
//       </div>

//       {/* Registrations & ID Cards Table */}
//       <div className="card overflow-hidden">
//         {loading ? (
//           <div className="flex justify-center py-12"><Spinner /></div>
//         ) : filtered.length === 0 ? (
//           <div className="text-center py-12">
//             <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
//             <p className="text-slate-500 font-medium">No registrations found.</p>
//             <p className="text-slate-400 text-sm mt-1">Try adjusting your search criteria.</p>
//           </div>
//         ) : (
//           <div className="overflow-x-auto">
//             <table className="w-full text-left">
//               <thead>
//                 <tr>
//                   <th className="table-header w-12 text-center">
//                     <input
//                       type="checkbox"
//                       className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
//                       checked={selectedCount > 0 && selectedCount <= 8 && filtered.slice(0, 8).every((r) => selectedIds.includes(r.id))}
//                       onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearSelection())}
//                     />
//                   </th>
//                   <th className="table-header">Registration ID</th>
//                   <th className="table-header">Student Name & School</th>
//                   <th className="table-header hidden md:table-cell">Phone & City</th>
//                   <th className="table-header hidden lg:table-cell">Session</th>
//                   <th className="table-header text-right">Actions</th>
//                 </tr>
//               </thead>
//               <tbody className="divide-y divide-slate-100">
//                 {filtered.map((r) => {
//                   const isSelected = selectedIds.includes(r.id);
//                   return (
//                     <tr
//                       key={r.id}
//                       className={`hover:bg-slate-50 transition-colors ${
//                         isSelected ? 'bg-blue-50/60' : ''
//                       }`}
//                     >
//                       <td className="table-cell text-center">
//                         <input
//                           type="checkbox"
//                           className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
//                           checked={isSelected}
//                           onChange={() => toggleSelect(r.id)}
//                         />
//                       </td>
//                       <td className="table-cell font-mono font-bold text-blue-700 text-xs">
//                         {r.registration_id}
//                       </td>
//                       <td className="table-cell">
//                         <p className="font-semibold text-slate-900">{r.students?.name || '—'}</p>
//                         <p className="text-xs text-slate-400 truncate max-w-[220px]">
//                           {r.students?.school_name || '—'}
//                         </p>
//                       </td>
//                       <td className="table-cell hidden md:table-cell text-xs text-slate-600">
//                         <p className="font-mono text-slate-700">{r.students?.phone}</p>
//                         <p className="text-slate-400">{r.students?.city || r.city || '—'}</p>
//                       </td>
//                       <td className="table-cell hidden lg:table-cell text-xs text-slate-600">
//                         {r.sessions?.name || 'Default Session'}
//                       </td>
//                       <td className="table-cell">
//                         <div className="flex items-center justify-end gap-2">
//                           <button
//                             className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 text-xs font-semibold border border-slate-200"
//                             title="Download Single High-Res Card PDF"
//                             onClick={() => handleSingleDownload(r)}
//                             disabled={singleDownloading === r.id}
//                           >
//                             {singleDownloading === r.id ? <Spinner size="sm" /> : <Download size={13} />}
//                             <span>PDF</span>
//                           </button>
//                           <button
//                             className={`p-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 border ${
//                               isSelected
//                                 ? 'bg-blue-600 text-white border-blue-600'
//                                 : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100'
//                             }`}
//                             onClick={() => toggleSelect(r.id)}
//                           >
//                             {isSelected ? <Check size={13} /> : <Square size={13} />}
//                             <span>{isSelected ? 'Selected' : 'Select'}</span>
//                           </button>
//                         </div>
//                       </td>
//                     </tr>
//                   );
//                 })}
//               </tbody>
//             </table>
//           </div>
//         )}
//       </div>

//       {/* Hidden Render Container for Capture Engine */}
//       <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
//         {registrations.map((r) => (
//           <RegistrationCard
//             key={r.id}
//             ref={(el) => (cardRefs.current[r.id] = el)}
//             student={r.students}
//             session={r.sessions}
//             registration={r}
//             qrDataUrl={qrMap[r.id]}
//           />
//         ))}
//       </div>

//       {/* A4 Print Sheet Container for Direct Browser Print Panel (Selected 1-8 Cards in 2x4 Grid) */}
//       <div className="a4-print-sheet hidden print:grid">
//         {selectedIds.map((id) => {
//           const reg = registrations.find((r) => r.id === id);
//           if (!reg) return null;
//           return (
//             <div key={reg.id} className="print-card-wrapper">
//               <RegistrationCard
//                 student={reg.students}
//                 session={reg.sessions}
//                 registration={reg}
//                 qrDataUrl={qrMap[reg.id]}
//               />
//             </div>
//           );
//         })}
//       </div>
//     </div>
//   );
// }





// Modified By Atharva


import { useEffect, useState, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  CreditCard, Search, Filter, Printer, Download, CheckSquare, Square, RefreshCw,
  AlertCircle, CheckCircle2, ShieldAlert, FileText, Check, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import Modal from '../../components/Modal';
import Spinner from '../../components/Spinner';
import RegistrationCard from '../../components/RegistrationCard';
import { generateQRDataUrl } from '../../utils/generateQR';
import { downloadAsPDF, generateA4PrintPDF } from '../../utils/generatePDF';

// ── Admin ID-Card Management & A4 Printing System ────────────────────────────
// Accessible exclusively by Main Admin users.
// Supports custom selection of 1 to 8 ID cards per A4 print sheet.

export default function IDCards() {
  const { isAdmin, loading: authLoading } = useAuth();

  const [registrations, setRegistrations] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSession, setFilterSession] = useState('');

  // 1-8 Card Selection State
  const [selectedIds, setSelectedIds] = useState([]);

  // Printing & Generation state
  const [printing, setPrinting] = useState(false);
  const [singleDownloading, setSingleDownloading] = useState(null);

  // Hidden Render References for selected cards
  const cardRefs = useRef({});
  const [qrMap, setQrMap] = useState({});

  if (!authLoading && !isAdmin) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const fetchData = async () => {
    setLoading(true);
    const [{ data: regs, error: regErr }, { data: sess }] = await Promise.all([
      supabase
        .from('registrations')
        .select('*, students(*), sessions(*)')
        .order('registered_at', { ascending: false }),
      supabase.from('sessions').select('id, name').order('name'),
    ]);

    if (regErr) {
      toast.error('Failed to load student registrations: ' + regErr.message);
    } else {
      setRegistrations(regs ?? []);
      setSessions(sess ?? []);

      // Generate QR codes in bulk for active registrations
      const newQrMap = {};
      await Promise.all(
        (regs ?? []).map(async (r) => {
          const qrUrl = 'https://www.juet.ac.in/';
          const qr = await generateQRDataUrl(qrUrl);
          newQrMap[r.id] = qr;
        })
      );
      setQrMap(newQrMap);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered registrations list
  const filtered = registrations.filter((r) => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      r.registration_id?.toLowerCase().includes(q) ||
      r.students?.name?.toLowerCase().includes(q) ||
      r.students?.school_name?.toLowerCase().includes(q) ||
      r.students?.phone?.includes(q) ||
      r.email?.toLowerCase().includes(q);

    const matchesSession = !filterSession || r.session_id === filterSession;

    return matchesSearch && matchesSession;
  });

  // Checkbox toggle logic with strict 1-8 limit enforcement
  const toggleSelect = (id) => {
    if (selectedIds.includes(id)) {
      setSelectedIds((prev) => prev.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 8) {
        toast.error('You can print a maximum of 8 ID cards at a time.');
        return;
      }
      setSelectedIds((prev) => [...prev, id]);
    }
  };

  // Select All: Selects at most 8 eligible cards from current filtered view
  const handleSelectAll = () => {
    const eligible = filtered.slice(0, 8).map((r) => r.id);
    setSelectedIds(eligible);
    if (filtered.length > 8) {
      toast.success('Selected top 8 cards (maximum allowed limit).');
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Single card download handler
  const handleSingleDownload = async (reg) => {
    const el = cardRefs.current[reg.id];
    if (!el) {
      toast.error('Card element not ready');
      return;
    }
    setSingleDownloading(reg.id);
    try {
      const ok = await downloadAsPDF(el, `id-card-${reg.registration_id}`);
      if (ok) toast.success(`ID Card downloaded for ${reg.students?.name}`);
      else toast.error('Download failed');
    } catch (err) {
      toast.error('Download error: ' + err.message);
    } finally {
      setSingleDownloading(null);
    }
  };

  // Direct Print Panel Handler for selected 1 to 8 cards
  const handlePrintSelectedA4 = () => {
    if (selectedIds.length === 0) {
      toast.error('Please select at least 1 ID card.');
      return;
    }
    if (selectedIds.length > 8) {
      toast.error('You can print a maximum of 8 ID cards at a time.');
      return;
    }

    // Open browser native print panel directly
    window.print();
  };

  const selectedCount = selectedIds.length;
  const isPrintDisabled = selectedCount === 0 || selectedCount > 8 || printing;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ID Card Management & A4 Printing</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Retrieve, store, and print student ID cards on standard A4 gloss paper (up to 8 cards per sheet).
          </p>
        </div>
        <button className="btn-secondary" onClick={fetchData} title="Refresh data">
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Control Panel / Selection Manager */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="px-3.5 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-xl font-bold text-sm flex items-center gap-2">
              <CreditCard size={16} className="text-blue-600" />
              <span>Selected: {selectedCount} / 8</span>
            </div>
            {selectedCount > 0 && selectedCount <= 8 && (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 size={14} /> Ready for A4 Print Sheet
              </span>
            )}
            {selectedCount > 8 && (
              <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle size={14} /> Exceeds 8 card maximum
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              className="btn-secondary text-xs py-2 px-3"
              onClick={handleSelectAll}
              disabled={filtered.length === 0}
            >
              <CheckSquare size={14} /> Select Top 8
            </button>
            <button
              className="btn-secondary text-xs py-2 px-3"
              onClick={handleClearSelection}
              disabled={selectedCount === 0}
            >
              <Square size={14} /> Clear Selection
            </button>
            <button
              className="btn-primary text-xs py-2 px-4 shadow-md"
              onClick={handlePrintSelectedA4}
              disabled={isPrintDisabled}
            >
              {printing ? <Spinner size="sm" /> : <Printer size={15} />}
              {printing ? 'Generating A4 PDF…' : `Print Selected (${selectedCount})`}
            </button>
          </div>
        </div>

        {/* Search & Session Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              className="input-field pl-10 text-sm"
              placeholder="Search by student name, registration ID, school, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-48 min-w-[160px]">
            <select
              className="input-field text-sm"
              value={filterSession}
              onChange={(e) => setFilterSession(e.target.value)}
            >
              <option value="">All Sessions</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Registrations & ID Cards Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <CreditCard size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No registrations found.</p>
            <p className="text-slate-400 text-sm mt-1">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  <th className="table-header w-12 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      checked={selectedCount > 0 && selectedCount <= 8 && filtered.slice(0, 8).every((r) => selectedIds.includes(r.id))}
                      onChange={(e) => (e.target.checked ? handleSelectAll() : handleClearSelection())}
                    />
                  </th>
                  <th className="table-header">Registration ID</th>
                  <th className="table-header">Student Name & School</th>
                  <th className="table-header hidden md:table-cell">Phone & City</th>
                  <th className="table-header hidden lg:table-cell">Session</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isSelected = selectedIds.includes(r.id);
                  return (
                    <tr
                      key={r.id}
                      className={`hover:bg-slate-50 transition-colors ${
                        isSelected ? 'bg-blue-50/60' : ''
                      }`}
                    >
                      <td className="table-cell text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          checked={isSelected}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </td>
                      <td className="table-cell font-mono font-bold text-blue-700 text-xs">
                        {r.registration_id}
                      </td>
                      <td className="table-cell">
                        <p className="font-semibold text-slate-900">{r.students?.name || '—'}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[220px]">
                          {r.students?.school_name || '—'}
                        </p>
                      </td>
                      <td className="table-cell hidden md:table-cell text-xs text-slate-600">
                        <p className="font-mono text-slate-700">{r.students?.phone}</p>
                        <p className="text-slate-400">{r.students?.city || r.city || '—'}</p>
                      </td>
                      <td className="table-cell hidden lg:table-cell text-xs text-slate-600">
                        {r.sessions?.name || 'Default Session'}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-all flex items-center gap-1 text-xs font-semibold border border-slate-200"
                            title="Download Single High-Res Card PDF"
                            onClick={() => handleSingleDownload(r)}
                            disabled={singleDownloading === r.id}
                          >
                            {singleDownloading === r.id ? <Spinner size="sm" /> : <Download size={13} />}
                            <span>PDF</span>
                          </button>
                          <button
                            className={`p-1.5 rounded-lg transition-all text-xs font-semibold flex items-center gap-1 border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'text-slate-700 bg-white border-slate-200 hover:bg-slate-100'
                            }`}
                            onClick={() => toggleSelect(r.id)}
                          >
                            {isSelected ? <Check size={13} /> : <Square size={13} />}
                            <span>{isSelected ? 'Selected' : 'Select'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Hidden Render Container for Capture Engine */}
      <div className="fixed -left-[9999px] -top-[9999px] opacity-0 pointer-events-none">
        {registrations.map((r) => (
          <RegistrationCard
            key={r.id}
            ref={(el) => (cardRefs.current[r.id] = el)}
            student={r.students}
            session={r.sessions}
            registration={r}
            qrDataUrl={qrMap[r.id]}
          />
        ))}
      </div>

      {/* A4 Print Sheet Container for Direct Browser Print Panel (Selected 1-8 Cards in 2x4 Grid) */}
      <div className="a4-print-sheet hidden print:grid">
        {selectedIds.map((id) => {
          const reg = registrations.find((r) => r.id === id);
          if (!reg) return null;
          return (
            <div key={reg.id} className="print-card-wrapper">
              <RegistrationCard
                student={reg.students}
                session={reg.sessions}
                registration={reg}
                qrDataUrl={qrMap[reg.id]}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
