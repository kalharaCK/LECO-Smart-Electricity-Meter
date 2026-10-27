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
  },
  {
    id: "high_usage_spike_investigation",
    title: "Why Is My Electricity Usage or Bill High? (Spike Investigation)",
    category: "usage",
    keywords: ["high bill", "bill high", "spike", "increase", "more units", "usage high", "drain", "leakage", "unexpected", "වැඩිපුර", "බිල වැඩි", "අධික පරිභෝජනය", "அதிக கட்டணம்", "அதிக நுகர்வு"],
    content: `Common Causes for Sudden High Electricity Usage and Bill Spikes:
1. Overhead Water Pump Float Switch Malfunction: If the tank ball valve or float switch sticks, the pump (0.5 to 1.5 HP) can run continuously undetected, adding 15 to 30 kWh per day.
2. Refrigerator Door Gasket Failure: Worn-out or loose rubber gaskets let cold air escape, forcing the compressor to run 24 hours continuously rather than cycling.
3. Air Conditioner Filter Clogging: Blocked filters restrict airflow, reducing cooling efficiency and increasing electricity draw by 15% to 30%.
4. Electric Water Geyser Scale Accumulation: Limescale coating on water heating elements significantly slows heat transfer, doubling the time and power required to heat water.
5. Household Wiring Earth Leakage: Damaged insulation or moisture in conduit pipes can leak current to ground. Test by switching off all household appliances at the main switchboard and observing if the smart meter red pulse LED still blinks.`
  },
  {
    id: "solar_rooftop_net_metering",
    title: "Rooftop Solar and Bi-Directional Net Metering Guide",
    category: "usage",
    keywords: ["solar", "net metering", "export", "import", "solar panels", "inverter", "grid export", "units exported", "roof solar", "සූර්ය", "සෝලා", "අපනයනය", "சூரிய சக்தி", "மின் ஏற்றுமதி"],
    content: `LECO Smart Solar Net Metering & Grid Export Features:
1. Bi-Directional Measurement: LECO smart meters contain separate high-precision measurement registers for Grid Import (energy drawn from LECO) and Solar Export (excess energy generated by rooftop solar panels sent to the grid).
2. Net Consumption Calculation: Net billed kWh is computed as: Net = Maximum(0, Grid Import - Solar Export).
3. Solar Schemes in Sri Lanka:
   - Net Metering: Excess exported units are banked and carried forward as energy credits against future monthly bills.
   - Net Accounting: Net exported units are purchased by the utility at the prevailing PUCSL/CEB feed-in tariff.
   - Net Plus: All generated solar electricity is exported and purchased directly at the approved tariff.`
  },
  {
    id: "appliance_power_consumption_guide",
    title: "Household Appliance Wattage and Power Consumption Guide",
    category: "energy_saving",
    keywords: ["appliance", "wattage", "watts", "iron", "fridge", "pump", "heater", "ac", "television", "fan", "oven", "induction", "kwh per hour", "උපකරණ", "වොට්", "மின் உபகரணங்கள்"],
    content: `Typical Household Appliance Power Draw and Hourly Consumption:
- Inverter Air Conditioner (1.0 HP / 9,000 BTU): 700W to 1,000W (~0.7 to 1.0 kWh per hour when room is cooled).
- Electric Iron: 1,000W to 1,800W (~1.0 to 1.8 kWh per hour). Recommendation: Iron clothes in a single batch once or twice a week.
- Water Pump (0.5 HP to 1.0 HP): 375W to 750W (~0.38 to 0.75 kWh per hour of pumping). Run during Off-Peak (22:30-05:30).
- Water Heater / Shower Geyser: 2,000W to 3,500W (~2.0 to 3.5 kWh per hour).
- Inverter Refrigerator (Double Door): 80W to 180W (~0.8 to 1.5 kWh per 24 hours).
- Microwave Oven / Induction Cooker: 800W to 1,800W (~0.15 kWh for a 10-minute cooking cycle).
- LED Lighting: 7W to 12W per bulb (replaces 60W-100W incandescent, reducing lighting energy by 85%).
- Ceiling Fan: 50W to 75W (~0.5 kWh per 8 hours).`
  },
  {
    id: "account_management_and_meters",
    title: "Account Management, Multi-Meter Linking, and Security",
    category: "account",
    keywords: ["account", "meter link", "add meter", "pin", "password", "profile", "multiple meters", "security", "phone number", "sms alert", "budget limit", "ගිණුම", "මුරපදය", "දුරකථන අංකය", "கணக்கு", "கடவுச்சொல்"],
    content: `LECO Smart Customer Portal Account & Meter Management:
1. Linking New Meters: Customers can manage multiple smart meters under a single user account (e.g. primary residence, rental annex, business). To add a meter, go to 'Add Meter' and enter the 9-digit LECO meter number and secret PIN provided on your LECO smart card.
2. Real-Time SMS Alert Configuration: Under 'Settings', configure your verified mobile number to receive instant SMS alerts for low balance warnings, daily budget thresholds, and recharge confirmations.
3. Monthly Budget & Thresholds: Set customized monthly spending limits in LKR and daily kWh targets to prevent unexpected bill spikes.
4. Portal Security: Password requires a minimum of 10 characters. All sessions are protected with HTTP-only security tokens.`
  },
  {
    id: "automatic_disconnection_and_reconnection",
    title: "Automatic Disconnection and Instant Reconnection Policy",
    category: "account",
    keywords: ["reconnect", "disconnect", "cut off", "restore", "relay", "power off", "zero balance", "instant reconnect", "relay trip", "විසන්ධි", "නැවත සම්බන්ධ", "ස්වයංක්‍රීය", "மீண்டும் இணைப்பு", "துண்டிப்பு"],
    content: `LECO Smart Meter Remote Disconnection & Reconnection Rules:
1. Zero Balance Behavior: When prepaid balance reaches Rs. 0.00, power is not immediately disconnected. The meter automatically engages Lifeline Mode (Emergency Credit buffer up to -Rs. 500.00).
2. Overnight Immunity Window: Electricity is strictly NEVER disconnected between 22:00 (10:00 PM) and 06:00 (6:00 AM) due to low balance, protecting households through the night.
3. Remote Disconnection: If the emergency credit buffer is fully exhausted during daytime hours, the meter internal solid-state relay disconnects power safely.
4. Instant Automatic Reconnection: Once a top-up of at least Rs. 100 is completed online or at a counter, the AMI cellular telemetry system commands the meter relay to close automatically within 10 to 30 seconds. No technician visit or reconnection fee is required.`
  },
  {
    id: "complaint_categories_and_tracking",
    title: "Complaint Categories, Dispute Filing, and Ticket Tracking",
    category: "complaints",
    keywords: ["complaint categories", "ticket", "dispute", "voltage", "meter defect", "track ticket", "status", "repair", "flicker", "low voltage", "පැමිණිලි", "දෝෂ", "තත්ත්වය", "புகார்", "மின்னழுத்தம்"],
    content: `LECO In-App Customer Support & Complaint Resolution:
1. Supported Ticket Categories:
   - Power Outage & Breakdown: Localized blackouts, tripped distribution transformers, or fallen service lines.
   - Billing & Recharge Disputes: Payment made but meter balance uncredited, or tariff classification mismatch.
   - Meter Hardware / Display Issue: Blank LCD display, unusual red indicator LED, or relay clicking sound.
   - Voltage Fluctuation & Quality: Voltage dropping below 210V (dim lights, AC refusing to start) or exceeding 250V.
   - General Service Requests: Smart card replacement, name transfer, or meter inspection.
2. Tracking Ticket Status: Each complaint receives an automated tracking number (e.g. CMP-2026-XXXX). Customers can view real-time status (Pending, Under Investigation, Technician Dispatched, Resolved) in the 'Complaints & Support' tab.
3. 24/7 National Emergency Hotline: For immediate electrical hazards, fire, or wire snapping, call 1987 (toll-free across Sri Lanka).`
  }
];

module.exports = {
  LECO_KNOWLEDGE_DOCS
};
