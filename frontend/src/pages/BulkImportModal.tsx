import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiRequest } from '../services/api.js';
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from '../components/ui/index.js';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [failedRows, setFailedRows] = useState<any[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Roll Number': '22CSE099',
        'Registration Number': 'AKNU/2026/BH1/BTECH/CSE/0001',
        'Full Name': 'K. Sai Teja',
        'Email': 'saiteja@aknu.edu.in',
        'Phone': '9848099889',
        'Gender': 'male',
        'Course': 'B.Tech',
        'Department': 'Computer Science & Engineering',
        'Year': '3',
        'Semester': '5',
        'Permanent Address': 'D.No 4-12, Main Road, Rajamahendravaram, AP 533101',
        'Guardian Name': 'K. Srinivas',
        'Guardian Phone': '9848011223'
      },
      {
        'Roll Number': '22ECE050',
        'Registration Number': 'AKNU/2026/GH1/BTECH/ECE/0001',
        'Full Name': 'B. Anusha',
        'Email': 'anusha@aknu.edu.in',
        'Phone': '9848099890',
        'Gender': 'female',
        'Course': 'B.Tech',
        'Department': 'Electronics & Communication Engineering',
        'Year': '3',
        'Semester': '5',
        'Permanent Address': 'Flat 201, River View Apts, Danavaipeta, Rajahmundry, AP 533103',
        'Guardian Name': 'B. Prasad',
        'Guardian Phone': '9848011224'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'AKNU_Hostel_Bulk_Import_Sample.xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await apiRequest<{ success: boolean; summary: any; failedRows: any[] }>('/students/bulk-import', {
        method: 'POST',
        formData
      });

      if (res.success) {
        setSummary(res.summary);
        setFailedRows(res.failedRows || []);
        setShowResultModal(true);
        onImportComplete();
      }
    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadFailedReport = () => {
    if (failedRows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(failedRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'FailedRows');
    XLSX.writeFile(wb, 'AKNU_Import_Failed_Rows.xlsx');
  };

  const handleCloseUploadModal = () => {
    setFile(null);
    onClose();
  };

  const handleCloseResultModal = () => {
    setShowResultModal(false);
    setSummary(null);
    setFailedRows([]);
    setFile(null);
    onClose();
  };

  return (
    <>
      {/* 1. UPLOAD MODAL */}
      <Modal
        isOpen={isOpen && !showResultModal}
        onClose={handleCloseUploadModal}
        title="Bulk Student Excel / CSV Importer"
        size="xl"
        icon={<FileSpreadsheet className="w-5 h-5 text-amber-500" />}
      >
        <div className="space-y-4">
          {/* Download Template Banner */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold text-blue-950">Pre-formatted University Template</h4>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Download template with Course, Department, Year, Permanent Address, and residential details.
              </p>
            </div>
            <Button
              size="sm"
              variant="accent"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadSample}
            >
              Template
            </Button>
          </div>

          {/* Upload Dropzone */}
          <div className="border-2 border-dashed border-slate-300 hover:border-aknu-blue rounded-lg p-6 text-center bg-slate-50 transition cursor-pointer relative">
            <input
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
            <h4 className="text-sm font-bold text-slate-800">
              {file ? file.name : 'Choose an Excel (.xlsx) or CSV file'}
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Supports automated duplicate prevention and batch academic/address assignment.
            </p>
            {file && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                File ready: {(file.size / 1024).toFixed(1)} KB
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
            <Button
              variant="secondary"
              onClick={handleCloseUploadModal}
            >
              Cancel
            </Button>
            <Button
              disabled={!file || uploading}
              isLoading={uploading}
              onClick={handleUpload}
              variant="primary"
            >
              Confirm & Import Records
            </Button>
          </div>
        </div>
      </Modal>

      {/* 2. RESULT MODAL (MANUAL CLOSE ONLY) */}
      <Modal
        isOpen={showResultModal}
        onClose={handleCloseResultModal}
        title="Import Results & Audit Summary"
        subtitle="Review the execution results of your uploaded student dataset."
        size="xl"
        icon={
          summary && summary.failedCount > 0 ? (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )
        }
      >
        {summary && (
          <div className="space-y-4 py-1">
            {/* Status Header Banner */}
            {summary.failedCount === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">
                    Bulk Import Completed Successfully!
                  </h4>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    {summary.importedCount} student {summary.importedCount === 1 ? 'record has' : 'records have'} been validated and added to the university master directory with cryptographic QR credentials.
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-amber-950">
                    Import Finished with Some Exceptions
                  </h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    {summary.importedCount} records imported successfully, but {summary.failedCount} {summary.failedCount === 1 ? 'row' : 'rows'} could not be imported due to duplicate entries or validation issues.
                  </p>
                </div>
              </div>
            )}

            {/* 3 Metric Summary Boxes Matching The User's Design */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-2xs">
                <span className="text-[11px] text-slate-500 font-bold block uppercase tracking-wider">
                  TOTAL ROWS
                </span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">
                  {summary.totalRows}
                </span>
              </div>

              <div className="bg-emerald-50/60 p-4 rounded-lg border border-emerald-200 shadow-2xs">
                <span className="text-[11px] text-emerald-800 font-bold block uppercase tracking-wider">
                  IMPORTED
                </span>
                <span className="text-2xl font-black text-emerald-700 mt-1 block">
                  {summary.importedCount}
                </span>
              </div>

              <div className="bg-red-50/60 p-4 rounded-lg border border-red-200 shadow-2xs">
                <span className="text-[11px] text-red-800 font-bold block uppercase tracking-wider">
                  FAILED / DUPS
                </span>
                <span className="text-2xl font-black text-red-700 mt-1 block">
                  {summary.failedCount}
                </span>
              </div>
            </div>

            {/* Detailed Failed Rows Breakdown if any */}
            {failedRows.length > 0 && (
              <div className="space-y-2 border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Failed / Duplicate Rows ({failedRows.length})
                  </span>
                  <Button
                    size="xs"
                    variant="outline"
                    leftIcon={<Download className="w-3 h-3 text-red-600" />}
                    onClick={handleDownloadFailedReport}
                  >
                    Download Error Report (.xlsx)
                  </Button>
                </div>

                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded bg-white text-xs">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px] sticky top-0">
                      <tr>
                        <th className="p-2 w-16">Row #</th>
                        <th className="p-2">Roll Number</th>
                        <th className="p-2">Reason / Error</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                      {failedRows.map((fr: any, idx: number) => (
                        <tr key={idx} className="hover:bg-red-50/40">
                          <td className="p-2 text-slate-500">Row {fr.rowNumber || idx + 1}</td>
                          <td className="p-2 font-bold text-slate-800">{fr.rollNumber || 'N/A'}</td>
                          <td className="p-2 text-red-600 font-sans">{fr.reason || 'Invalid data'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Manual Close Button Only */}
            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <Button
                variant="primary"
                onClick={handleCloseResultModal}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
