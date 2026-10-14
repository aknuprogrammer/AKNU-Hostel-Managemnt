import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiRequest } from '../services/api.js';
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle } from 'lucide-react';
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

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Roll Number': '22CSE099',
        'Registration Number': 'AKNU/2026/BH1/BTECH/CSE/099',
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
        'Registration Number': 'AKNU/2026/GH1/BTECH/ECE/050',
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
      setSummary(null);
      setFailedRows([]);
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
        setFailedRows(res.failedRows);
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
        </div>

        {/* Import Result Summary */}
        {summary && (
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white p-2.5 rounded-md border border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold block">TOTAL ROWS</span>
                <span className="text-base font-extrabold text-slate-800">{summary.totalRows}</span>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-md border border-emerald-200">
                <span className="text-[10px] text-emerald-700 font-bold block">IMPORTED</span>
                <span className="text-base font-extrabold text-emerald-700">{summary.importedCount}</span>
              </div>
              <div className="bg-red-50 p-2.5 rounded-md border border-red-200">
                <span className="text-[10px] text-red-700 font-bold block">FAILED / DUPS</span>
                <span className="text-base font-extrabold text-red-700">{summary.failedCount}</span>
              </div>
            </div>

            {failedRows.length > 0 && (
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-red-600 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {failedRows.length} rows encountered duplicates or validation errors
                </span>
                <button
                  type="button"
                  onClick={handleDownloadFailedReport}
                  className="text-xs text-red-700 underline font-bold"
                >
                  Download Error Report
                </button>
              </div>
            )}
          </div>
        )}

        <div className="pt-4 border-t border-slate-100 flex justify-end space-x-2">
          <Button
            variant="secondary"
            onClick={onClose}
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
  );
};
