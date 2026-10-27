/**
 * LECO Authoritative Domain Knowledge Base
 * Structured knowledge chunks for Retrieval-Augmented Generation (RAG).
 * Covers PUCSL tariffs, TOU peak schedules, Lifeline Emergency Credit,
 * recharge methods, smart meters, complaints, and energy conservation.
 */

const LECO_KNOWLEDGE_DOCS = [
  {
    id: "pucsl_domestic_tariffs",
    title: "PUCSL Domestic Electricity Tariffs and Block Structure",
    category: "tariffs",
    keywords: ["tariff", "pucsl", "rates", "block", "unit price", "cost", "fixed charge", "bill", "blocks", "kwh rate", "ගාස්තු", "බිල", "கட்டணம்"],
    content: `PUCSL (Public Utilities Commission of Sri Lanka) Domestic Block Tariff Structure:
- Block 1 (0 to 30 kWh): Rs. 8.00 per kWh + Monthly Fixed Charge: Rs. 150.00
- Block 2 (31 to 60 kWh): Rs. 15.00 per kWh + Monthly Fixed Charge: Rs. 300.00
- Block 3 (61 to 90 kWh): Rs. 27.00 per kWh + Monthly Fixed Charge: Rs. 400.00
- Block 4 (91 to 120 kWh): Rs. 35.00 per kWh + Monthly Fixed Charge: Rs. 1,000.00
- Block 5 (121 to 180 kWh): Rs. 45.00 per kWh + Monthly Fixed Charge: Rs. 1,500.00
- Block 6 (Above 180 kWh): Rs. 58.00 per kWh + Monthly Fixed Charge: Rs. 2,000.00

Lifeline Subsidy: Consumption below 60 kWh per month receives government lifeline subsidies. Exceeding 60 kWh in a billing cycle transitions the consumer into non-subsidized higher tariff blocks.`
  },
  {
    id: "tou_peak_schedule",
    title: "Time-of-Use (TOU) Electricity Tariffs and Peak Hours",
    category: "tariffs",
    keywords: ["peak", "peak hour", "off-peak", "day", "time of use", "tou", "night", "hours", "කාලය", "උච්ච", "நேரம்", "அதி உச்ச"],
    content: `LECO Time-of-Use (TOU) Daily Schedule for Domestic and General Purpose Customers:
- Peak Hours (18:30 to 22:30 / 6:30 PM to 10:30 PM): Highest electricity tariff rate (Rs. 54.00 per kWh). Recommendation: Strictly minimize heavy appliances such as electric irons, washing machines, water heaters, water pumps, and EV chargers during this 4-hour window.
- Day Hours (05:30 to 18:30 / 5:30 AM to 6:30 PM): Standard regular rate (Rs. 25.00 per kWh). Ideal for normal day-to-day household and business activities.
- Off-Peak Hours (22:30 to 05:30 / 10:30 PM to 5:30 AM): Lowest tariff rate (Rs. 13.00 per kWh). Best time to schedule automated washing machines, water pump filling, and electric vehicle (EV) charging.`
  },
  {
    id: "lifeline_emergency_credit",
    title: "Lifeline Mode and Emergency Credit Buffer Policy",
    category: "billing",
    keywords: ["lifeline", "emergency credit", "buffer", "overdraft", "grace period", "negative balance", "disconnect", "කඩාවැටීම", "හදිසි ණය", "அவசர கடன்"],
    content: `LECO Lifeline Mode (Emergency Credit Protection Policy):
- Overdraft Buffer: Prepaid smart meters automatically grant an emergency credit buffer up to -Rs. 500.00 when the wallet balance is depleted to zero.
- Overnight Disconnection Immunity: Under LECO consumer protection rules, electricity will never be disconnected between 22:00 (10:00 PM) and 06:00 (6:00 AM), even if your balance reaches zero during the night.
- Automatic Repayment: The emergency credit overdraft amount is automatically settled and deducted from your next top-up recharge with zero interest or penalty fee.`
  },
  {
    id: "payment_recharge_options",
    title: "Payment Methods and Instant Balance Recharge",
    category: "payments",
    keywords: ["pay", "payment", "recharge", "topup", "top up", "payhere", "card", "visa", "mastercard", "bank", "reload", "ගෙවීම්", "රීචාර්ජ්", "செலுத்துதல்", "ரீசார்ஜ்"],
    content: `LECO Smart Meter Balance Top-up and Payment Options:
- Instant Online Dashboard Top-up: Customers can recharge instantly through the customer portal using Visa, MasterCard, and PayHere secure gateway. Minimum recharge is Rs. 100.00.
- Online Banking: Direct bank transfer and bill payment through Sampath Vishwa, Commercial Bank, HNB, Bank of Ceylon (BOC), and Peoples Bank.
- Physical Outlets: Pay in person at any LECO branch customer care counter, CEB bill counter, or authorized supermarket/retail POS agents.
- Real-time Crediting: Once payment succeeds, smart meter balance is updated in real time via GPRS/AMI cellular telemetry within 10 to 30 seconds. If disconnected due to zero balance, the meter relay reconnects automatically upon recharge.`
  },
  {
    id: "smart_meter_telemetry",
    title: "Smart Meter AMI Infrastructure and Live Telemetry",
    category: "meters",
    keywords: ["smart meter", "telemetry", "kwh", "load", "voltage", "relay", "power factor", "export", "solar", "මීටරය", "විදුලි මීටරය", "மீட்டர்"],
    content: `LECO Advanced Metering Infrastructure (AMI) & Smart Meter Features:
- Real-time Telemetry: Smart meters report active power load (kW), cumulative consumption (kWh), solar generation export (kWh), voltage (230V nominal single-phase), and power factor.
- Bi-directional Solar Net Metering: Supports rooftop solar net metering, tracking both gross import from grid and solar export to grid.
- Automated Remote Relay: If prepaid balance runs out (and lifeline buffer is exhausted), the smart meter relay disconnects safely. Once topped up, the relay reconnects power remotely without requiring a technician visit.`
  },
  {
    id: "complaints_and_breakdowns",
    title: "Complaints, Outage Reporting, and Customer Support",
    category: "support",
    keywords: ["complaint", "support", "help", "outage", "power cut", "breakdown", "hotline", "1987", "contact", "පැමිණිලි", "විදුලිය ඇනහිටීම්", "புகார்", "மின்தடை"],
    content: `LECO Customer Support and Emergency Assistance:
- 24/7 Emergency Breakdown Hotline: Dial 1987 (toll-free across Sri Lanka) for urgent power outage, line breakdown, or sparking hazards.
- In-App Complaints Portal: File tickets directly via the 'Complaints & Support' tab on your dashboard for billing disputes, meter inspection, voltage instability, or service inquiries.
- Customer Care Email: support@leco.lk. Official website: www.leco.lk.`
  },
  {
    id: "energy_saving_tips",
    title: "Practical Energy Conservation and Bill Reduction Tips",
    category: "energy_saving",
    keywords: ["save", "saving", "reduce", "conservation", "bill high", "tips", "efficient", "inverter", "ac", "suggestion", "suggestions", "recommendation", "උපදෙස්", "ශක්තිය ඉතිරි", "ஆலோசனை", "சேமிப்பு"],
    content: `Top Energy Saving Tips for LECO Electricity Consumers:
1. Air Conditioning: Set inverter AC temperature to 25°C to 26°C. Every degree lower increases energy consumption by approximately 6%.
2. Refrigerators: Maintain door seals and avoid placing hot food directly into the fridge. Keep coils dusted.
3. Lighting: Replace all incandescent and fluorescent lamps with high-efficiency LED bulbs, saving up to 80% lighting energy.
4. Water Heating & Ironing: Iron clothes in bulk and heat water during off-peak hours (22:30 to 05:30) to avoid high peak electricity rates.`
  }
];

module.exports = {
  LECO_KNOWLEDGE_DOCS
};
