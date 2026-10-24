import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { apiRequest } from '../services/api.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { UploadCloud, FileSpreadsheet, Download, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button, Modal } from '../components/ui/index.js';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImportComplete }) => {
  const { showError } = useConfirm();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<any | null>(null);
  const [failedRows, setFailedRows] = useState<any[]>([]);
  const [showResultModal, setShowResultModal] = useState(false);

  const handleDownloadSample = () => {
    const sampleData = [
      {
        'Program Level': 'UG',
        'Degree': 'B.Tech',
        'Branch': 'Civil Engineering',
        'Year': '1',
        'Semester': '1',
        'Roll Number': '24CIVIL001',
        'Registration Number': 'AKNU/2026/BH1/BTECH/CIVIL/0001',
        'Full Name': 'P. Ravi Kumar',
        'Email': 'ravikumar@aknu.edu.in',
        'Phone': '9848011221',
        'Gender': 'male',
        'Permanent Address': 'D.No 2-44, Main Road, Kakinada, AP 533001',
        'Guardian Name': 'P. Venkat Rao',
        'Guardian Phone': '9848011222'
      },
      {
        'Program Level': 'UG',
        'Degree': 'B.Tech',
        'Branch': 'Computer Science & Engineering',
        'Year': '3',
        'Semester': '5',
        'Roll Number': '22CSE099',
        'Registration Number': 'AKNU/2026/BH1/BTECH/CSE/0001',
        'Full Name': 'K. Sai Teja',
        'Email': 'saiteja@aknu.edu.in',
        'Phone': '9848099889',
        'Gender': 'male',
        'Permanent Address': 'D.No 4-12, Main Road, Rajamahendravaram, AP 533101',
        'Guardian Name': 'K. Srinivas',
        'Guardian Phone': '9848011223'
      },
      {
        'Program Level': 'UG',
        'Degree': 'B.Tech',
        'Branch': 'Electronics & Communication Engineering',
        'Year': '2',
        'Semester': '3',
        'Roll Number': '23ECE050',
        'Registration Number': 'AKNU/2026/GH1/BTECH/ECE/0001',
        'Full Name': 'B. Anusha',
        'Email': 'anusha@aknu.edu.in',
        'Phone': '9848099890',
        'Gender': 'female',
        'Permanent Address': 'Flat 201, River View Apts, Danavaipeta, Rajahmundry, AP 533103',
        'Guardian Name': 'B. Prasad',
        'Guardian Phone': '9848011224'
      },
      {
        'Program Level': 'PG',
        'Degree': 'MCA',
        'Branch': 'Master of Computer Applications',
        'Year': '1',
        'Semester': '1',
        'Roll Number': '25MCA012',
        'Registration Number': 'AKNU/2026/BH1/MCA/MCA/0001',
        'Full Name': 'M. Suresh',
        'Email': 'msuresh@aknu.edu.in',
        'Phone': '9848012345',
        'Gender': 'male',
        'Permanent Address': 'Opp. Clock Tower, Amalapuram, AP 533201',
        'Guardian Name': 'M. Satyanarayana',
        'Guardian Phone': '9848012346'
      },
      {
        'Program Level': 'PG',
        'Degree': 'MBA',
        'Branch': 'Department of Management Studies',
        'Year': '2',
        'Semester': '3',
        'Roll Number': '24MBA045',
        'Registration Number': 'AKNU/2026/GH1/MBA/MBA/0001',
        'Full Name': 'G. Swathi',
        'Email': 'swathi@aknu.edu.in',
        'Phone': '9848056789',
        'Gender': 'female',
        'Permanent Address': 'Near RTC Complex, Eluru, AP 534001',
        'Guardian Name': 'G. Nageswara Rao',
        'Guardian Phone': '9848056780'
      },
      {
        'Program Level': 'PG',
        'Degree': 'M.Tech',
        'Branch': 'Computer Science & Engineering',
        'Year': '1',
        'Semester': '1',
        'Roll Number': '25MTECH005',
        'Registration Number': 'AKNU/2026/BH1/MTECH/CSE/0001',
        'Full Name': 'Ch. Vamsi Krishna',
        'Email': 'vamsikrishna@aknu.edu.in',
        'Phone': '9848098765',
        'Gender': 'male',
        'Permanent Address': 'D.No 5-89, Tilak Road, Rajahmundry, AP 533101',
        'Guardian Name': 'Ch. Appa Rao',
        'Guardian Phone': '9848098766'
      },
      {
        'Program Level': 'PhD',
        'Degree': 'Ph.D',
        'Branch': 'Computer Science & Engineering',
        'Year': '1',
        'Semester': '1',
        'Roll Number': '25PHDCSE01',
        'Registration Number': 'AKNU/2026/BH1/PHD/CSE/0001',
        'Full Name': 'N. Rajesh',
        'Email': 'nrajesh@aknu.edu.in',
        'Phone': '9848091122',
        'Gender': 'male',
        'Permanent Address': 'D.No 12-4, Danavaipeta, Rajahmundry, AP 533103',
        'Guardian Name': 'N. Subba Rao',
        'Guardian Phone': '9848091123'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.writeFile(wb, 'AKNU_Hostel_Bulk_Import_Multi_Course_Sample.xlsx');
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
      await showError('Upload failed: ' + err.message, 'Import Error');
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
              <h4 className="text-xs font-bold text-blue-950">Pre-formatted Multi-Program University Template</h4>
              <p className="text-[11px] text-blue-800 mt-0.5">
                Includes explicit <strong>Program Level (UG, PG, PhD)</strong>, Degree, Branch, Year, Semester & Address fields.
              </p>
            </div>
            <Button
              size="sm"
              variant="accent"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={handleDownloadSample}
            >
              Download Template
            </Button>
          </div>

          {/* Quick Academic Reference Guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2">
            <div className="flex items-center justify-between text-slate-700 font-semibold text-[11px] uppercase tracking-wide">
              <span>Supported Programs & Hierarchy Guide</span>
              <span className="text-[10px] text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded font-bold">Auto-Smart Matching</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">Program Level & Degrees:</span>
                <span className="text-slate-600">
                  <strong className="text-blue-700">UG (Undergraduate):</strong> B.Tech (4 yrs), B.Sc, B.Com, B.A (3 yrs), B.Pharmacy<br />
                  <strong className="text-purple-700">PG (Postgraduate):</strong> M.Tech, MCA, MBA, M.Sc, M.Com, M.A (2 yrs)<br />
                  <strong className="text-amber-700">PhD (Doctoral):</strong> Ph.D (Research)
                </span>
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-slate-800 block mb-0.5">Branches / Departments:</span>
                <span className="text-slate-600">
                  <strong className="text-indigo-700">Engineering:</strong> Civil, CSE, ECE, Mech, EEE, IT, AI-DS<br />
                  <strong className="text-indigo-700">Postgraduate:</strong> MCA, MBA, Science, Commerce, Humanities<br />
                  <strong className="text-indigo-700">Study Years:</strong> 1st to 4th Year (UG) or 1st to 2nd Year (PG)
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 italic">
              Tip: Set column <code>Program Level</code> to <code>UG</code>, <code>PG</code>, or <code>PhD</code>. Emails can be Gmail or University addresses (or left blank to auto-generate from roll number). Boys/Girls wing boundary rules are strictly verified automatically.
            </p>
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
              Supports automated duplicate prevention, smart degree/branch resolution, and wing RBAC.
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
