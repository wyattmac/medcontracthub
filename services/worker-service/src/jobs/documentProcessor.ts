import { Job } from 'bullmq';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import { z } from 'zod';
import { config } from '../config';
import { logger } from '../utils/logger';
import { recordJobMetrics } from '../utils/metrics';
import PQueue from 'p-queue';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';

// Document job schemas
export const DocumentJobSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('generate-report'),
    data: z.object({
      userId: z.string(),
      reportType: z.enum(['opportunities', 'proposals', 'compliance', 'analytics']),
      format: z.enum(['pdf', 'excel', 'csv']),
      filters: z.record(z.any()).optional(),
      dateRange: z.object({
        start: z.string(),
        end: z.string(),
      }).optional(),
    }),
  }),
  z.object({
    type: z.literal('export-data'),
    data: z.object({
      userId: z.string(),
      dataType: z.enum(['opportunities', 'proposals', 'companies', 'compliance']),
      format: z.enum(['json', 'csv', 'excel']),
      query: z.record(z.any()).optional(),
    }),
  }),
  z.object({
    type: z.literal('process-attachment'),
    data: z.object({
      documentId: z.string(),
      opportunityId: z.string(),
      userId: z.string(),
      fileUrl: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
    }),
  }),
  z.object({
    type: z.literal('generate-compliance-matrix'),
    data: z.object({
      opportunityId: z.string(),
      userId: z.string(),
      requirements: z.array(z.string()),
      format: z.enum(['excel', 'pdf']),
    }),
  }),
]);

export type DocumentJob = z.infer<typeof DocumentJobSchema>;

// Initialize Supabase client
const supabase = createClient(
  config.database.supabaseUrl,
  config.database.supabaseServiceKey
);

// Queue for concurrent operations
const queue = new PQueue({ concurrency: 3 });

export async function processDocumentJob(job: Job): Promise<void> {
  const startTime = Date.now();
  let status: 'success' | 'failure' = 'success';
  
  try {
    const documentJob = DocumentJobSchema.parse(job.data);
    logger.info({ 
      jobId: job.id, 
      type: documentJob.type,
      userId: documentJob.data.userId,
    }, 'Processing document job');

    // Update job progress
    await job.updateProgress(10);

    // Process based on document type
    let result: any;
    switch (documentJob.type) {
      case 'generate-report':
        result = await generateReport(documentJob.data, job);
        break;
      case 'export-data':
        result = await exportData(documentJob.data, job);
        break;
      case 'process-attachment':
        result = await processAttachment(documentJob.data, job);
        break;
      case 'generate-compliance-matrix':
        result = await generateComplianceMatrix(documentJob.data, job);
        break;
    }

    // Store result reference
    if (result?.fileUrl) {
      await storeDocumentRecord(documentJob.data.userId, documentJob.type, result);
    }

    await job.updateProgress(100);
    logger.info({ jobId: job.id, result }, 'Document job completed');

  } catch (error) {
    status = 'failure';
    logger.error({ 
      error, 
      jobId: job.id,
      jobData: job.data,
    }, 'Document job failed');
    throw error;
  } finally {
    const duration = (Date.now() - startTime) / 1000;
    recordJobMetrics('document', job.name, duration, status);
  }
}

async function generateReport(data: any, job: Job): Promise<any> {
  const { userId, reportType, format, filters, dateRange } = data;

  // Fetch data based on report type
  await job.updateProgress(20);
  const reportData = await fetchReportData(reportType, userId, filters, dateRange);
  
  await job.updateProgress(50);
  
  // Generate report in requested format
  let fileUrl: string;
  let fileName: string;
  
  switch (format) {
    case 'pdf':
      ({ fileUrl, fileName } = await generatePDFReport(reportType, reportData));
      break;
    case 'excel':
      ({ fileUrl, fileName } = await generateExcelReport(reportType, reportData));
      break;
    case 'csv':
      ({ fileUrl, fileName } = await generateCSVReport(reportType, reportData));
      break;
  }

  await job.updateProgress(90);

  return { fileUrl, fileName, recordCount: reportData.length };
}

async function exportData(data: any, job: Job): Promise<any> {
  const { userId, dataType, format, query } = data;

  // Fetch data
  await job.updateProgress(30);
  const exportData = await fetchExportData(dataType, userId, query);
  
  await job.updateProgress(60);

  // Export in requested format
  let fileUrl: string;
  let fileName: string;

  switch (format) {
    case 'json':
      ({ fileUrl, fileName } = await exportJSON(dataType, exportData));
      break;
    case 'csv':
      ({ fileUrl, fileName } = await exportCSV(dataType, exportData));
      break;
    case 'excel':
      ({ fileUrl, fileName } = await exportExcel(dataType, exportData));
      break;
  }

  await job.updateProgress(90);

  return { fileUrl, fileName, recordCount: exportData.length };
}

