// Fine brackets based on overtime duration
// Nepal Smart Parking enforcement schedule

export interface FineBracket {
  label: string;
  overtimeLabel: string;
  amount: number;
}

export const FINE_BRACKETS: FineBracket[] = [
  { label: 'Warning',        overtimeLabel: '0–15 min',   amount: 0   },
  { label: 'Minor Fine',     overtimeLabel: '15–30 min',  amount: 100 },
  { label: 'Standard Fine',  overtimeLabel: '30–60 min',  amount: 250 },
  { label: 'Heavy Fine',     overtimeLabel: '1–2 hours',  amount: 500 },
  { label: 'Severe Fine',    overtimeLabel: '2–4 hours',  amount: 1000 },
  { label: 'Maximum Fine',   overtimeLabel: '4h+',        amount: 2000 },
];

export function calcFine(overtimeMins: number): number {
  if (overtimeMins <= 0)   return 0;
  if (overtimeMins <= 15)  return 0;    // grace period
  if (overtimeMins <= 30)  return 100;
  if (overtimeMins <= 60)  return 250;
  if (overtimeMins <= 120) return 500;
  if (overtimeMins <= 240) return 1000;
  // >4h: Rs 2000 + Rs 200 per additional hour
  const extraHours = Math.ceil((overtimeMins - 240) / 60);
  return 2000 + extraHours * 200;
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
