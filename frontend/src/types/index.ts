export interface UsageData {
  time: string;
  timestamp: number;
  kw: number;
}

export interface Bill {
  id: string;
  month: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
}

export interface Appliance {
  id: string;
  name: string;
  status: 'On' | 'Off';
  powerKw: number;
  icon: string;
}
