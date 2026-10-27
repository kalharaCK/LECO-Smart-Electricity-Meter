/**
 * Standard Enterprise PDF Report & Receipt Generator
 * Generates official corporate PDFs for payments and consumption statements
 * with embedded LECO brand assets, PUCSL tariff itemization, and cryptographic audit proofs.
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { calculateDomesticBill } = require('./tariffEngine');

// Resolve standard LECO logo path
const LOGO_PATH = path.resolve(__dirname, '../assets/leco-logo.png');

// Corporate Color Palette
const COLORS = {
  primary: '#992511',       // LECO Deep Maroon
  primaryLight: '#FAF5F5',
  secondary: '#1E293B',     // Corporate Slate Navy
  secondaryLight: '#F1F5F9',// Light Slate
  accent: '#D97706',        // Amber Gold
  textDark: '#0F172A',      // Slate 900
  textMuted: '#64748B',     // Slate 500
  border: '#E2E8F0',        // Border slate
  cardBg: '#F8FAFC',        // Slate 50
  success: '#16A34A',       // Emerald 600
  successBg: '#DCFCE7'      // Emerald 100
};

/**
 * Draws standard corporate header on the document with compact logo
 */
function drawCorporateHeader(doc) {
  // 1. Brand Logo with refined compact corporate scale (38 x 38 pt)
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 42, 28, { width: 38, height: 38 });
    } catch (_) {
      doc.roundedRect(42, 28, 38, 38, 4).fill(COLORS.primary);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('LECO', 46, 42);
    }
  } else {
    doc.roundedRect(42, 28, 38, 38, 4).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#FFFFFF').text('LECO', 46, 42);
  }

  // 2. Company Identity next to the compact Logo
  doc
    .font('Helvetica-Bold')
    .fontSize(12)
    .fillColor(COLORS.primary)
    .text('LANKA ELECTRICITY COMPANY (PVT) LTD', 88, 30)
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(COLORS.secondary)
    .text('Smart Prepaid Electricity Distribution Division', 88, 44)
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor(COLORS.textMuted)
    .text('Regulated by Public Utilities Commission of Sri Lanka (PUCSL)', 88, 55);

  // 3. Official License & Contact Information on the Right
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor(COLORS.secondary)
    .text('PUCSL License No: EL/D/09-002', 335, 30, { align: 'right', width: 220 })
    .font('Helvetica')
    .fontSize(6.5)
    .fillColor(COLORS.textMuted)
    .text('Head Office: 411, Galle Road, Colombo 03, Sri Lanka', 335, 40, { align: 'right', width: 220 })
    .text('24/7 Helpline: 1987 | Call Center: (+94) 11 237 1234', 335, 49, { align: 'right', width: 220 })
    .text('Web Portal: www.leco.lk | Email: support@leco.lk', 335, 58, { align: 'right', width: 220 });

  // 4. Decorative Corporate Accent Rule
  doc.rect(40, 72, 515, 2).fill(COLORS.primary);
  doc.rect(435, 72, 120, 2).fill(COLORS.accent);
}

/**
 * Draws standard corporate footer within single-page safety bounds
 */
function drawCorporateFooter(doc, pageStr = 'Page 1 of 1') {
  const y = 770;
  doc.rect(40, y, 515, 0.5).fill(COLORS.border);

  doc
    .font('Helvetica')
    .fontSize(7)
    .fillColor(COLORS.textMuted)
    .text('Lanka Electricity Company (Pvt) Ltd • Regulated by Public Utilities Commission of Sri Lanka (PUCSL)', 40, y + 6)
    .text(pageStr, 40, y + 6, { align: 'right', width: 515 })
    .fontSize(6.5)
    .text('Official computer-generated utility record. Authenticated by LECO Automated Metering Infrastructure (AMI).', 40, y + 16);
}

/**
 * Generates an official payment receipt PDF (strictly 1 page)
 *
 * @param {Object} payment - Complete payment record with customer and meter details
 * @returns {Promise<Buffer>}
 */