async function processAttachment(data: any, job: Job): Promise<any> {
  const { documentId, opportunityId, fileUrl, fileName, mimeType } = data;

  try {
    // Download attachment
    await job.updateProgress(20);
    const response = await axios.get(fileUrl, { 
      responseType: 'arraybuffer',
      timeout: 60000,
    });

    await job.updateProgress(40);

    // Process based on mime type
    let processedData: any = {};
    
    if (mimeType.includes('pdf')) {
      // Send to OCR service
      processedData = await sendToOCRService(documentId, response.data);
    } else if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
      // Process Excel file
      processedData = await processExcelFile(response.data);
    } else if (mimeType.includes('text')) {
      // Process text file
      processedData = { text: response.data.toString('utf-8') };
    }

    await job.updateProgress(80);

    // Store processed data
    const { error } = await supabase
      .from('processed_attachments')
      .upsert({
        document_id: documentId,
        opportunity_id: opportunityId,
        file_name: fileName,
        mime_type: mimeType,
        processed_data: processedData,
        processed_at: new Date().toISOString(),
      });

    if (error) throw error;

    await job.updateProgress(100);
    
    return { 
      documentId, 
      processedPages: processedData.pages?.length || 1,
      extractedText: processedData.text?.length || 0,
    };

  } catch (error) {
    logger.error({ error, documentId }, 'Failed to process attachment');
    throw error;
  }
}

async function generateComplianceMatrix(data: any, job: Job): Promise<any> {
  const { opportunityId, userId, requirements, format } = data;

  await job.updateProgress(30);

  // Create compliance matrix structure
  const matrix = requirements.map((req, index) => ({
    requirementNumber: `${index + 1}`,
    requirementText: req,
    complianceStatus: 'TBD',
    responseApproach: '',
    evidenceLocation: '',
    responsibleParty: '',
    dueDate: '',
    notes: '',
  }));

  await job.updateProgress(60);

  // Generate in requested format
  let fileUrl: string;
  let fileName: string;

  if (format === 'excel') {
    ({ fileUrl, fileName } = await generateComplianceExcel(opportunityId, matrix));
  } else {
    ({ fileUrl, fileName } = await generateCompliancePDF(opportunityId, matrix));
  }

  await job.updateProgress(90);

  // Store matrix reference
  await supabase
    .from('compliance_matrices')
    .insert({
      opportunity_id: opportunityId,
      user_id: userId,
      file_url: fileUrl,
      file_name: fileName,
      requirement_count: requirements.length,
      created_at: new Date().toISOString(),
    });

  return { fileUrl, fileName, requirementCount: requirements.length };
}

// Helper functions
async function fetchReportData(
  reportType: string, 
  userId: string, 
  filters?: any, 
  dateRange?: any
): Promise<any[]> {
  let query = supabase.from(reportType).select('*').eq('user_id', userId);

  if (dateRange) {
    query = query
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);
  }

  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  const { data, error } = await query;
  if (error) throw error;
  
  return data || [];
}

async function fetchExportData(
  dataType: string, 
  userId: string, 
  query?: any
): Promise<any[]> {
  let supabaseQuery = supabase.from(dataType).select('*');

  // Apply user filter for user-specific data
  if (['proposals', 'saved_opportunities'].includes(dataType)) {
    supabaseQuery = supabaseQuery.eq('user_id', userId);
  }

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      supabaseQuery = supabaseQuery.eq(key, value);
    });
  }

  const { data, error } = await supabaseQuery;
  if (error) throw error;
  
  return data || [];
}

async function generatePDFReport(reportType: string, data: any[]): Promise<any> {
  const fileName = `${reportType}_report_${Date.now()}.pdf`;
  const filePath = path.join('/tmp', fileName);
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument();
    const stream = createWriteStream(filePath);
    
    doc.pipe(stream);
    
    // Add content
    doc.fontSize(20).text(`${reportType.toUpperCase()} Report`, 50, 50);
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, 50, 80);
    
    // Add data
    let y = 120;
    data.forEach((item, index) => {
      if (y > 700) {
        doc.addPage();
        y = 50;
      }
      doc.text(`${index + 1}. ${JSON.stringify(item).substring(0, 80)}...`, 50, y);
      y += 20;
    });
    
    doc.end();
    
    stream.on('finish', () => {
      // In production, upload to S3/storage
      resolve({ fileUrl: filePath, fileName });
    });
    
    stream.on('error', reject);
  });
}

async function generateExcelReport(reportType: string, data: any[]): Promise<any> {
  const fileName = `${reportType}_report_${Date.now()}.xlsx`;
  const filePath = path.join('/tmp', fileName);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType);
  
  // Add headers
  if (data.length > 0) {
    worksheet.columns = Object.keys(data[0]).map(key => ({
      header: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '),
      key: key,
      width: 20,
    }));
  }
  
  // Add data
  worksheet.addRows(data);
  
  // Style header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE0E0E0' },
  };
  
  await workbook.xlsx.writeFile(filePath);
  
  return { fileUrl: filePath, fileName };
}

