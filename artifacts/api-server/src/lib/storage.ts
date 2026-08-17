import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import { logger } from "./logger";

// Parse Supabase project reference from DATABASE_URL
const dbUrl = process.env.DATABASE_URL || "";
let detectedRef = "";
const match = dbUrl.match(/postgres\.([^:@/]+)/);
if (match) {
  detectedRef = match[1];
}

const SUPABASE_URL = process.env.SUPABASE_URL || (detectedRef ? `https://${detectedRef}.supabase.co` : "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "";
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "documents";

const LOCAL_STORAGE_DIR = path.resolve(process.cwd(), "uploads");

let bucketChecked = false;

export const isSupabaseEnabled = () => {
  return !!(SUPABASE_URL && SUPABASE_KEY);
};

export async function ensureBucketExists() {
  if (bucketChecked || !isSupabaseEnabled()) return;
  try {
    logger.info(`Checking/creating Supabase Storage bucket: ${SUPABASE_BUCKET}`);
    const res = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "apikey": SUPABASE_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: SUPABASE_BUCKET,
        name: SUPABASE_BUCKET,
        public: false,
      }),
    });
    bucketChecked = true;
    if (res.ok) {
      logger.info(`Created Supabase Storage bucket: ${SUPABASE_BUCKET}`);
    } else {
      const errText = await res.text();
      logger.info(`Supabase bucket check status: ${res.status}. Msg: ${errText}`);
    }
  } catch (err) {
    logger.error(err as any, "Error ensuring Supabase Storage bucket exists:");
  }
}

const ensureLocalDir = (key: string) => {
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return filePath;
};

/**
 * Uploads a file buffer to Supabase Storage (if configured) or Local Storage.
 */
