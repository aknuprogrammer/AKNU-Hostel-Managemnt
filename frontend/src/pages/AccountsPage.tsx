import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.js';
import { apiRequest } from '../services/api.js';
import { FeeLedger } from '../types.js';
import { useConfirm } from '../context/ConfirmContext.js';
import { ReceiptIndianRupee, CreditCard, CheckCircle2, AlertCircle, Printer, Plus } from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Modal,
  Badge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableLoading,
  TableEmpty
} from '../components/ui/index.js';

export const AccountsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useConfirm();
  const [ledgers, setLedgers] = useState<FeeLedger[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Payment recording modal
  const [selectedLedger, setSelectedLedger] = useState<FeeLedger | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMode, setPayMode] = useState('upi');
  const [txRef, setTxRef] = useState('');

  // Generated receipt modal
  const [receiptData, setReceiptData] = useState<any | null>(null);

  useEffect(() => {
    fetchLedgers();
    fetchStructures();
  }, []);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      const res = await apiRequest<{ success: boolean; data: FeeLedger[] }>('/finance/ledgers');
      if (res.success) {
        setLedgers(res.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchStructures = async () => {
    try {
      const res = await apiRequest<{ success: boolean; data: any[] }>('/finance/structures');
      if (res.success) {
        setStructures(res.data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLedger) return;

    try {
      const res = await apiRequest<{ success: boolean; message: string; data: any }>('/finance/payments', {
        method: 'POST',
        body: {
          ledgerId: selectedLedger.id,
          amount: payAmount,
          paymentMode: payMode,
          transactionReference: txRef || `TXN-${Date.now().toString().slice(-6)}`
        }
      });

      if (res.success) {
        setReceiptData({
          ...res.data,
          studentName: selectedLedger.student_name,
          rollNumber: selectedLedger.roll_number,
          feeType: selectedLedger.fee_type,
          amount: payAmount,
          date: new Date().toLocaleDateString('en-IN')
        });
        setSelectedLedger(null);
        fetchLedgers();
      }
    } catch (err: any) {
      await showError('Payment recording failed: ' + err.message, 'Payment Error');
    }
  };

  const isAccounts = ['super_admin', 'chief_warden', 'assistant_warden', 'junior_assistant'].includes(user?.role || '');

  return (
    <div className="space-y-3">
      {/* Top Header */}
      <div className="bg-white rounded-lg p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Hostel Fee Management & Receipts</h1>
          <p className="text-xs text-slate-500 mt-1">
            Student fee dues ledgers, installment records, and university payment receipts.
          </p>
        </div>
      </div>

      {/* Fee Structures Reference Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {structures.map((s) => (
          <div key={s.id} className="bg-white rounded-lg p-4 border border-slate-200 shadow-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              {s.hostel_name}
            </span>
            <h4 className="font-bold text-sm text-slate-800 capitalize mt-1">
              {s.fee_type.replace('_', ' ')}
            </h4>
            <div className="mt-2 text-lg font-extrabold text-aknu-blue font-mono">
              ₹ {Number(s.amount).toLocaleString('en-IN')}
            </div>
            <span className="text-[11px] text-slate-500 block mt-1">
              Due Date: {new Date(s.due_date).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      {/* Student Ledgers Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-800">Student Fee Account Ledgers</h3>
          <span className="text-xs text-slate-400 font-mono">{ledgers.length} ledgers</span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Fee Category</TableHead>
                <TableHead>Total Prescribed</TableHead>
                <TableHead>Amount Paid</TableHead>
                <TableHead>Outstanding Balance</TableHead>
                <TableHead>Payment Status</TableHead>
                {isAccounts && <TableHead align="right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableLoading colSpan={isAccounts ? 7 : 6} message="Loading fee ledgers..." />
              ) : ledgers.length > 0 ? (
                ledgers.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <span className="font-bold text-slate-800 block text-sm">{l.student_name}</span>
                      <span className="font-mono text-slate-500 text-xs">{l.roll_number} • {l.hostel_name}</span>
                    </TableCell>

                    <TableCell>
                      <span className="capitalize font-medium text-slate-700">
                        {l.fee_type.replace('_', ' ')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono font-semibold text-slate-800">
                        ₹ {Number(l.total_prescribed_amount).toLocaleString('en-IN')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono font-semibold text-emerald-700">
                        ₹ {Number(l.amount_paid).toLocaleString('en-IN')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono font-bold text-slate-900">
                        ₹ {Number(l.balance).toLocaleString('en-IN')}
                      </span>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={
                          l.status === 'paid'
                            ? 'success'
                            : l.status === 'partial'
                            ? 'primary'
                            : 'danger'
                        }
                        dot
                      >
                        {l.status}
                      </Badge>
                    </TableCell>

                    {isAccounts && (
                      <TableCell align="right">
                        {l.balance > 0 ? (
                          <Button
                            size="xs"
                            variant="primary"
                            onClick={() => {
                              setSelectedLedger(l);
                              setPayAmount(Number(l.balance));
                            }}
                          >
                            Collect Payment
                          </Button>
                        ) : (
                          <span className="text-[11px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Cleared
                          </span>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              ) : (
                <TableEmpty colSpan={isAccounts ? 7 : 6} message="No fee ledgers recorded." />
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* MODAL: COLLECT PAYMENT */}
      <Modal
        isOpen={!!selectedLedger}
        onClose={() => setSelectedLedger(null)}
        title="Record Hostel Fee Payment"
        size="md"
        icon={<ReceiptIndianRupee className="w-5 h-5 text-amber-500" />}
      >
        {selectedLedger && (
          <form onSubmit={handleRecordPayment} className="space-y-3.5">
            <p className="text-xs text-slate-500 bg-slate-50 p-2.5 rounded-md border border-slate-200">
              Collecting for <strong className="text-slate-800">{selectedLedger.student_name}</strong> ({selectedLedger.roll_number})
              — Current Balance: <span className="font-mono font-bold text-slate-800">₹ {selectedLedger.balance}</span>
            </p>

            <Input
              required
              label="Amount to Pay (₹) *"
              type="number"
              min="1"
              max={selectedLedger.balance}
              value={payAmount}
              onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
            />

            <Select
              label="Payment Method"
              value={payMode}
              onChange={(e) => setPayMode(e.target.value)}
              options={[
                { value: 'upi', label: 'UPI / QR Code' },
                { value: 'bank_challan', label: 'University Bank Challan' },
                { value: 'online_gateway', label: 'Online Payment Gateway' },
                { value: 'dd', label: 'Demand Draft (DD)' }
              ]}
            />

            <Input
              label="Transaction Reference / UTR Number"
              type="text"
              placeholder="e.g. UPI-202610129994"
              value={txRef}
              onChange={(e) => setTxRef(e.target.value)}
            />

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setSelectedLedger(null)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="success"
              >
                Generate Official Receipt
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* MODAL: OFFICIAL PAYMENT RECEIPT */}
      <Modal
        isOpen={!!receiptData}
        onClose={() => setReceiptData(null)}
        title="Official Hostel Fee Receipt"
        size="md"
        icon={<Printer className="w-5 h-5 text-amber-500" />}
      >
        {receiptData && (
          <div className="space-y-4">
            <div className="text-center pb-3 border-b border-slate-200">
              <h3 className="font-extrabold text-sm uppercase text-aknu-navy">Adikavi Nannaya University</h3>
              <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Official Hostel Fee Receipt</p>
              <span className="font-mono text-xs font-bold text-aknu-blue block mt-1">
                Receipt No: {receiptData.receiptNumber}
              </span>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200 font-medium">
              <div className="flex justify-between">
                <span className="text-slate-500">Resident Name:</span>
                <span className="font-bold text-slate-900">{receiptData.studentName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Roll Number:</span>
                <span className="font-mono text-slate-900">{receiptData.rollNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fee Head:</span>
                <span className="capitalize text-slate-900">{receiptData.feeType?.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold">
                <span className="text-slate-800">Amount Received:</span>
                <span className="font-mono text-emerald-700">₹ {receiptData.amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500">Remaining Balance:</span>
                <span className="font-mono font-bold text-slate-800">₹ {receiptData.newBalance}</span>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <Button
                variant="primary"
                leftIcon={<Printer className="w-3.5 h-3.5" />}
                onClick={() => window.print()}
              >
                Print Receipt
              </Button>
              <Button
                variant="secondary"
                onClick={() => setReceiptData(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
