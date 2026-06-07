export type RootStackParamList = {
  // Role picker
  RolePicker: undefined;
  // Driver auth
  Login: undefined;
  OTP: { phone: string };
  Register: { phone: string };
  // Driver main
  Main: undefined;
  ZoneDetail: { zoneCode: string };
  PaymentConfirm: { zoneCode: string; vehicleType: '2w' | '4w'; durationMinutes: number };
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
};

export type OfficerTabParamList = {
  OfficerDashboard: undefined;
  OfficerScan: undefined;
  OfficerFines: undefined;
  OfficerProfile: undefined;
};
