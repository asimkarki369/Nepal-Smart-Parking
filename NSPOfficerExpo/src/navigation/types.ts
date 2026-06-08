export type RootStackParamList = {
  OfficerLogin:    undefined;
  OfficerMain:     undefined;
  SessionVerify:   { sessionToken: string; overtimeMins: number; fineAmount: number };
  IssueFineSummary:{ sessionToken: string; overtimeMins: number; fineAmount: number };
};

export type OfficerTabParamList = {
  OfficerDashboard: undefined;
  OfficerScan:      undefined;
  OfficerFines:     undefined;
};