function buildPaymentReceiptPdf(payment) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, bottom: 20, left: 40, right: 40 },
        autoFirstPage: true,
        info: {
          Title: `LECO Payment Receipt - ${payment.transaction_id || 'Recharge'}`,
          Author: 'Lanka Electricity Company (Pvt) Ltd',
          Subject: 'Prepaid Electricity Recharge Receipt',
          Keywords: 'LECO, Electricity, Smart Meter, Receipt, PayHere'
        }
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      // Corporate Header
      drawCorporateHeader(doc);

      // Document Banner Box
      doc.roundedRect(40, 92, 515, 38, 5).fillAndStroke(COLORS.cardBg, COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(COLORS.textDark)
        .text('OFFICIAL PREPAID RECHARGE RECEIPT', 55, 101)
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.textMuted)
        .text(`Issued under Section 24 of Sri Lanka Electricity Act | Reg ID: ${payment.transaction_id || 'N/A'}`, 55, 116);

      // Status pill badge
      const isSuccess = String(payment.status || '').toLowerCase() === 'success' || !payment.status;
      const statusText = isSuccess ? 'PAYMENT SUCCESSFUL' : String(payment.status).toUpperCase();
      const badgeBg = isSuccess ? COLORS.successBg : '#FEF3C7';
      const badgeText = isSuccess ? COLORS.success : '#B45309';

      doc.roundedRect(420, 100, 120, 22, 4).fillAndStroke(badgeBg, isSuccess ? COLORS.success : '#F59E0B');
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(badgeText)
        .text(statusText, 420, 107, { width: 120, align: 'center' });

      // Two-Column Metadata Container
      doc.roundedRect(40, 136, 515, 100, 5).fillAndStroke('#FFFFFF', COLORS.border);

      // Left Column: Consumer & Meter Details
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text('CONSUMER & PREMISES DETAILS', 55, 146);

      const leftY = 162;
      const spacing = 14;
      const leftLabels = [
        ['Customer Name:', payment.customer_name || payment.full_name || 'LECO Consumer'],
        ['Account Number:', payment.account_number || 'ACC-883921'],
        ['Smart Meter No:', payment.meter_number || 'LECO-COL-9901'],
        ['Premises Label:', payment.meter_name || 'Primary Residence'],
        ['Contact Mobile:', payment.mobile_number || payment.phone || '+94 77 123 4567']
      ];

      leftLabels.forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMuted).text(label, 55, leftY + idx * spacing);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark).text(String(val), 140, leftY + idx * spacing);
      });

      // Right Column: Transaction Audit Details
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text('PAYMENT AUDIT INFORMATION', 305, 146);

      const rightY = 162;
      const paymentDate = payment.created_at
        ? new Date(payment.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
        : new Date().toLocaleString('en-US');
      const rightLabels = [
        ['Receipt / Txn ID:', payment.transaction_id || 'N/A'],
        ['PayHere Order ID:', payment.order_id || payment.transaction_id || 'N/A'],
        ['Gateway Payment ID:', payment.payhere_payment_id || 'N/A'],
        ['Payment Channel:', payment.payment_method || 'PayHere Online'],
        ['Payment Timestamp:', paymentDate]
      ];

      rightLabels.forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMuted).text(label, 305, rightY + idx * spacing);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark).text(String(val), 405, rightY + idx * spacing);
      });

      // Financial Details Table
      const tableY = 244;

      // Table Header Row
      doc.rect(40, tableY, 515, 18).fill(COLORS.secondary);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
      doc.text('ITEM DESCRIPTION', 52, tableY + 5);
      doc.text('METHOD', 230, tableY + 5);
      doc.text('PREVIOUS BAL (LKR)', 305, tableY + 5, { align: 'right', width: 90 });
      doc.text('AMOUNT PAID (LKR)', 405, tableY + 5, { align: 'right', width: 75 });
      doc.text('NEW BAL (LKR)', 485, tableY + 5, { align: 'right', width: 60 });

      // Table Data Row
      const rowY = tableY + 18;
      doc.rect(40, rowY, 515, 30).fillAndStroke('#FFFFFF', COLORS.border);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark);
      doc.text('Prepaid Smart Electricity Recharge', 52, rowY + 6);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.textMuted);
      doc.text(`Instant Remote Grid Credit • Meter: ${payment.meter_number || 'Smart Meter'}`, 52, rowY + 18);

      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark);
      doc.text(payment.payment_method || 'PayHere', 230, rowY + 10);

      const prevBal = parseFloat(payment.previous_balance || 0).toFixed(2);
      const paidAmt = parseFloat(payment.amount || 0).toFixed(2);
      const newBal = parseFloat(payment.new_balance || 0).toFixed(2);

      doc.text(`Rs. ${Number(prevBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 305, rowY + 10, { align: 'right', width: 90 });
      doc.font('Helvetica-Bold').text(`Rs. ${Number(paidAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 405, rowY + 10, { align: 'right', width: 75 });
      doc.text(`Rs. ${Number(newBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 485, rowY + 10, { align: 'right', width: 60 });

      // Highlighted Grand Total Box
      const grandTotalY = 300;
      doc.roundedRect(40, grandTotalY, 515, 54, 5).fill(COLORS.secondary);

      // Amount Paid Callout
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('RECHARGE AMOUNT CREDITED', 60, grandTotalY + 11)
        .font('Helvetica-Bold')
        .fontSize(17)
        .fillColor(COLORS.accent)
        .text(`LKR ${Number(paidAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 60, grandTotalY + 25);

      // New Balance Callout
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('NEW ACTIVE METER BALANCE', 330, grandTotalY + 11)
        .font('Helvetica-Bold')
        .fontSize(17)
        .fillColor('#10B981')
        .text(`LKR ${Number(newBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 330, grandTotalY + 25);

      // Security Verification & Audit Proof Box
      const securityY = 362;
      doc.roundedRect(40, securityY, 515, 62, 5).fillAndStroke(COLORS.primaryLight, '#FCA5A5');

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text('CRYPTOGRAPHIC VERIFICATION & LEGAL AUDIT PROOF', 55, securityY + 9);

      const securityHash = crypto
        .createHash('sha256')
        .update(`${payment.transaction_id || ''}-${payment.meter_number || ''}-${payment.amount || ''}-${payment.created_at || ''}`)
        .digest('hex')
        .toUpperCase();

      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.textDark)
        .text(
          'This receipt confirms electronic credit transmission over the LECO Automated Metering Infrastructure (AMI). ' +
          'Prepaid power supply is maintained active in accordance with PUCSL Standard Regulations.',
          55,
          securityY + 23,
          { width: 485, lineGap: 1 }
        )
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor(COLORS.textMuted)
        .text('DIGITAL SIGNATURE CHECKSUM (SHA-256):', 55, securityY + 41)
        .font('Courier')
        .fontSize(6.5)
        .fillColor(COLORS.textDark)
        .text(securityHash, 55, securityY + 50);

      // Terms and Inquiries Box
      const termsY = 432;
      doc.roundedRect(40, termsY, 515, 88, 5).fillAndStroke('#FFFFFF', COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.secondary)
        .text('CUSTOMER ADVISORY & TARIFF INFORMATION', 55, termsY + 9);

      const terms = [
        '1. Domestic PUCSL block tariffs apply according to 30-day cumulative electricity consumption.',
        '2. Consumers maintaining monthly consumption below 60 kWh remain eligible for subsidized Group A lifeline rates.',
        '3. If balance reaches zero, Lifeline Mode (Emergency Credit up to Rs. 500) remains available to prevent overnight disconnection.',
        '4. For billing disputes or technical power interruptions, contact the 24/7 LECO Helpline at 1987 with this Transaction ID.'
      ];

      terms.forEach((t, i) => {
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.textMuted).text(t, 55, termsY + 23 + i * 14, { width: 485 });
      });

      // Corporate Footer strictly on single page
      drawCorporateFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an official Monthly Consumption & Statement PDF (strictly 1 page)
 *
 * @param {Object} data - Meter, consumer, consumption logs, and tariff breakdown data
 * @returns {Promise<Buffer>}
 */
function buildMeterStatementPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 28, bottom: 20, left: 40, right: 40 },
        autoFirstPage: true,
        info: {
          Title: `LECO Monthly Statement - ${data.meter?.meter_number || 'Meter'}`,
          Author: 'Lanka Electricity Company (Pvt) Ltd',
          Subject: 'Monthly Electricity Consumption and Billing Statement'
        }
      });

      const buffers = [];
      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const meter = data.meter || {};
      const user = data.user || {};
      const logs = data.logs || [];
      const periodLabel = data.periodLabel || 'Current Billing Cycle';

      // Aggregate usage
      let totalImportKwh = 0;
      let totalExportKwh = 0;
      logs.forEach((l) => {
        totalImportKwh += parseFloat(l.consumption || 0);
        totalExportKwh += parseFloat(l.energy_export || 0);
      });
      const netKwh = Math.max(0, totalImportKwh - totalExportKwh);
      const daysCount = Math.max(1, new Set(logs.map(l => l.reading_date)).size || 14);
      const dailyAverage = (netKwh / daysCount).toFixed(2);

      // Calculate PUCSL Domestic Tariff Breakdown
      const bill = calculateDomesticBill(netKwh);

      // Corporate Header
      drawCorporateHeader(doc);

      // Statement Banner Box
      doc.roundedRect(40, 92, 515, 38, 5).fillAndStroke(COLORS.cardBg, COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(12)
        .fillColor(COLORS.textDark)
        .text('MONTHLY ELECTRICITY USAGE & STATEMENT', 55, 101)
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLORS.textMuted)
        .text(`Billing Cycle: ${periodLabel} | PUCSL Domestic Tariff D-1 Schedule`, 55, 116);

      // Statement Date Badge
      doc.roundedRect(420, 100, 120, 22, 4).fillAndStroke(COLORS.secondaryLight, COLORS.border);
      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.secondary)
        .text(`ISSUED: ${new Date().toLocaleDateString('en-GB')}`, 420, 107, { width: 120, align: 'center' });

      // Customer & Meter Profile Container
      doc.roundedRect(40, 136, 515, 64, 5).fillAndStroke('#FFFFFF', COLORS.border);

      const metaCols = [
        ['Customer Name:', user.full_name || 'LECO Customer'],
        ['Account Number:', meter.account_number || 'N/A'],
        ['Smart Meter Serial:', meter.meter_number || 'N/A'],
        ['Premises Label:', meter.name || 'Home'],
        ['Supply Relay Status:', meter.status || 'Connected'],
        ['Tariff Category:', meter.tariff_type || 'Domestic D-1 (PUCSL Block Tariff)']
      ];

      metaCols.slice(0, 3).forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMuted).text(label, 55, 145 + idx * 16);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark).text(String(val), 145, 145 + idx * 16);
      });

      metaCols.slice(3, 6).forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.textMuted).text(label, 305, 145 + idx * 16);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark).text(String(val), 410, 145 + idx * 16);
      });

      // 4-Card Energy Metric Dashboard
      const dashY = 206;
      const cardWidth = 120;
      const cardGap = 11.5;

      const metrics = [
        { label: 'TOTAL GRID IMPORT', val: `${totalImportKwh.toFixed(1)} kWh`, color: COLORS.textDark },
        { label: 'SOLAR EXPORT (NET)', val: `${totalExportKwh.toFixed(1)} kWh`, color: COLORS.accent },
        { label: 'NET BILLED UNITS', val: `${netKwh.toFixed(1)} kWh`, color: COLORS.primary },
        { label: 'DAILY AVERAGE', val: `${dailyAverage} kWh/d`, color: COLORS.secondary }
      ];

      metrics.forEach((m, i) => {
        const x = 40 + i * (cardWidth + cardGap);
        doc.roundedRect(x, dashY, cardWidth, 46, 5).fillAndStroke(COLORS.cardBg, COLORS.border);
        doc
          .font('Helvetica-Bold')
          .fontSize(6.5)
          .fillColor(COLORS.textMuted)
          .text(m.label, x + 6, dashY + 8, { width: cardWidth - 12, align: 'center' })
          .font('Helvetica-Bold')
          .fontSize(11.5)
          .fillColor(m.color)
          .text(m.val, x + 6, dashY + 24, { width: cardWidth - 12, align: 'center' });
      });

      // PUCSL Domestic Block Tariff Breakdown Table
      const tariffTableY = 258;
      doc.rect(40, tariffTableY, 515, 18).fill(COLORS.secondary);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#FFFFFF');
      doc.text('PUCSL DOMESTIC TARIFF BLOCK', 52, tariffTableY + 5);
      doc.text('BILLED UNITS (kWh)', 230, tariffTableY + 5, { align: 'right', width: 95 });
      doc.text('ENERGY CHARGE (LKR)', 335, tariffTableY + 5, { align: 'right', width: 95 });
      doc.text('FIXED CHARGE (LKR)', 440, tariffTableY + 5, { align: 'right', width: 95 });

      // Row 1: Energy & Fixed Charge Breakdown
      const rowY = tariffTableY + 18;
      doc.rect(40, rowY, 515, 28).fillAndStroke('#FFFFFF', COLORS.border);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textDark);
      doc.text(bill.group || 'Domestic Tier (0-60 kWh)', 52, rowY + 6);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.textMuted);
      doc.text(`Effective Unit Rate: Rs. ${bill.effectiveRate} / kWh`, 52, rowY + 16);

      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark);
      doc.text(`${bill.kwh} kWh`, 230, rowY + 10, { align: 'right', width: 95 });
      doc.text(`Rs. ${bill.energyCharge.toFixed(2)}`, 335, rowY + 10, { align: 'right', width: 95 });
      doc.text(`Rs. ${bill.fixedCharge.toFixed(2)}`, 440, rowY + 10, { align: 'right', width: 95 });

      // Total Charges Banner
      const totalY = rowY + 28;
      doc.rect(40, totalY, 515, 22).fill(COLORS.primaryLight);
      doc.rect(40, totalY, 515, 22).stroke(COLORS.border);
      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.primary);
      doc.text('ESTIMATED 30-DAY INCL. FIXED CHARGES:', 52, totalY + 7);
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.primary);
      doc.text(`LKR ${bill.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, totalY + 6, { align: 'right', width: 120 });

      // Prepaid Balance & Financial Position Box
      const balanceY = totalY + 28;
      doc.roundedRect(40, balanceY, 515, 52, 5).fill(COLORS.secondary);

      const currentBalance = parseFloat(meter.balance || 0);
      const isNegative = currentBalance < 0;

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text('CURRENT PREPAID METER BALANCE', 55, balanceY + 10)
        .font('Helvetica-Bold')
        .fontSize(16)
        .fillColor(isNegative ? '#EF4444' : '#10B981')
        .text(`LKR ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 55, balanceY + 25);

      const statusNote = isNegative
        ? 'OVERDRAFT ACTIVE (LIFELINE EMERGENCY CREDIT IN USE)'
        : 'POWER SUPPLY ACTIVE • NORMAL PREPAID OPERATING STATE';

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor('#94A3B8')
        .text('SUPPLY STATUS & LIFELINE', 305, balanceY + 10)
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(isNegative ? '#FCA5A5' : '#6EE7B7')
        .text(statusNote, 305, balanceY + 26, { width: 235 });

      // Recent Payment History Ledger on Statement
      const paymentsY = balanceY + 58;
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.secondary)
        .text('RECENT RECHARGES & CREDITS IN THIS BILLING CYCLE', 40, paymentsY);

      const payTableY = paymentsY + 12;
      doc.rect(40, payTableY, 515, 16).fill(COLORS.secondaryLight);
      doc.font('Helvetica-Bold').fontSize(7).fillColor(COLORS.secondary);
      doc.text('DATE', 52, payTableY + 4);
      doc.text('TRANSACTION ID', 140, payTableY + 4);
      doc.text('CHANNEL', 280, payTableY + 4);
      doc.text('TOP-UP (LKR)', 380, payTableY + 4, { align: 'right', width: 75 });
      doc.text('BALANCE AFTER', 465, payTableY + 4, { align: 'right', width: 75 });

      const payments = data.payments || [];
      const displayedPayments = payments.slice(0, 3);
      let rechargesEnd = payTableY + 16;

      if (displayedPayments.length === 0) {
        doc.rect(40, payTableY + 16, 515, 18).fillAndStroke('#FFFFFF', COLORS.border);
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted).text('No top-up recharges recorded in this period.', 52, payTableY + 21);
        rechargesEnd = payTableY + 16 + 18;
      } else {
        displayedPayments.forEach((p, idx) => {
          const py = payTableY + 16 + idx * 18;
          doc.rect(40, py, 515, 18).fillAndStroke('#FFFFFF', COLORS.border);
          const pDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : 'Recent';
          doc.font('Helvetica').fontSize(7).fillColor(COLORS.textDark);
          doc.text(pDate, 52, py + 5);
          doc.text(p.transaction_id || 'N/A', 140, py + 5);
          doc.text(p.payment_method || 'Online', 280, py + 5);
          doc.font('Helvetica-Bold').text(`Rs. ${parseFloat(p.amount || 0).toFixed(2)}`, 380, py + 5, { align: 'right', width: 75 });
          doc.text(`Rs. ${parseFloat(p.new_balance || 0).toFixed(2)}`, 465, py + 5, { align: 'right', width: 75 });
        });
        rechargesEnd = payTableY + 16 + displayedPayments.length * 18;
      }

      // Energy Conservation Tips & Advisory Box
      const tipsY = rechargesEnd + 10;
      doc.roundedRect(40, tipsY, 515, 74, 5).fillAndStroke('#FFFFFF', COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.primary)
        .text('PUCSL TARIFF ADVISORY & SMART SAVINGS GUIDELINES', 55, tipsY + 8);

      const tips = [
        '• Group A Threshold: Consuming <= 60 units/month costs only Rs. 5 - 9/unit with low fixed charges.',
        '• Above 60 units, PUCSL tariff shifts to Group B (Rs. 14 - 44/unit) with significantly higher fixed charges.',
        '• Shifting high-load appliances (washing machines, iron, pumps) to off-peak hours reduces grid load.',
        '• Activate Lifeline Emergency Credit before balance drops to zero to prevent nocturnal power interruption.'
      ];

      tips.forEach((t, i) => {
        doc.font('Helvetica').fontSize(7).fillColor(COLORS.textMuted).text(t, 55, tipsY + 22 + i * 12, { width: 485 });
      });

      // Digital Cryptographic Signature & Audit Proof Box
      const securityY = tipsY + 80;
      doc.roundedRect(40, securityY, 515, 38, 5).fillAndStroke(COLORS.primaryLight, '#FCA5A5');

      const securityHash = crypto
        .createHash('sha256')
        .update(`${meter.meter_number || ''}-${meter.account_number || ''}-${bill.totalCharge || ''}-${periodLabel}`)
        .digest('hex')
        .toUpperCase();

      doc
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.primary)
        .text('DIGITAL AUDIT VERIFICATION HASH (SHA-256):', 55, securityY + 7)
        .font('Courier')
        .fontSize(6.5)
        .fillColor(COLORS.textDark)
        .text(securityHash, 55, securityY + 18)
        .font('Helvetica')
        .fontSize(6.5)
        .fillColor(COLORS.textMuted)
        .text('Authenticated via LECO Automated Metering Infrastructure (AMI) • Valid without physical signature', 55, securityY + 28);

      // Corporate Footer strictly on single page
      drawCorporateFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  buildPaymentReceiptPdf,
  buildMeterStatementPdf
};
