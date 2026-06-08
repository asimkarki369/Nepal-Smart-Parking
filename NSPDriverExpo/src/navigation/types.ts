export type RootStackParamList = {
  // Role picker
  RolePicker: undefined;
  // Driver auth — National ID based (no OTP)
  Login: undefined;
  Register: undefined;
  // Driver main
  Main: undefined;
  ZoneDetail: { zoneCode: string };
  PaymentConfirm: { zoneCode: string; vehicleType: '2w' | '4w'; durationMinutes: number; hourlyRate: number };
  Vehicles: undefined;
  // Officer auth
  OfficerLogin: undefined;
  // Officer main
  OfficerMain: undefined;
  SessionVerify: { sessionToken: string };
  IssueFineSummary: { sessionToken: string; overtimeMins: number; fineAmount: number };
};

export type MainTabParamList = {
  Home: undefined;
  Session: undefined;
  Wallet: undefined;
  History: undefined;
  Profile: undefined;
};

export type OfficerTabParamList = {
  OfficerDashboard: undefined;
  OfficerScan: undefined;
  OfficerFines: undefined;
  OfficerProfile: undefined;
};