export async function uploadFile(key: string, buffer: Buffer, mimeType: string): Promise<{ provider: string; key: string }> {
  if (isSupabaseEnabled()) {
    await ensureBucketExists();
    try {
      logger.info(`Uploading file ${key} to Supabase Storage...`);
      const url = `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY,
          "Content-Type": mimeType,
        },
        body: buffer,
      });

      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 400 || errText.includes("Duplicate") || errText.includes("already exists")) {
          logger.info(`File ${key} already exists on Supabase, overwriting with PUT...`);
          const putRes = await fetch(url, {
            method: "PUT",
            headers: {
              "Authorization": `Bearer ${SUPABASE_KEY}`,
              "apikey": SUPABASE_KEY,
              "Content-Type": mimeType,
            },
            body: buffer,
          });
          if (!putRes.ok) {
            throw new Error(`Failed to overwrite in Supabase Storage: ${await putRes.text()}`);
          }
        } else {
          throw new Error(`Failed to upload to Supabase Storage: ${errText}`);
        }
      }
      
      logger.info(`Successfully uploaded ${key} to Supabase Storage.`);
      return { provider: "supabase", key };
    } catch (err) {
      logger.error(err as any, "Supabase upload failed, falling back to local storage:");
    }
  }

  // Local Storage Fallback
  logger.info(`Saving file ${key} locally...`);
  const filePath = ensureLocalDir(key);
  await fs.promises.writeFile(filePath, buffer);
  logger.info(`Successfully saved ${key} locally at ${filePath}`);
  return { provider: "local", key };
}

/**
 * Downloads a file from Supabase Storage or Local Storage.
 */
export async function downloadFile(key: string, provider: string): Promise<Buffer> {
  if (provider === "supabase" && isSupabaseEnabled()) {
    try {
      logger.info(`Downloading file ${key} from Supabase Storage...`);
      const url = `${SUPABASE_URL}/storage/v1/object/authenticated/${SUPABASE_BUCKET}/${key}`;
      const res = await fetch(url, {
        headers: {
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY,
        },
      });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        return Buffer.from(arrayBuffer);
      }
      logger.error(`Failed to download ${key} from Supabase: ${await res.text()}`);
    } catch (err) {
      logger.error(err as any, `Error fetching ${key} from Supabase storage:`);
    }
  }

  // Local storage
  logger.info(`Reading file ${key} from local storage...`);
  const filePath = path.join(LOCAL_STORAGE_DIR, key);
  if (fs.existsSync(filePath)) {
    return await fs.promises.readFile(filePath);
  }

  throw new Error(`File ${key} not found in local storage.`);
}

/**
 * Generates a beautiful PDF for a payslip.
 */
export function generatePayslipPdf(payroll: any, emp: any, branch: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      logger.info(`Generating PDF for payroll month ${payroll.month}, employee ${emp.firstName} ${emp.lastName}`);
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      // Header
      doc.fillColor("#b91c1c").font("Helvetica-Bold").fontSize(20).text("RED FOX HOTEL", { align: "center" });
      doc.fillColor("#4b5563").font("Helvetica").fontSize(10).text(branch?.address ?? "Corporate Office", { align: "center" });
      doc.moveDown(1);
      doc.fillColor("#1f2937").font("Helvetica-Bold").fontSize(14).text(`PAYSLIP FOR ${payroll.month}`, { align: "center", underline: true });
      doc.moveDown(1.5);

      // Employee details
      doc.fontSize(10).fillColor("#1f2937").font("Helvetica");
      const leftColX = 50;
      const rightColX = 300;
      let y = doc.y;

      doc.text(`Employee Code: ${emp.employeeId}`, leftColX, y);
      doc.text(`Department: ${emp.department}`, leftColX, y + 15);
      doc.text(`Designation: ${emp.designation}`, leftColX, y + 30);
      doc.text(`Joining Date: ${emp.joiningDate}`, leftColX, y + 45);

      doc.text(`Employee Name: ${emp.firstName} ${emp.lastName}`, rightColX, y);
      doc.text(`Phone: ${emp.phone}`, rightColX, y + 15);
      doc.text(`Email: ${emp.email}`, rightColX, y + 30);
      doc.text(`Branch: ${branch?.name ?? "N/A"}`, rightColX, y + 45);

      doc.moveDown(4.5);

      // Table headers
      y = doc.y;
      doc.rect(50, y, 500, 20).fill("#f3f4f6");
      doc.fillColor("#1f2937").font("Helvetica-Bold").text("Earnings", 60, y + 5);
      doc.text("Amount", 240, y + 5);
      doc.text("Deductions", 310, y + 5);
      doc.text("Amount", 490, y + 5);

      doc.font("Helvetica").fontSize(9);
      y += 25;

      const basicSalary = Number(emp.salary);
      const otAmt = Number(payroll.overtimeAmount || 0);
      const cdAmt = Number(payroll.continueDutyAmount || 0);
      const allow = Number(payroll.allowances || 0);
      const bonus = Number(payroll.bonus || 0);

      const absentDeduct = Number(payroll.absentDeduction || 0);
      const lateDeduct = Number(payroll.lateDeduction || 0);
      const advDeduct = Number(payroll.advanceDeduction || 0);

      const earnings = [
        { name: "Basic Salary", amount: basicSalary },
        { name: "Overtime Amount", amount: otAmt },
        { name: "Continue Duty Amount", amount: cdAmt },
        { name: "Allowances", amount: allow },
        { name: "Bonus", amount: bonus }
      ];

      const deductions = [
        { name: "Absent Deduction", amount: absentDeduct },
        { name: "Late Deduction", amount: lateDeduct },
        { name: "Advance Deduction", amount: advDeduct }
      ];

      const rowsCount = Math.max(earnings.length, deductions.length);
      for (let i = 0; i < rowsCount; i++) {
        const earn = earnings[i];
        const deduct = deductions[i];
        if (earn && earn.amount > 0) {
          doc.text(earn.name, 60, y);
          doc.text(`Rs. ${earn.amount.toFixed(2)}`, 240, y);
        } else if (earn && earn.name === "Basic Salary") {
          doc.text(earn.name, 60, y);
          doc.text(`Rs. ${earn.amount.toFixed(2)}`, 240, y);
        }
        if (deduct && deduct.amount > 0) {
          doc.text(deduct.name, 310, y);
          doc.text(`Rs. ${deduct.amount.toFixed(2)}`, 490, y);
        }
        y += 15;
      }

      // Border and Totals
      doc.rect(50, y, 500, 1).fill("#e5e7eb");
      y += 10;
      doc.font("Helvetica-Bold");
      doc.text("Gross Salary:", 60, y);
      doc.text(`Rs. ${Number(payroll.grossSalary || 0).toFixed(2)}`, 240, y);
      doc.text("Total Deductions:", 310, y);
      doc.text(`Rs. ${Number(payroll.totalDeductions || 0).toFixed(2)}`, 490, y);

      y += 20;
      doc.rect(50, y, 500, 25).fill("#eff6ff");
      doc.fillColor("#1e3a8a").fontSize(11).text("Net Pay:", 60, y + 7);
      doc.text(`Rs. ${Number(payroll.netSalary || 0).toFixed(2)}`, 240, y + 7);

      // Signatures
      y += 60;
      doc.fillColor("#4b5563").font("Helvetica").fontSize(9);
      doc.text("Employee Signature", 100, y, { align: "left" });
      doc.text("Authorized Signatory", 400, y, { align: "left" });

      doc.end();
    } catch (error) {
      logger.error(error as any, "Error generating payslip PDF:");
      reject(error);
    }
  });
}
