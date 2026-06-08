// Fine brackets based on overtime duration
// Nepal Smart Parking enforcement schedule

export interface FineBracket {
  label: string;
  overtimeLabel: string;
  amount: number;
}

export const FINE_BRACKETS: FineBracket[] = [
  { label: 'Minor Fine',     overtimeLabel: '1–15 min',   amount: 100  },
  { label: 'Standard Fine',  overtimeLabel: '15–30 min',  amount: 250  },
  { label: 'Heavy Fine',     overtimeLabel: '30–60 min',  amount: 500  },
  { label: 'Severe Fine',    overtimeLabel: '1–2 hours',  amount: 1000 },
  { label: 'Critical Fine',  overtimeLabel: '2–4 hours',  amount: 2000 },
  { label: 'Maximum Fine',   overtimeLabel: '4h+',        amount: 3500 },
];

const MAX_FINE = 3500;

/** Flat mandatory fine for vehicles with NO parking session at all */
export const ILLEGAL_PARKING_FINE = 1500;

export function calcFine(overtimeMins: number): number {
  if (overtimeMins <= 0)   return 0;   // no overtime = no fine
  if (overtimeMins <= 15)  return 100; // even 1 min = Rs 100
  if (overtimeMins <= 30)  return 250;
  if (overtimeMins <= 60)  return 500;
  if (overtimeMins <= 120) return 1000;
  if (overtimeMins <= 240) return 2000;
  // >4h: Rs 2000 + Rs 200 per additional hour, capped at Rs 3500
  const extraHours = Math.ceil((overtimeMins - 240) / 60);
  return Math.min(2000 + extraHours * 200, MAX_FINE);
}

export function getBracketLabel(overtimeMins: number): FineBracket {
  if (overtimeMins <= 0)   return FINE_BRACKETS[0];
  if (overtimeMins <= 15)  return FINE_BRACKETS[0];
  if (overtimeMins <= 30)  return FINE_BRACKETS[1];
  if (overtimeMins <= 60)  return FINE_BRACKETS[2];
  if (overtimeMins <= 120) return FINE_BRACKETS[3];
  if (overtimeMins <= 240) return FINE_BRACKETS[4];
  return FINE_BRACKETS[5];
}
