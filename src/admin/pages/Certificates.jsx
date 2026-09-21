import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import {
  Award, XCircle, Download, Layers, CheckSquare, Square,
  Upload, Eye, ChevronDown, Image as ImageIcon, RefreshCw, AlertTriangle,
} from 'lucide-react';
import { supabase } from '@db/client';
import Modal from '@shared/components/Modal';
import Spinner from '@shared/components/Spinner';
import { generateCertificateId } from '@shared/utils/generateId';
import { generateCertificatePDF, downloadCertificatePDF } from '@admin/utils/generateCertificatePDF';

function validityBadge(status) {
  return status === 'valid'
    ? <span className="badge-green">Valid</span>
    : <span className="badge-red">Revoked</span>;
}

// ─── Convert File to base64 data URL ─────────────────────────────────────────
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Certificates() {
  const [certificates, setCertificates] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [confirmedRegs, setConfirmedRegs] = useState([]); // all confirmed regs without cert
  const [loading, setLoading] = useState(true);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revoking, setRevoking] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

  // ── Generate flow state ──
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genSession, setGenSession] = useState('');
  const [genRegs, setGenRegs] = useState([]); // regs for selected session without cert
  const [loadingGenRegs, setLoadingGenRegs] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [templateFile, setTemplateFile] = useState(null);   // File object
  const [templateDataUrl, setTemplateDataUrl] = useState(null); // base64 preview
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState({ done: 0, total: 0 });
  const templateInputRef = useRef();

  const fetchAll = async () => {
    const [{ data: certs }, { data: sess }, { data: regs }] = await Promise.all([
      supabase.from('certificates').select('*, registrations(id, registration_id, class, students(name, school_name), sessions(name))').order('issued_at', { ascending: false }),
      supabase.from('sessions').select('id, name').order('name'),
      supabase.from('registrations').select('id, registration_id, class, session_id, students(name, school_name), sessions(name)').eq('registration_status', 'confirmed'),
    ]);
    setCertificates(certs ?? []);
    setSessions(sess ?? []);
    // regs without a certificate
    const certRegIds = new Set((certs ?? []).map((c) => c.registration_id));
    setConfirmedRegs((regs ?? []).filter((r) => !certRegIds.has(r.id)));
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ── When session changes in generate modal, load its regs (with resume support) ──
  useEffect(() => {
    if (!genSession || !generateOpen) return;
    setLoadingGenRegs(true);
    const certRegIds = new Set(certificates.map((c) => c.registration_id));
    const filtered = confirmedRegs.filter((r) => r.session_id === genSession && !certRegIds.has(r.id));
    setGenRegs(filtered);

    // Check if there is an interrupted batch saved in localStorage for this session
    const savedResume = localStorage.getItem(`cert_batch_unissued_${genSession}`);
    if (savedResume) {
      try {
        const savedIds = new Set(JSON.parse(savedResume));
        // Keep only saved IDs that are still in filtered unissued regs
        const validResumeIds = new Set(filtered.filter((r) => savedIds.has(r.id)).map((r) => r.id));
        if (validResumeIds.size > 0) {
          setSelectedIds(validResumeIds);
          toast.success(`Resumed interrupted batch (${validResumeIds.size} remaining)`, { duration: 4000 });
          setLoadingGenRegs(false);
          return;
        }
      } catch {
        localStorage.removeItem(`cert_batch_unissued_${genSession}`);
      }
    }

    setSelectedIds(new Set(filtered.map((r) => r.id)));
    setLoadingGenRegs(false);
  }, [genSession, generateOpen, confirmedRegs, certificates]);

  // ── Template file picker ──
  const handleTemplateFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please upload a PNG or JPG image template'); return; }
    setTemplateFile(file);
    const dataUrl = await fileToDataUrl(file);
    setTemplateDataUrl(dataUrl);
    toast.success('Template loaded — text will be overlaid when generating');
  };

  // ── Issue a single certificate ──
  const issueCertificate = async (reg) => {
    const certId = generateCertificateId();
    const pdfBlob = await generateCertificatePDF({
      studentName: reg.students?.name,
      schoolName: reg.students?.school_name,
      className: reg.class,
      sessionName: reg.sessions?.name,
      certificateId: certId,
      issuedAt: new Date().toISOString(),
      templateDataUrl,  // may be null → uses built-in design
    });

    let certificateUrl = null;
    if (pdfBlob) {
      const filename = `${certId}.pdf`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('certificates')
        .upload(filename, pdfBlob, { contentType: 'application/pdf', upsert: false });
      if (!uploadError && uploadData) {
        const { data: urlData } = supabase.storage.from('certificates').getPublicUrl(uploadData.path);
        certificateUrl = urlData.publicUrl;
      }
    }

    const { error } = await supabase.from('certificates').insert({
      registration_id: reg.id,
      certificate_id: certId,
      certificate_url: certificateUrl,
      verification_status: 'valid',
    });
    if (error) throw new Error(error.message);
    return certId;
  };

  // ── Generate for selected students (Resumable Batch Loop) ──
  const handleGenerate = async () => {
    const toProcess = genRegs.filter((r) => selectedIds.has(r.id));
    if (toProcess.length === 0) { toast.error('Select at least one student'); return; }
    setGenerating(true);
    setGenProgress({ done: 0, total: toProcess.length });
    let success = 0;
    let fail = 0;
    const remainingSet = new Set(selectedIds);

    for (const reg of toProcess) {
      try {
        await issueCertificate(reg);
        success++;
        remainingSet.delete(reg.id);
        setSelectedIds(new Set(remainingSet));

        // Persist remaining unissued IDs in case of network disconnect or user reload
        if (remainingSet.size > 0 && genSession) {
          localStorage.setItem(`cert_batch_unissued_${genSession}`, JSON.stringify(Array.from(remainingSet)));
        } else if (genSession) {
          localStorage.removeItem(`cert_batch_unissued_${genSession}`);
        }
      } catch (err) {
        console.error('Certificate generation error:', err);
        fail++;
      }
      setGenProgress((p) => ({ ...p, done: p.done + 1 }));
    }
    setGenerating(false);

    if (remainingSet.size === 0 && genSession) {
      localStorage.removeItem(`cert_batch_unissued_${genSession}`);
    }

    if (success > 0) toast.success(`${success} certificate(s) issued successfully`);
    if (fail > 0) toast.error(`${fail} certificate(s) failed — remaining queued for retry`);
    setGenerateOpen(false);
    setGenSession('');
    setGenRegs([]);
    setSelectedIds(new Set());
    fetchAll();
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(genRegs.map((r) => r.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase.from('certificates').update({ verification_status: 'revoked' }).eq('id', revokeTarget.id);
    setRevoking(false);
    setRevokeTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Certificate revoked');
    fetchAll();
  };

  const handleDownload = async (cert) => {
    setDownloadingId(cert.id);
    try {
      if (cert.certificate_url) { window.open(cert.certificate_url, '_blank'); return; }
      const r = cert.registrations;
      const ok = await downloadCertificatePDF({
        studentName: r?.students?.name, schoolName: r?.students?.school_name,
        className: r?.class, sessionName: r?.sessions?.name,
        certificateId: cert.certificate_id, issuedAt: cert.issued_at,
      });
      if (!ok) toast.error('PDF generation failed');
    } finally {
      setDownloadingId(null);
    }
  };

  const reg = (cert) => cert.registrations;
  const allSelected = genRegs.length > 0 && selectedIds.size === genRegs.length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certificates</h1>
          <p className="text-slate-500 text-sm mt-0.5">Issue and manage student certificates.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => { setGenerateOpen(true); setGenSession(''); setGenRegs([]); setSelectedIds(new Set()); }}
          disabled={confirmedRegs.length === 0}
        >
          <Award size={16} />
          Generate Certificates
          {confirmedRegs.length > 0 && (
            <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{confirmedRegs.length}</span>
          )}
        </button>
      </div>

      {/* Certificates list */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-12">
            <Award size={40} className="text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">No certificates issued yet.</p>
            <p className="text-slate-400 text-sm mt-1">Confirm student registrations first, then generate certificates.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Student</th>
                  <th className="table-header hidden md:table-cell">Session</th>
                  <th className="table-header hidden sm:table-cell">Certificate ID</th>
                  <th className="table-header hidden lg:table-cell">Issued</th>
                  <th className="table-header">Status</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {certificates.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-semibold text-slate-900">{reg(c)?.students?.name}</p>
                      <p className="text-xs text-slate-400">{reg(c)?.students?.school_name}</p>
                    </td>
                    <td className="table-cell hidden md:table-cell text-slate-600">{reg(c)?.sessions?.name}</td>
                    <td className="table-cell hidden sm:table-cell font-mono text-xs text-slate-500">{c.certificate_id}</td>
                    <td className="table-cell hidden lg:table-cell text-xs text-slate-400">
                      {new Date(c.issued_at).toLocaleDateString('en-IN')}
                    </td>
                    <td className="table-cell">{validityBadge(c.verification_status)}</td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-all" title="Download" onClick={() => handleDownload(c)} disabled={downloadingId === c.id}>
                          {downloadingId === c.id ? <Spinner size="sm" /> : <Download size={14} />}
                        </button>
                        {c.verification_status === 'valid' && (
                          <button className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all" title="Revoke" onClick={() => setRevokeTarget(c)}>
                            <XCircle size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Generate Certificates Modal ─────────────────────────────────────────── */}
      <Modal isOpen={generateOpen} onClose={() => setGenerateOpen(false)} title="Generate Certificates" size="lg">
        <div className="space-y-5">

          {/* Step 1: Session */}
          <div>
            <label className="label font-semibold text-slate-800">1. Select Session</label>
            <select className="input-field" value={genSession} onChange={(e) => setGenSession(e.target.value)}>
              <option value="">Choose a session…</option>
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Step 2: Template Upload */}
          <div>
            <label className="label font-semibold text-slate-800">2. Certificate Template (Optional)</label>
            <p className="text-xs text-slate-400 mb-2">
              Upload a PNG/JPG template. Dynamic fields will be overlaid automatically:
              <span className="font-mono bg-slate-100 px-1 rounded ml-1">{'{{student_name}}'}</span>
              <span className="font-mono bg-slate-100 px-1 rounded ml-1">{'{{session_name}}'}</span>
              <span className="font-mono bg-slate-100 px-1 rounded ml-1">{'{{class}}'}</span>
              <span className="font-mono bg-slate-100 px-1 rounded ml-1">{'{{certificate_id}}'}</span>
              <span className="font-mono bg-slate-100 px-1 rounded ml-1">{'{{date}}'}</span>
            </p>
            <input ref={templateInputRef} type="file" accept="image/png,image/jpeg,image/jpg" className="hidden" onChange={handleTemplateFile} />
            <div className="flex gap-2">
              <button className="btn-secondary flex-1" onClick={() => templateInputRef.current?.click()}>
                <Upload size={16} /> {templateFile ? templateFile.name : 'Upload Template Image'}
              </button>
              {templateFile && (
                <button className="btn-secondary px-3" onClick={() => { setTemplateFile(null); setTemplateDataUrl(null); }} title="Remove template">
                  <XCircle size={16} className="text-red-400" />
                </button>
              )}
            </div>
            {templateDataUrl && (
              <div className="mt-2 border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-b border-slate-200">
                  <Eye size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-500 font-medium">Template Preview</span>
                </div>
                <img src={templateDataUrl} alt="Template preview" className="w-full max-h-40 object-contain p-2 bg-white" />
              </div>
            )}
            {!templateFile && (
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                <ImageIcon size={11} /> No template — uses the built-in certificate design.
              </p>
            )}
          </div>

          {/* Step 3: Student Selection */}
          {genSession && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label font-semibold text-slate-800 mb-0">3. Select Students</label>
                <div className="flex gap-2">
                  <button className="text-xs text-blue-600 hover:text-blue-700 font-medium" onClick={selectAll}>Select All</button>
                  <span className="text-slate-300">·</span>
                  <button className="text-xs text-slate-500 hover:text-slate-700" onClick={deselectAll}>Deselect All</button>
                </div>
              </div>
              {loadingGenRegs ? (
                <div className="flex justify-center py-4"><Spinner /></div>
              ) : genRegs.length === 0 ? (
                <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-200">
                  <Award size={28} className="text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm">All confirmed students in this session already have certificates.</p>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  {/* Select all header row */}
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200 hover:bg-slate-100 transition-colors"
                    onClick={() => allSelected ? deselectAll() : selectAll()}
                  >
                    {allSelected
                      ? <CheckSquare size={16} className="text-blue-600 flex-shrink-0" />
                      : selectedIds.size > 0
                        ? <div className="w-4 h-4 border-2 border-blue-400 bg-blue-100 rounded flex-shrink-0" />
                        : <Square size={16} className="text-slate-400 flex-shrink-0" />
                    }
                    <span className="text-sm font-medium text-slate-700">
                      {allSelected ? 'Deselect All' : `Select All (${genRegs.length})`}
                    </span>
                    <span className="ml-auto text-xs text-slate-400">{selectedIds.size} selected</span>
                  </button>
                  <div className="max-h-64 overflow-y-auto scrollbar-thin">
                    {genRegs.map((r) => (
                      <button
                        key={r.id}
                        className="w-full flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors text-left"
                        onClick={() => toggleSelect(r.id)}
                      >
                        {selectedIds.has(r.id)
                          ? <CheckSquare size={16} className="text-blue-600 flex-shrink-0" />
                          : <Square size={16} className="text-slate-300 flex-shrink-0" />
                        }
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{r.students?.name}</p>
                          <p className="text-xs text-slate-400">{r.students?.school_name} · Class {r.class}</p>
                        </div>
                        <span className="text-xs font-mono text-slate-300">{r.registration_id}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {selectedIds.size > 50 && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                  <span>Generating {selectedIds.size} certificates in bulk. Please keep this browser window open until generation completes.</span>
                </div>
              )}
            </div>
          )}

          {/* Progress bar while generating */}
          {generating && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-blue-700">Generating certificates…</p>
                <span className="text-sm text-blue-600">{genProgress.done}/{genProgress.total}</span>
              </div>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${genProgress.total > 0 ? (genProgress.done / genProgress.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3 pt-2">
            <button className="btn-secondary flex-1" onClick={() => setGenerateOpen(false)} disabled={generating}>Cancel</button>
            <button
              className="btn-primary flex-1"
              onClick={handleGenerate}
              disabled={generating || !genSession || selectedIds.size === 0}
            >
              {generating ? <RefreshCw size={14} className="animate-spin" /> : <Award size={14} />}
              {generating ? `Generating ${genProgress.done}/${genProgress.total}…` : `Generate ${selectedIds.size > 0 ? `(${selectedIds.size})` : ''}`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Revoke Confirm */}
      <Modal isOpen={!!revokeTarget} onClose={() => setRevokeTarget(null)} title="Revoke Certificate" size="sm">
        <p className="text-slate-600 mb-6">
          Revoke certificate <span className="font-mono text-slate-800">{revokeTarget?.certificate_id}</span>?{' '}
          This will invalidate it and show as revoked on verification.
        </p>
        <div className="flex gap-3">
          <button className="btn-secondary flex-1" onClick={() => setRevokeTarget(null)}>Cancel</button>
          <button className="btn-danger flex-1" onClick={handleRevoke} disabled={revoking}>
            {revoking ? <Spinner size="sm" /> : null}
            {revoking ? 'Revoking…' : 'Revoke'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
