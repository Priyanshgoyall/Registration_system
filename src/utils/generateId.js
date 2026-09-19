/**
 * Generates a unique Registration ID in the format REG-XXXXXXXX (random timestamp fallback)
 */
export function generateRegistrationId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REG-${timestamp}${random}`;
}

/**
 * Generates a sequential Registration ID formatted as:
 * REG-CBP2026-{coordCode}-{seqNumber}  (e.g., REG-CBP2026-01-001)
 *
 * When registrations are deleted, the count resets to 0, so the next ID starts back at 001!
 */
export async function getNextRegistrationId(supabase, { coordinatorUser = null, sessionId = null } = {}) {
  try {
    // 1. Determine coordinator number / code (e.g. "01", "02")
    let coordCode = '01';

    if (coordinatorUser) {
      // Check if email or full_name contains a number (e.g. coordinator1, desk2)
      const str = `${coordinatorUser.email || ''} ${coordinatorUser.full_name || ''}`;
      const numMatch = str.match(/(\d+)/);
      if (numMatch) {
        coordCode = String(parseInt(numMatch[1], 10)).padStart(2, '0');
      } else if (coordinatorUser.id) {
        try {
          const { data: profs } = await supabase
            .from('user_profiles')
            .select('id')
            .order('created_at', { ascending: true });
          if (profs && profs.length > 0) {
            const idx = profs.findIndex((p) => p.id === coordinatorUser.id);
            if (idx !== -1) {
              coordCode = String(idx + 1).padStart(2, '0');
            }
          }
        } catch {
          // fallback to 01
        }
      }
    }

    // 2. Query existing registrations to find the count & max sequence number
    let query = supabase.from('registrations').select('registration_id', { count: 'exact' });
    if (coordinatorUser?.id) {
      query = query.eq('coordinator_id', coordinatorUser.id);
    }
    const { data, count } = await query;

    let nextNum = (count || 0) + 1;

    // Check existing registration_ids to make sure we don't collide with existing numbers
    if (data && data.length > 0) {
      for (const row of data) {
        if (!row.registration_id) continue;
        const parts = row.registration_id.split('-');
        const lastPart = parts[parts.length - 1];
        const parsed = parseInt(lastPart, 10);
        if (!isNaN(parsed) && parsed >= nextNum) {
          nextNum = parsed + 1;
        }
      }
    }

    let seqStr = String(nextNum).padStart(3, '0');
    let candidateId = `REG-CBP2026-${coordCode}-${seqStr}`;

    // 3. Double-check candidate ID uniqueness across ALL registrations
    let { data: existing } = await supabase
      .from('registrations')
      .select('id')
      .eq('registration_id', candidateId)
      .maybeSingle();

    while (existing) {
      nextNum++;
      seqStr = String(nextNum).padStart(3, '0');
      candidateId = `REG-CBP2026-${coordCode}-${seqStr}`;
      const res = await supabase
        .from('registrations')
        .select('id')
        .eq('registration_id', candidateId)
        .maybeSingle();
      existing = res?.data;
    }

    return candidateId;
  } catch (err) {
    console.error('Failed to generate sequential registration ID, using fallback:', err);
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `REG-CBP2026-01-${timestamp}${random}`;
  }
}

/**
 * Generates a unique Certificate ID in the format CERT-XXXXXXXX
 */
export function generateCertificateId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CERT-${timestamp}${random}`;
}

