import { Bill, Appliance, UsageData } from '../types';

export const mockBills: Bill[] = [
  { id: 'INV-2023-11', month: 'November 2023', amount: 84.50, dueDate: '2023-12-05', status: 'Paid' },
  { id: 'INV-2023-10', month: 'October 2023', amount: 92.10, dueDate: '2023-11-05', status: 'Paid' },
  { id: 'INV-2023-09', month: 'September 2023', amount: 110.20, dueDate: '2023-10-05', status: 'Paid' },
  { id: 'INV-2023-08', month: 'August 2023', amount: 134.80, dueDate: '2023-09-05', status: 'Paid' },
];

export const mockAppliances: Appliance[] = [
  { id: '1', name: 'HVAC System', status: 'On', powerKw: 2.5, icon: 'Thermometer' },
  { id: '2', name: 'Refrigerator', status: 'On', powerKw: 0.15, icon: 'Refrigerator' },
  { id: '3', name: 'Washing Machine', status: 'Off', powerKw: 0.0, icon: 'WashingMachine' },
  { id: '4', name: 'Living Room Lights', status: 'On', powerKw: 0.08, icon: 'Lightbulb' },
  { id: '5', name: 'Electric Vehicle', status: 'Off', powerKw: 0.0, icon: 'Car' },
];

export const generateInitialUsage = (): UsageData[] => {
  const data: UsageData[] = [];
  let now = new Date();
  // Generate last 20 minutes of data
  for (let i = 20; i >= 0; i--) {
    let pointTime = new Date(now.getTime() - i * 60000);
    // Base load around 2.7 kW with some noise
    let kw = 2.7 + (Math.random() * 0.4 - 0.2); 
    data.push({
      time: pointTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: pointTime.getTime(),
      kw: Number(kw.toFixed(2))
    });
  }
  return data;
};
