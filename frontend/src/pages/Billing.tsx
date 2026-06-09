import React, { useState, useEffect } from 'react';
import { CreditCard, Download, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export function Billing() {
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [bills, setBills] = useState<any[]>([]);
  const { token } = useAuth();
  
  useEffect(() => {
    const fetchBills = async () => {
      try {
        const res = await fetch('/api/billing/history', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setBills(data.bills);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchBills();
  }, [token]);
  
  const currentBalance = bills.length > 0 ? bills[0].amount : 0;
  const currentDueDate = bills.length > 0 ? bills[0].dueDate : 'N/A';
  const currentMonthName = bills.length > 0 ? bills[0].month : 'N/A';

  // Format to LKR helper
  const formatLKR = (amount: number) => {
    return new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR', minimumFractionDigits: 0 }).format(amount).replace('LKR', 'Rs. ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-50 tracking-tight">Payment Hub</h1>
        <p className="text-slate-500 mt-1">Manage your invoices and payment methods for Sri Lanka operations.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 border border-slate-800 bg-slate-900 rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">Current Balance</h3>
              <AlertCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-4xl font-black tracking-tight text-slate-50 mt-2">{formatLKR(currentBalance)}</p>
            <p className="inline-block mt-3 bg-rose-500/10 text-rose-500 text-xs font-bold px-2 py-1 rounded-md">Due by {currentDueDate}</p>
          </div>
          <button 
            onClick={() => setShowPaymentModal(true)}
            className="w-full mt-8 bg-emerald-500 hover:bg-emerald-400 text-[#050505] font-bold uppercase tracking-wider py-3.5 rounded-xl transition-colors flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)] text-sm"
          >
            <CreditCard className="w-4 h-4 mr-2" />
            Pay Now
          </button>
        </div>

        <div className="lg:col-span-2 border border-[#1f1f1f] bg-[#0a0a0a] rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider mb-5">Payment Methods</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 border border-slate-800 bg-slate-900/50 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer group">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                  <CreditCard className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200 text-sm">Visa ending in 4242</p>
                  <p className="text-xs text-slate-500 mt-0.5">Expires 12/2025</p>
                </div>
              </div>
              <span className="text-[10px] font-black bg-slate-950 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-md uppercase tracking-widest shadow-sm">Default</span>
            </div>
            
            <div className="flex items-center justify-between p-4 border border-slate-800 bg-slate-900/50 rounded-xl hover:bg-slate-800/80 transition-colors cursor-pointer group opacity-60 hover:opacity-100">
              <div className="flex items-center space-x-4">
                <div className="p-2.5 bg-slate-800 rounded-lg group-hover:bg-slate-700 transition-colors">
                  <CreditCard className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-semibold text-slate-200 text-sm">Mastercard ending in 8812</p>
                  <p className="text-xs text-slate-500 mt-0.5">Expires 08/2024</p>
                </div>
              </div>
            </div>

            <button className="text-sm font-semibold text-emerald-500 hover:text-emerald-400 py-3 w-full text-center border border-dashed border-slate-700 rounded-xl hover:bg-slate-900 transition-colors mt-2">
              + Add new payment method
            </button>
          </div>
        </div>
      </div>

      <div className="border border-[#1f1f1f] bg-[#0a0a0a] rounded-2xl overflow-hidden mt-8">
        <div className="px-6 py-5 border-b border-[#1f1f1f]">
          <h3 className="font-bold text-xs text-slate-400 uppercase tracking-wider">Invoice History</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-950 text-slate-400 text-[11px] uppercase tracking-widest">
                <th className="px-6 py-4 font-bold">Invoice ID</th>
                <th className="px-6 py-4 font-bold">Billing Period</th>
                <th className="px-6 py-4 font-bold">Amount</th>
                <th className="px-6 py-4 font-bold">Status</th>
                <th className="px-6 py-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f1f1f]">
              {bills.map((bill, index) => (
                <tr key={bill.id} className="hover:bg-slate-900/40 transition-colors text-sm">
                  <td className="px-6 py-4 font-semibold text-slate-200">{bill.id}</td>
                  <td className="px-6 py-4 text-slate-400 font-medium">{bill.month}</td>
                  <td className="px-6 py-4 font-mono font-medium text-slate-200">{formatLKR(bill.amount)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                      bill.status === 'Pending' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                      'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                    }`}>
                      {bill.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-slate-500 hover:text-emerald-500 transition-colors p-2 rounded-lg hover:bg-slate-800">
                      <Download className="w-4 h-4 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {bills.length === 0 && (
                <tr>
                   <td colSpan={5} className="px-6 py-8 text-center text-slate-500">No billing history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showPaymentModal && (
        <div className="fixed inset-0 bg-[#050505]/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-[#1f1f1f] rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-md w-full p-8 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-lg font-bold text-slate-50 tracking-tight">Complete Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-500 hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors">
                <span className="block mb-1 text-2xl">&times;</span>
              </button>
            </div>
            
            <div className="text-center py-8 bg-[#0a0a0a] rounded-xl border border-slate-800 mb-8">
              <p className="text-xs text-slate-400 uppercase tracking-wider font-bold mb-3">Amount Due</p>
              <p className="text-4xl font-black text-slate-50 mb-2">{formatLKR(currentBalance)}</p>
              <p className="text-emerald-500 text-xs font-bold bg-emerald-500/10 inline-block px-2.5 py-1 rounded-md tracking-wider">For {currentMonthName}</p>
            </div>

            <div className="space-y-3">
              <button 
                onClick={() => {
                  alert("Payment processed securely via CEB Microservice Gateway!");
                  setShowPaymentModal(false);
                }}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-[#050505] font-black uppercase tracking-wider py-4 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all text-sm group relative overflow-hidden"
              >
                <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
                Confirm Payment
              </button>
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-transparent border-2 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300 font-bold uppercase tracking-wider py-3.5 rounded-xl transition-all text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