async function generateCSVReport(reportType: string, data: any[]): Promise<any> {
  const { createObjectCsvWriter } = await import('csv-writer');
  const fileName = `${reportType}_report_${Date.now()}.csv`;
  const filePath = path.join('/tmp', fileName);
  
  if (data.length === 0) {
    await fs.writeFile(filePath, 'No data available');
    return { fileUrl: filePath, fileName };
  }
  
  const csvWriter = createObjectCsvWriter({
    path: filePath,
    header: Object.keys(data[0]).map(key => ({ id: key, title: key })),
  });
  
  await csvWriter.writeRecords(data);
  
  return { fileUrl: filePath, fileName };
}

async function exportJSON(dataType: string, data: any[]): Promise<any> {
  const fileName = `${dataType}_export_${Date.now()}.json`;
  const filePath = path.join('/tmp', fileName);
  
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  
  return { fileUrl: filePath, fileName };
}

async function exportCSV(dataType: string, data: any[]): Promise<any> {
  return generateCSVReport(dataType, data);
}

async function exportExcel(dataType: string, data: any[]): Promise<any> {
  return generateExcelReport(dataType, data);
}

async function sendToOCRService(documentId: string, data: Buffer): Promise<any> {
  try {
    // In production, this would call the OCR service
    // For now, return mock data
    return {
      pages: [{ text: 'OCR processing placeholder', pageNumber: 1 }],
      text: 'OCR processing placeholder for document',
    };
  } catch (error) {
    logger.error({ error, documentId }, 'OCR service error');
    throw error;
  }
}

async function processExcelFile(data: Buffer): Promise<any> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data);
  
  const result: any = { sheets: [] };
  
  workbook.eachSheet((worksheet) => {
    const sheetData: any[] = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header
        sheetData.push(row.values);
      }
    });
    result.sheets.push({
      name: worksheet.name,
      data: sheetData,
    });
  });
  
  return result;
}

async function generateComplianceExcel(opportunityId: string, matrix: any[]): Promise<any> {
  const fileName = `compliance_matrix_${opportunityId}_${Date.now()}.xlsx`;
  const filePath = path.join('/tmp', fileName);
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Compliance Matrix');
  
  // Define columns
  worksheet.columns = [
    { header: 'Req #', key: 'requirementNumber', width: 10 },
    { header: 'Requirement', key: 'requirementText', width: 40 },
    { header: 'Status', key: 'complianceStatus', width: 15 },
    { header: 'Response Approach', key: 'responseApproach', width: 30 },
    { header: 'Evidence Location', key: 'evidenceLocation', width: 20 },
    { header: 'Responsible', key: 'responsibleParty', width: 15 },
    { header: 'Due Date', key: 'dueDate', width: 12 },
    { header: 'Notes', key: 'notes', width: 25 },
  ];
  
  // Add data
  worksheet.addRows(matrix);
  
  // Style
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4A90E2' },
  };
  
  await workbook.xlsx.writeFile(filePath);
  
  return { fileUrl: filePath, fileName };
}

async function generateCompliancePDF(opportunityId: string, matrix: any[]): Promise<any> {
  const fileName = `compliance_matrix_${opportunityId}_${Date.now()}.pdf`;
  const filePath = path.join('/tmp', fileName);
  
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ layout: 'landscape' });
    const stream = createWriteStream(filePath);
    
    doc.pipe(stream);
    
    // Title
    doc.fontSize(16).text('Compliance Matrix', 50, 50);
    doc.fontSize(10).text(`Opportunity ID: ${opportunityId}`, 50, 75);
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, 50, 90);
    
    // Table
    let y = 120;
    matrix.forEach((item, index) => {
      if (y > 500) {
        doc.addPage();
        y = 50;
      }
      
      doc.fontSize(10);
      doc.text(`${item.requirementNumber}. ${item.requirementText.substring(0, 100)}...`, 50, y);
      y += 30;
    });
    
    doc.end();
    
    stream.on('finish', () => {
      resolve({ fileUrl: filePath, fileName });
    });
    
    stream.on('error', reject);
  });
}

async function storeDocumentRecord(userId: string, jobType: string, result: any): Promise<void> {
  try {
    await supabase
      .from('generated_documents')
      .insert({
        user_id: userId,
        document_type: jobType,
        file_url: result.fileUrl,
        file_name: result.fileName,
        metadata: result,
        created_at: new Date().toISOString(),
      });
  } catch (error) {
    logger.error({ error, userId, jobType }, 'Failed to store document record');
  }
}