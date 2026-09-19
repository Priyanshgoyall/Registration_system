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
      const email = (coordinatorUser.email || '').toLowerCase();
      const name = (coordinatorUser.full_name || '').toLowerCase();

      // Check specific coordinator/desk pattern: e.g. coordinator1, coord2, desk3, operator1
      const patternMatch = `${email} ${name}`.match(/(?:coord(?:inator)?|desk|counter|operator|user)\s*[-_#]?\s*(\d+)/i);

      if (patternMatch) {
        coordCode = String(parseInt(patternMatch[1], 10)).padStart(2, '0');
      } else {
        // Generic 1-2 digit number check (avoiding year numbers like 2026)
        const generalMatch = `${email} ${name}`.match(/\b(\d{1,2})\b/);
        if (generalMatch) {
          coordCode = String(parseInt(generalMatch[1], 10)).padStart(2, '0');
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
            // fallback
          }
        }
      }
    }

    // 2. Count existing registrations made by this specific coordinator
    let count = 0;
    let maxExistingNum = 0;

    const { data: allRegs } = await supabase
      .from('registrations')
      .select('registration_id, coordinator_id');

    if (allRegs && allRegs.length > 0) {
      const parsedCoordNum = parseInt(coordCode, 10);
      const coordRegex = new RegExp(`-(?:${parsedCoordNum}|${coordCode})-(\\d+)$`, 'i');

      for (const r of allRegs) {
        const isThisCoord = (coordinatorUser?.id && r.coordinator_id === coordinatorUser.id) ||
                            (r.registration_id && coordRegex.test(r.registration_id));
        if (isThisCoord) {
          count++;
          if (r.registration_id) {
            const match = r.registration_id.match(/-(\d+)$/);
            if (match) {
              const num = parseInt(match[1], 10);
              if (!isNaN(num) && num > maxExistingNum) {
                maxExistingNum = num;
              }
            }
          }
        }
      }
    }

    let nextNum = Math.max(count + 1, maxExistingNum + 1);
    let seqStr = String(nextNum).padStart(3, '0');
    let candidateId = `REG-CBP2026-${coordCode}-${seqStr}`;

    // 3. Double-check candidate ID uniqueness across ALL registrations
    if (allRegs && allRegs.length > 0) {
      const existingIds = new Set(allRegs.map((r) => r.registration_id?.toUpperCase()));
      while (existingIds.has(candidateId.toUpperCase())) {
        nextNum++;
        seqStr = String(nextNum).padStart(3, '0');
        candidateId = `REG-CBP2026-${coordCode}-${seqStr}`;
      }
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

