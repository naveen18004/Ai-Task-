export interface ParsedTask {
  text?: string;
  intent: string;
  date: string;
  time: string;
  category: string;
  priority: string;
  location?: string;
  smartScore?: number;
  actionContact?: string;
  actionPayload?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES: Record<string, number> = {
  jan: 0, january: 0,
  feb: 1, february: 1,
  mar: 2, march: 2,
  apr: 3, april: 3,
  may: 4,
  jun: 5, june: 5,
  jul: 6, july: 6,
  aug: 7, august: 7,
  sep: 8, september: 8,
  oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function pad(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function toDateStr(d: Date): string {
  return d.toDateString(); // e.g. "Mon Feb 23 2026"
}

function nextWeekday(targetDay: number, now: Date): Date {
  const result = new Date(now);
  const diff = (targetDay - now.getDay() + 7) % 7 || 7;
  result.setDate(now.getDate() + diff);
  return result;
}

/** Normalise raw time text → "HH:MM AM/PM" or "HH:MM" (24h) */
function normalizeTime(raw: string): string {
  const r = raw.trim().toLowerCase();

  // noon / midnight
  if (r === 'noon') return '12:00 PM';
  if (r === 'midnight') return '12:00 AM';

  // 24-hour: 14:30, 1430, 14.30
  const h24 = r.match(/^(\d{1,2})[:.](\d{2})$/);
  if (h24) {
    const h = parseInt(h24[1]), m = parseInt(h24[2]);
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) return `${pad(h)}:${pad(m)}`;
  }

  // 12-hour with minutes: 10:30am, 10:30 am, 10:30 a.m.
  const h12m = r.match(/^(\d{1,2}):(\d{2})\s*([ap])\.?m\.?$/);
  if (h12m) {
    const suffix = h12m[3] === 'a' ? 'AM' : 'PM';
    return `${h12m[1]}:${h12m[2]} ${suffix}`;
  }

  // 12-hour without minutes: 10am, 10 am, 10 a.m.
  const h12 = r.match(/^(\d{1,2})\s*([ap])\.?m\.?$/);
  if (h12) {
    const suffix = h12[2] === 'a' ? 'AM' : 'PM';
    return `${h12[1]}:00 ${suffix}`;
  }

  // already normalised (e.g. "10:30 AM")
  if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(r)) return r.toUpperCase();

  return raw; // fallback
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseTaskText(text: string): ParsedTask {
  const lower = text.toLowerCase();
  const now = new Date();

  // ── Intent ──────────────────────────────────────────────────────────────
  let intent = 'task';
  if (lower.match(/email|mail|send out|draft email/)) intent = 'email';
  else if (lower.match(/text|sms|message|whatsapp/)) intent = 'sms';
  else if (lower.match(/meeting|meet|sync|standup/)) intent = 'meeting';
  else if (lower.match(/call|phone|ring/)) intent = 'call';
  else if (lower.match(/remind|reminder|buy|grocery|groceries|shop|pickup/)) intent = 'reminder';
  else if (lower.match(/submit|assignment|homework|project|deadline/)) intent = 'submission';
  else if (lower.match(/exam|test|quiz|paper/)) intent = 'exam';
  else if (lower.match(/appointment|doctor|dentist|hospital|clinic/)) intent = 'appointment';

  // ── Priority ─────────────────────────────────────────────────────────────
  let priority = 'medium';
  if (lower.match(/urgent|asap|high|important|critical|immediately/)) priority = 'high';
  else if (lower.match(/low|minor|whenever|eventually/)) priority = 'low';

  // ── Date extraction ──────────────────────────────────────────────────────
  let date = '';

  // 1. Relative keywords
  if (lower.match(/\btoday\b|\btonight\b/)) {
    date = toDateStr(now);
  } else if (lower.match(/\byesterday\b/)) {
    const d = new Date(now); d.setDate(d.getDate() - 1);
    date = toDateStr(d);
  } else if (lower.match(/\btomorrow\b/)) {
    const d = new Date(now); d.setDate(d.getDate() + 1);
    date = toDateStr(d);
  } else if (lower.match(/\bday after tomorrow\b/)) {
    const d = new Date(now); d.setDate(d.getDate() + 2);
    date = toDateStr(d);
  }

  // 2. "next/this <weekday>"
  if (!date) {
    const nextDay = lower.match(/\b(?:next|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)\b/);
    if (nextDay) {
      const dayNum = DAY_NAMES[nextDay[1]];
      if (dayNum !== undefined) date = toDateStr(nextWeekday(dayNum, now));
    }
  }

  // 3. Bare weekday name (next occurrence)
  if (!date) {
    const bareDay = lower.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
    if (bareDay) {
      const dayNum = DAY_NAMES[bareDay[1]];
      if (dayNum !== undefined) date = toDateStr(nextWeekday(dayNum, now));
    }
  }

  // 4. Numeric: dd/mm/yyyy or mm/dd/yyyy or yyyy-mm-dd or dd-mm-yyyy
  if (!date) {
    const numDate = lower.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/); // ISO
    if (numDate) {
      const d = new Date(parseInt(numDate[1]), parseInt(numDate[2]) - 1, parseInt(numDate[3]));
      if (!isNaN(d.getTime())) date = toDateStr(d);
    }
  }
  if (!date) {
    const slashDate = lower.match(/\b(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?\b/);
    if (slashDate) {
      const day = parseInt(slashDate[1]);
      const mon = parseInt(slashDate[2]) - 1;
      const yr = slashDate[3] ? (slashDate[3].length === 2 ? 2000 + parseInt(slashDate[3]) : parseInt(slashDate[3])) : now.getFullYear();
      const d = new Date(yr, mon, day);
      if (!isNaN(d.getTime())) date = toDateStr(d);
    }
  }

  // 4b. Numeric: dd.mm.yyyy 
  if (!date) {
    const dotDate = lower.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})\b/);
    if (dotDate) {
      const day = parseInt(dotDate[1]);
      const mon = parseInt(dotDate[2]) - 1;
      const yr = dotDate[3].length === 2 ? 2000 + parseInt(dotDate[3]) : parseInt(dotDate[3]);
      const d = new Date(yr, mon, day);
      if (!isNaN(d.getTime())) date = toDateStr(d);
    }
  }

  // 5. "28 January", "28th Jan", "Jan 28", "January 28th"
  if (!date) {
    const monthNames = Object.keys(MONTH_NAMES).filter(k => k.length > 2).join('|');
    const re = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthNames})(?:\\s+(\\d{2,4}))?\\b`, 'i');
    const re2 = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s+(\\d{2,4}))?\\b`, 'i');
    let m = lower.match(re) || lower.match(re2);
    if (m) {
      // Determine which capture groups are day vs month
      let day: number, mon: number, yr: number;
      if (!isNaN(parseInt(m[1]))) {
        day = parseInt(m[1]); mon = MONTH_NAMES[m[2].toLowerCase()]; yr = m[3] ? parseInt(m[3]) : now.getFullYear();
      } else {
        mon = MONTH_NAMES[m[1].toLowerCase()]; day = parseInt(m[2]); yr = m[3] ? parseInt(m[3]) : now.getFullYear();
      }
      if (yr < 100) yr += 2000;
      const d = new Date(yr, mon, day);
      if (!isNaN(d.getTime())) date = toDateStr(d);
    }
  }

  // ── Time extraction ──────────────────────────────────────────────────────
  let time = '';

  // Special words first
  if (/\bnoon\b/.test(lower)) { time = '12:00 PM'; }
  else if (/\bmidnight\b/.test(lower)) { time = '12:00 AM'; }
  else if (/\bmorning\b/.test(lower) && !time) { time = '08:00 AM'; }
  else if (/\bafternoon\b/.test(lower) && !time) { time = '02:00 PM'; }
  else if (/\bevening\b/.test(lower) && !time) { time = '06:00 PM'; }
  else if (/\bnight\b/.test(lower) && !time) { time = '09:00 PM'; }

  if (!time) {
    // Full 12h: 10:30am, 10:30 am, 10:30a.m., 10:30 A.M., 6.20 pm
    const m12full = lower.match(/\b(\d{1,2})[:.](\d{2})\s*([ap])\.?m\.?\b/i);
    if (m12full) {
      time = normalizeTime(`${m12full[1]}:${m12full[2]}${m12full[3]}m`);
    }
  }

  if (!time) {
    // Short 12h: 10am, 10 am, 10a.m.
    const m12short = lower.match(/\b(\d{1,2})\s*([ap])\.?m\.?\b/i);
    if (m12short) {
      time = normalizeTime(`${m12short[1]}${m12short[2]}m`);
    }
  }

  if (!time) {
    // 24-hour: 14:30 or 14.30
    const m24 = lower.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/);
    if (m24) {
      time = normalizeTime(`${m24[1]}:${m24[2]}`);
    }
  }

  if (!time) {
    // Informal: "at 9", "by 6", "around 10"
    const mInformal = lower.match(/\b(?:at|by|around|before|after)\s+(\d{1,2})\b(?!\s*[ap]\.?m|\.\d+)/i);
    if (mInformal) {
      const h = parseInt(mInformal[1]);
      const isEvening = lower.includes('tonight') || lower.includes('evening') || lower.includes('night');
      time = (isEvening && h < 12) ? `${h}:00 PM` : (h < 7 ? `${h}:00 PM` : `${h}:00 AM`);
    }
  }

  if (date && !time) {
    time = '09:00 AM';
  }

  // ── Location extraction ──────────────────────────────────────────────────
  let location = '';
  // match "at [Place]" or "in [Place]", explicitly avoiding time/date words
  const locMatch = text.match(/\b(?:at|in)\s+([A-Z][a-zA-Z0-9\s,']+(?:Room|Hall|Coffee|Cafe|Building|Block|Restaurant|Center|Centre|Campus|Office|Shop|Store|Hospital|Clinic|School|University|College)?)\b/);
  if (locMatch) {
    // simple heuristic: if it looks capitalized and isn't a time word
    let locCandid = locMatch[1].trim();
    // Exclude time words from the captured location
    locCandid = locCandid.replace(/\b(tomorrow|today|yesterday|tonight|morning|afternoon|evening|night|noon|midnight|at \d.*)\b/gi, '').trim();

    if (locCandid && !/^\d/.test(locCandid) && !/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)$/i.test(locCandid)) {
      location = locCandid;
    }
  }

  // ── Smart priority boost ──────────────────────────────────────────────────
  if (date === toDateStr(now) && priority === 'medium') priority = 'high';

  // ── Category ──────────────────────────────────────────────────────────────
  let category = 'General';
  if (intent === 'meeting' || intent === 'call' || intent === 'email') category = 'Work';
  else if (intent === 'reminder' || intent === 'sms') category = 'Personal';
  else if (intent === 'submission' || intent === 'exam') category = 'Education';
  else if (intent === 'appointment') category = 'Health';

  // ── Smart Autonomous Extraction ───────────────────────────────────────────
  let actionContact = '';
  let actionPayload = '';

  if (intent === 'email' || intent === 'sms' || intent === 'call') {
    const contactMatch = text.match(/(?:email|mail|message|text|call|to)\s+([A-Za-z0-9\-+\.]+)\b/i);
    if (contactMatch && !['the', 'my', 'to', 'me', 'a', 'an'].includes(contactMatch[1].toLowerCase())) {
      actionContact = contactMatch[1];
      // Try to get actual message content via heuristics 'that X' or 'about Y'
      const payloadMatch = text.match(/(?:that|to say|saying|about)\s+(.*)/i);
      if (payloadMatch) {
        actionPayload = payloadMatch[1].trim();
      }
    }
  }

  // ── Smart Summary ─────────────────────────────────────────────────────────
  // Shrink long text into a concise title for the UI
  let summary = text.trim();
  const lines = summary.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  if (lines.length > 1) {
    // If multiple lines, pick the first line as the "Title" (e.g. "*Format for Second Review MCA SS Batch*")
    summary = lines[0];
    // Strip asterisks or markdown bolding from the title
    summary = summary.replace(/^\*+|\*+$/g, '');
  }

  // Allow the UI to handle visual text wrapping natively instead of hard-truncating.

  // ── Smart Score (Eisenhower matrix numeric mapping) ─────────────────────
  let smartScore = 0;
  // Importance: Base score mapping
  if (priority === 'high') smartScore += 50;
  if (priority === 'medium') smartScore += 25;
  if (priority === 'low') smartScore += 10;

  // Urgency: Date mapping
  if (date) {
    const dDate = new Date(date).getTime();
    const today = new Date(toDateStr(now)).getTime();
    if (dDate < today) smartScore += 60; // Overdue = highly urgent
    else if (dDate === today) smartScore += 40; // Due today
    else if (dDate - today <= 2 * 24 * 60 * 60 * 1000) smartScore += 20; // within 2 days
    else if (dDate - today <= 7 * 24 * 60 * 60 * 1000) smartScore += 10; // within week
  }

  return {
    text: summary, // OVERRIDE the raw text with our neat summary
    intent,
    date,
    time,
    category,
    priority,
    location,
    smartScore,
    actionContact,
    actionPayload
  };
}
