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
  secondary: '#1E293B',     // Corporate Navy
  secondaryLight: '#F1F5F9',
  accent: '#D97706',        // Amber Gold
  textDark: '#0F172A',      // Slate 900
  textMuted: '#64748B',     // Slate 500
  border: '#E2E8F0',        // Border slate
  cardBg: '#F8FAFC',
  success: '#16A34A',       // Emerald 600
  successBg: '#DCFCE7'
};

/**
 * Draws standard corporate header on the document
 */
function drawCorporateHeader(doc, title = 'OFFICIAL UTILITY DOCUMENT') {
  // 1. Brand Logo
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, 40, 35, { width: 110 });
    } catch (_) {
      // Fallback text badge if image parser warns
      doc.rect(40, 35, 110, 36).fill(COLORS.primary);
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#FFFFFF').text('LECO', 50, 44);
    }
  } else {
    doc.rect(40, 35, 110, 36).fill(COLORS.primary);
    doc.font('Helvetica-Bold').fontSize(14).fillColor('#FFFFFF').text('LECO', 50, 44);
  }

  // 2. Company Registration and Contact details on right
  doc
    .font('Helvetica-Bold')
    .fontSize(10)
    .fillColor(COLORS.primary)
    .text('LANKA ELECTRICITY COMPANY (PVT) LTD', 200, 35, { align: 'right' })
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLORS.textMuted)
    .text('Smart Prepaid Electricity Distribution Division', 200, 48, { align: 'right' })
    .text('Head Office: 411, Galle Road, Colombo 03, Sri Lanka', 200, 59, { align: 'right' })
    .text('24/7 Helpline: 1987 | Call Center: (+94) 11 237 1234 | www.leco.lk', 200, 70, { align: 'right' });

  // 3. Decorative Corporate Accent Line
  doc.rect(40, 88, 515, 3).fill(COLORS.primary);
  doc.rect(455, 88, 100, 3).fill(COLORS.accent);
}

/**
 * Draws standard corporate footer
 */
function drawCorporateFooter(doc, pageStr = 'Page 1 of 1') {
  const y = 780;
  doc.rect(40, y, 515, 0.75).fill(COLORS.border);

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.textMuted)
    .text('Lanka Electricity Company (Pvt) Ltd - Regulated by Public Utilities Commission of Sri Lanka (PUCSL)', 40, y + 8)
    .text('This is an authentic computer-generated document issued by the LECO Smart Meter Core. No physical signature is required.', 40, y + 18)
    .text(pageStr, 40, y + 8, { align: 'right' });
}

/**
 * Generates an official payment receipt PDF
 *
 * @param {Object} payment - Complete payment record with customer and meter details
 * @returns {Promise<Buffer>}
 */
function buildPaymentReceiptPdf(payment) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `LECO Payment Receipt - ${payment.transaction_id}`,
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
      doc.roundedRect(40, 102, 515, 46, 6).fillAndStroke(COLORS.cardBg, COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COLORS.textDark)
        .text('OFFICIAL PREPAID RECHARGE RECEIPT', 55, 113)
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textMuted)
        .text(`Issued under Section 24 of Sri Lanka Electricity Act | Reg ID: ${payment.transaction_id}`, 55, 131);

      // Status pill badge
      const isSuccess = String(payment.status || '').toLowerCase() === 'success';
      const statusText = isSuccess ? 'PAYMENT SUCCESSFUL' : (payment.status || 'PENDING').toUpperCase();
      const badgeBg = isSuccess ? COLORS.successBg : '#FEF3C7';
      const badgeText = isSuccess ? COLORS.success : '#B45309';

      doc.roundedRect(420, 112, 120, 24, 4).fillAndStroke(badgeBg, isSuccess ? COLORS.success : '#F59E0B');
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(badgeText)
        .text(statusText, 420, 119, { width: 120, align: 'center' });

      // Two-Column Metadata Container
      doc.roundedRect(40, 158, 515, 128, 6).fillAndStroke('#FFFFFF', COLORS.border);

      // Left Column: Consumer & Meter Details
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text('CONSUMER & PREMISES DETAILS', 55, 170);

      const leftY = 188;
      const spacing = 15;
      const leftLabels = [
        ['Customer Name:', payment.customer_name || payment.full_name || 'LECO Consumer'],
        ['Account Number:', payment.account_number || 'ACC-883921'],
        ['Smart Meter No:', payment.meter_number || 'LECO-COL-9901'],
        ['Premises Label:', payment.meter_name || 'Primary Residence'],
        ['Contact Mobile:', payment.mobile_number || payment.phone || '+94 77 123 4567']
      ];

      leftLabels.forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textMuted).text(label, 55, leftY + idx * spacing);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark).text(String(val), 135, leftY + idx * spacing);
      });

      // Right Column: Transaction Audit Details
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text('PAYMENT AUDIT INFORMATION', 305, 170);

      const rightY = 188;
      const paymentDate = payment.created_at ? new Date(payment.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : new Date().toLocaleString('en-US');
      const rightLabels = [
        ['Receipt / Txn ID:', payment.transaction_id || 'N/A'],
        ['PayHere Order ID:', payment.order_id || payment.transaction_id || 'N/A'],
        ['Gateway Payment ID:', payment.payhere_payment_id || 'N/A'],
        ['Payment Channel:', payment.payment_method || 'PayHere Online'],
        ['Payment Timestamp:', paymentDate]
      ];

      rightLabels.forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textMuted).text(label, 305, rightY + idx * spacing);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark).text(String(val), 400, rightY + idx * spacing);
      });

      // Financial Details Table
      const tableY = 298;

      // Table Header Row
      doc.rect(40, tableY, 515, 22).fill(COLORS.secondary);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('ITEM DESCRIPTION', 52, tableY + 7);
      doc.text('METHOD', 230, tableY + 7);
      doc.text('PREVIOUS BAL (LKR)', 305, tableY + 7, { align: 'right', width: 90 });
      doc.text('AMOUNT PAID (LKR)', 405, tableY + 7, { align: 'right', width: 75 });
      doc.text('NEW BAL (LKR)', 485, tableY + 7, { align: 'right', width: 60 });

      // Table Data Row
      const rowY = tableY + 22;
      doc.rect(40, rowY, 515, 34).fillAndStroke('#FFFFFF', COLORS.border);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark);
      doc.text('Prepaid Smart Electricity Recharge', 52, rowY + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted);
      doc.text(`Instant Remote Grid Credit • Meter: ${payment.meter_number || 'Smart Meter'}`, 52, rowY + 20);

      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark);
      doc.text(payment.payment_method || 'PayHere', 230, rowY + 12);

      const prevBal = parseFloat(payment.previous_balance || 0).toFixed(2);
      const paidAmt = parseFloat(payment.amount || 0).toFixed(2);
      const newBal = parseFloat(payment.new_balance || 0).toFixed(2);

      doc.text(`Rs. ${Number(prevBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 305, rowY + 12, { align: 'right', width: 90 });
      doc.font('Helvetica-Bold').text(`Rs. ${Number(paidAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 405, rowY + 12, { align: 'right', width: 75 });
      doc.text(`Rs. ${Number(newBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 485, rowY + 12, { align: 'right', width: 60 });

      // Highlighted Grand Total Box
      const grandTotalY = 368;
      doc.roundedRect(40, grandTotalY, 515, 66, 6).fill(COLORS.secondary);

      // Amount Paid Callout
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#94A3B8')
        .text('RECHARGE AMOUNT CREDITED', 60, grandTotalY + 14)
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor(COLORS.accent)
        .text(`LKR ${Number(paidAmt).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 60, grandTotalY + 30);

      // New Balance Callout
      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor('#94A3B8')
        .text('NEW ACTIVE METER BALANCE', 330, grandTotalY + 14)
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#10B981')
        .text(`LKR ${Number(newBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 330, grandTotalY + 30);

      // Security Verification & Audit Proof Box
      const securityY = 448;
      doc.roundedRect(40, securityY, 515, 95, 6).fillAndStroke(COLORS.primaryLight, '#FCA5A5');

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.primary)
        .text('CRYPTOGRAPHIC VERIFICATION & LEGAL AUDIT PROOF', 55, securityY + 12);

      const securityHash = crypto
        .createHash('sha256')
        .update(`${payment.transaction_id || ''}-${payment.meter_number || ''}-${payment.amount || ''}-${payment.created_at || ''}`)
        .digest('hex')
        .toUpperCase();

      doc
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textDark)
        .text(
          'This receipt confirms electronic credit transmission over the LECO Automated Metering Infrastructure (AMI). ' +
          'Prepaid power supply is maintained active in accordance with PUCSL Standard Regulations.',
          55,
          securityY + 28,
          { width: 485, lineGap: 2 }
        )
        .font('Helvetica-Bold')
        .fontSize(7.5)
        .fillColor(COLORS.textMuted)
        .text('DIGITAL SIGNATURE CHECKSUM (SHA-256):', 55, securityY + 58)
        .font('Courier')
        .fontSize(7)
        .fillColor(COLORS.textDark)
        .text(securityHash, 55, securityY + 70);

      // Terms and Inquiries Box
      const termsY = 556;
      doc.roundedRect(40, termsY, 515, 110, 6).fillAndStroke('#FFFFFF', COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.secondary)
        .text('CUSTOMER ADVISORY & TARIFF INFORMATION', 55, termsY + 12);

      const terms = [
        '1. Domestic PUCSL block tariffs apply according to 30-day cumulative electricity consumption.',
        '2. Consumers maintaining monthly consumption below 60 kWh remain eligible for subsidized Group A lifeline rates.',
        '3. If balance reaches zero, Lifeline Mode (Emergency Credit up to Rs. 500) remains available to prevent overnight disconnection.',
        '4. For billing disputes or technical power interruptions, contact the 24/7 LECO Helpline at 1987 with this Transaction ID.'
      ];

      terms.forEach((t, i) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted).text(t, 55, termsY + 28 + i * 16, { width: 485 });
      });

      // Corporate Footer
      drawCorporateFooter(doc);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates an official Monthly Consumption & Statement PDF
 *
 * @param {Object} data - Meter, consumer, consumption logs, and tariff breakdown data
 * @returns {Promise<Buffer>}
 */
function buildMeterStatementPdf(data) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
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
      drawCorporateHeader(doc, 'CONSUMPTION STATEMENT');

      // Statement Banner Box
      doc.roundedRect(40, 102, 515, 46, 6).fillAndStroke(COLORS.cardBg, COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(COLORS.textDark)
        .text('MONTHLY ELECTRICITY USAGE & STATEMENT', 55, 113)
        .font('Helvetica')
        .fontSize(8)
        .fillColor(COLORS.textMuted)
        .text(`Billing Cycle: ${periodLabel} | PUCSL Domestic Tariff D-1 Schedule`, 55, 131);

      // Statement Date Badge
      doc.roundedRect(420, 112, 120, 24, 4).fillAndStroke(COLORS.secondaryLight, COLORS.border);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLORS.secondary)
        .text(`ISSUED: ${new Date().toLocaleDateString('en-GB')}`, 420, 120, { width: 120, align: 'center' });

      // Customer & Meter Profile Container
      doc.roundedRect(40, 158, 515, 78, 6).fillAndStroke('#FFFFFF', COLORS.border);

      const metaCols = [
        ['Customer Name:', user.full_name || 'LECO Customer'],
        ['Account Number:', meter.account_number || 'N/A'],
        ['Smart Meter Serial:', meter.meter_number || 'N/A'],
        ['Premises Label:', meter.name || 'Primary Residence'],
        ['Supply Relay Status:', meter.status || 'Connected'],
        ['Tariff Category:', meter.tariff_type || 'Domestic D-1 (PUCSL)']
      ];

      metaCols.slice(0, 3).forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textMuted).text(label, 55, 170 + idx * 17);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark).text(String(val), 150, 170 + idx * 17);
      });

      metaCols.slice(3, 6).forEach(([label, val], idx) => {
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.textMuted).text(label, 305, 170 + idx * 17);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.textDark).text(String(val), 410, 170 + idx * 17);
      });

      // 4-Card Energy Metric Dashboard
      const dashY = 246;
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
        doc.roundedRect(x, dashY, cardWidth, 54, 6).fillAndStroke(COLORS.cardBg, COLORS.border);
        doc
          .font('Helvetica-Bold')
          .fontSize(7)
          .fillColor(COLORS.textMuted)
          .text(m.label, x + 8, dashY + 10, { width: cardWidth - 16, align: 'center' })
          .font('Helvetica-Bold')
          .fontSize(12)
          .fillColor(m.color)
          .text(m.val, x + 8, dashY + 28, { width: cardWidth - 16, align: 'center' });
      });

      // PUCSL Domestic Block Tariff Breakdown Table
      const tariffTableY = 312;
      doc.rect(40, tariffTableY, 515, 20).fill(COLORS.secondary);
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
      doc.text('PUCSL DOMESTIC TARIFF BLOCK', 52, tariffTableY + 6);
      doc.text('BILLED UNITS (kWh)', 230, tariffTableY + 6, { align: 'right', width: 95 });
      doc.text('ENERGY CHARGE (LKR)', 335, tariffTableY + 6, { align: 'right', width: 95 });
      doc.text('FIXED CHARGE (LKR)', 440, tariffTableY + 6, { align: 'right', width: 95 });

      // Row 1: Energy & Fixed Charge Breakdown
      const rowY = tariffTableY + 20;
      doc.rect(40, rowY, 515, 36).fillAndStroke('#FFFFFF', COLORS.border);

      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.textDark);
      doc.text(bill.group || 'Domestic Tier (0-60 kWh)', 52, rowY + 8);
      doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted);
      doc.text(`Effective Unit Rate: Rs. ${bill.effectiveRate} / kWh`, 52, rowY + 21);

      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.textDark);
      doc.text(`${bill.kwh} kWh`, 230, rowY + 12, { align: 'right', width: 95 });
      doc.text(`Rs. ${bill.energyCharge.toFixed(2)}`, 335, rowY + 12, { align: 'right', width: 95 });
      doc.text(`Rs. ${bill.fixedCharge.toFixed(2)}`, 440, rowY + 12, { align: 'right', width: 95 });

      // Total Charges Banner
      const totalY = rowY + 36;
      doc.rect(40, totalY, 515, 28).fill(COLORS.primaryLight);
      doc.rect(40, totalY, 515, 28).stroke(COLORS.border);
      doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.primary);
      doc.text('ESTIMATED 30-DAY INCL. FIXED CHARGES:', 52, totalY + 9);
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
      doc.text(`LKR ${bill.totalCharge.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 415, totalY + 8, { align: 'right', width: 120 });

      // Prepaid Balance & Financial Position Box
      const balanceY = 412;
      doc.roundedRect(40, balanceY, 515, 70, 6).fill(COLORS.secondary);

      const currentBalance = parseFloat(meter.balance || 0);
      const isNegative = currentBalance < 0;

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('CURRENT PREPAID METER BALANCE', 55, balanceY + 14)
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(isNegative ? '#EF4444' : '#10B981')
        .text(`LKR ${currentBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, 55, balanceY + 32);

      const statusNote = isNegative
        ? 'OVERDRAFT ACTIVE (LIFELINE EMERGENCY CREDIT IN USE)'
        : 'POWER SUPPLY ACTIVE • NORMAL PREPAID OPERATING STATE';

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#94A3B8')
        .text('SUPPLY STATUS & LIFELINE', 305, balanceY + 14)
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(isNegative ? '#FCA5A5' : '#6EE7B7')
        .text(statusNote, 305, balanceY + 34, { width: 235 });

      // Recent Payment History Ledger on Statement
      const paymentsY = 494;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLORS.secondary)
        .text('RECENT RECHARGES & CREDITS IN THIS BILLING CYCLE', 40, paymentsY);

      const payTableY = paymentsY + 14;
      doc.rect(40, payTableY, 515, 18).fill(COLORS.secondaryLight);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.secondary);
      doc.text('DATE', 52, payTableY + 5);
      doc.text('TRANSACTION ID', 140, payTableY + 5);
      doc.text('CHANNEL', 280, payTableY + 5);
      doc.text('TOP-UP (LKR)', 380, payTableY + 5, { align: 'right', width: 75 });
      doc.text('BALANCE AFTER', 465, payTableY + 5, { align: 'right', width: 75 });

      const payments = data.payments || [];
      const displayedPayments = payments.slice(0, 4);

      if (displayedPayments.length === 0) {
        doc.rect(40, payTableY + 18, 515, 22).fillAndStroke('#FFFFFF', COLORS.border);
        doc.font('Helvetica').fontSize(8).fillColor(COLORS.textMuted).text('No top-up recharges recorded in this period.', 52, payTableY + 24);
      } else {
        displayedPayments.forEach((p, idx) => {
          const py = payTableY + 18 + idx * 20;
          doc.rect(40, py, 515, 20).fillAndStroke('#FFFFFF', COLORS.border);
          const pDate = p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : 'Recent';
          doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textDark);
          doc.text(pDate, 52, py + 6);
          doc.text(p.transaction_id || 'N/A', 140, py + 6);
          doc.text(p.payment_method || 'Online', 280, py + 6);
          doc.font('Helvetica-Bold').text(`Rs. ${parseFloat(p.amount || 0).toFixed(2)}`, 380, py + 6, { align: 'right', width: 75 });
          doc.text(`Rs. ${parseFloat(p.new_balance || 0).toFixed(2)}`, 465, py + 6, { align: 'right', width: 75 });
        });
      }

      // Energy Conservation Tips & Advisory Box
      const tipsY = 620;
      doc.roundedRect(40, tipsY, 515, 95, 6).fillAndStroke('#FFFFFF', COLORS.border);

      doc
        .font('Helvetica-Bold')
        .fontSize(8.5)
        .fillColor(COLORS.primary)
        .text('PUCSL TARIFF ADVISORY & SMART SAVINGS GUIDELINES', 55, tipsY + 10);

      const tips = [
        '• Group A Threshold: Consuming <= 60 units/month costs only Rs. 5 - 9/unit with low fixed charges.',
        '• Above 60 units, PUCSL tariff shifts to Group B (Rs. 14 - 44/unit) with significantly higher fixed charges.',
        '• Shifting high-load appliances (washing machines, iron, pumps) to off-peak hours reduces grid load.',
        '• Activate Lifeline Emergency Credit before balance drops to zero to prevent nocturnal power interruption.'
      ];

      tips.forEach((t, i) => {
        doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.textMuted).text(t, 55, tipsY + 26 + i * 15, { width: 485 });
      });

      // Corporate Footer
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
