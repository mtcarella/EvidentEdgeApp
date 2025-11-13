import { useState, useEffect } from 'react';
import { FileCheck, Search, Plus, Download, History as HistoryIcon, AlertCircle, CheckCircle, Eye, Database, Edit2, Trash2, X, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface VerifiedWire {
  id: string;
  bank_name: string;
  routing_number: string;
  account_number: string;
  phone?: string;
  approved_by: string;
  date_approved: string;
  created_at?: string;
  created_by?: string;
}

interface VerificationLog {
  id: string;
  routing_number: string;
  account_number: string;
  file_number: string;
  loan_number: string;
  match_found: boolean;
  verified_wire_id: string | null;
  created_at: string;
  created_by: string;
  creator_name?: string;
  verified_wire?: VerifiedWire;
  reason_for_wire?: string;
  property_address?: string;
  seller_name?: string;
  loan_number_additional?: string;
  agent_type?: string;
  further_credit_to?: string;
  borrower_name?: string;
  buyer_name?: string;
}

type ViewMode = 'search' | 'add' | 'logs' | 'manage';

export function VerifyWires() {
  const { user, userProfile } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('search');
  const [loading, setLoading] = useState(false);

  const [fileNumber, setFileNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [reasonForWire, setReasonForWire] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [loanNumber, setLoanNumber] = useState('');
  const [agentType, setAgentType] = useState('');
  const [furtherCreditTo, setFurtherCreditTo] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [searchResult, setSearchResult] = useState<VerifiedWire | null>(null);
  const [searchPerformed, setSearchPerformed] = useState(false);

  const [newWire, setNewWire] = useState({
    bank_name: '',
    routing_number: '',
    account_number: '',
    phone: '',
    approved_by: '',
    date_approved: '',
  });

  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [logsLimit, setLogsLimit] = useState(100);
  const [logsSearchDate, setLogsSearchDate] = useState('');
  const [logsSearchFileNumber, setLogsSearchFileNumber] = useState('');

  const [allWires, setAllWires] = useState<VerifiedWire[]>([]);
  const [editingWire, setEditingWire] = useState<VerifiedWire | null>(null);
  const [editFormData, setEditFormData] = useState<VerifiedWire | null>(null);

  useEffect(() => {
    if (viewMode === 'logs' && (userProfile?.role === 'admin' || userProfile?.role === 'super_admin')) {
      loadLogs();
    }
    if (viewMode === 'manage' && userProfile?.role === 'super_admin') {
      loadAllWires();
    }
  }, [viewMode, userProfile, logsLimit, logsSearchDate, logsSearchFileNumber]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('wire_verification_logs')
        .select('*')
        .order('created_at', { ascending: false });

      if (logsSearchDate) {
        const startDate = new Date(logsSearchDate);
        const endDate = new Date(logsSearchDate);
        endDate.setHours(23, 59, 59, 999);
        query = query.gte('created_at', startDate.toISOString()).lte('created_at', endDate.toISOString());
      }

      if (logsSearchFileNumber) {
        query = query.ilike('file_number', `%${logsSearchFileNumber}%`);
      }

      query = query.limit(logsLimit);

      const { data: logsData } = await query;

      if (logsData) {
        const userIds = [...new Set(logsData.map(l => l.created_by))];
        const { data: users } = await supabase
          .from('sales_people')
          .select('user_id, name')
          .in('user_id', userIds);

        const userMap = new Map(users?.map(u => [u.user_id, u.name]) || []);

        const wireIds = logsData.filter(l => l.verified_wire_id).map(l => l.verified_wire_id);
        const { data: wires } = await supabase
          .from('verified_wires')
          .select('*')
          .in('id', wireIds);

        const wireMap = new Map(wires?.map(w => [w.id, w]) || []);

        const enrichedLogs = logsData.map(log => ({
          ...log,
          creator_name: userMap.get(log.created_by) || 'Unknown',
          verified_wire: log.verified_wire_id ? wireMap.get(log.verified_wire_id) : undefined,
        }));

        setLogs(enrichedLogs);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!fileNumber || !routingNumber || !accountNumber || !reasonForWire) {
      alert('Please fill in File Number, Routing Number, Account Number, and Reason for Wire');
      return;
    }

    // Validate conditional fields based on reason
    if (reasonForWire === 'seller_proceeds' && (!propertyAddress || !sellerName)) {
      alert('Please fill in Property Address and Seller Name for Seller Proceeds');
      return;
    }
    if (reasonForWire === 'payoff' && (!loanNumber || !propertyAddress)) {
      alert('Please fill in Loan Number and Property Address for Payoff');
      return;
    }
    if (reasonForWire === 'commission' && (!propertyAddress || !agentType)) {
      alert('Please fill in Property Address and Agent Type for Commission');
      return;
    }
    if (reasonForWire === 'brokerage_account' && !furtherCreditTo) {
      alert('Please fill in Further Credit To for Brokerage Account');
      return;
    }
    if (reasonForWire === 'returned_wire' && (!borrowerName || !propertyAddress || !loanNumber)) {
      alert('Please fill in Borrower Name, Property Address, and Loan Number for Returned Wire');
      return;
    }
    if (reasonForWire === 'returned_deposit' && (!propertyAddress || !buyerName)) {
      alert('Please fill in Property Address and Buyer Name for Returned Deposit');
      return;
    }
    if (reasonForWire === 'buyer_excess_funds' && (!propertyAddress || !buyerName)) {
      alert('Please fill in Property Address and Buyer Name for Buyer Excess Funds');
      return;
    }

    setLoading(true);
    setSearchPerformed(false);

    try {
      console.log('Searching for:', {
        routing_number: routingNumber.trim(),
        account_number: accountNumber.trim()
      });

      const { data: matches, error } = await supabase
        .from('verified_wires')
        .select('*')
        .eq('routing_number', routingNumber.trim())
        .eq('account_number', accountNumber.trim())
        .order('date_approved', { ascending: false })
        .limit(1);

      const match = matches && matches.length > 0 ? matches[0] : null;

      console.log('Search result:', { match, error });

      setSearchResult(match || null);
      setSearchPerformed(true);

      await supabase.from('wire_verification_logs').insert({
        routing_number: routingNumber.trim(),
        account_number: accountNumber.trim(),
        file_number: fileNumber.trim(),
        loan_number: loanNumber.trim() || null,
        match_found: !!match,
        verified_wire_id: match?.id || null,
        created_by: user?.id,
        reason_for_wire: reasonForWire,
        property_address: propertyAddress.trim() || null,
        seller_name: sellerName.trim() || null,
        loan_number_additional: loanNumber.trim() || null,
        agent_type: agentType || null,
        further_credit_to: furtherCreditTo.trim() || null,
        borrower_name: borrowerName.trim() || null,
        buyer_name: buyerName.trim() || null,
      });
    } catch (error) {
      console.error('Error searching:', error);
      alert('An error occurred during search');
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = (logEntry?: VerificationLog) => {
    if (!userProfile) return;

    const result = logEntry?.verified_wire || searchResult;
    const fNumber = logEntry?.file_number || fileNumber;
    const lNumber = logEntry?.loan_number || loanNumber;

    if (!result) return;

    const createdByName = logEntry?.creator_name || userProfile.name;
    const verificationDate = logEntry?.created_at
      ? new Date(logEntry.created_at).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });

    const wireReason = logEntry?.reason_for_wire || reasonForWire;
    const wireReasonLabel = wireReason ? {
      'seller_proceeds': 'Seller Proceeds',
      'payoff': 'Payoff',
      'commission': 'Commission',
      'brokerage_account': 'Brokerage Account',
      'returned_wire': 'Returned Wire',
      'returned_deposit': 'Returned Deposit',
      'buyer_excess_funds': 'Buyer Excess Funds'
    }[wireReason] : '';

    let messageToBeneficiary = '';

    if (wireReason === 'seller_proceeds') {
      const propAddr = logEntry?.property_address || propertyAddress;
      const seller = logEntry?.seller_name || sellerName;
      messageToBeneficiary = `${fNumber}, ${propAddr}, ${seller}`;
    } else if (wireReason === 'payoff') {
      const loan = logEntry?.loan_number_additional || loanNumber;
      const propAddr = logEntry?.property_address || propertyAddress;
      messageToBeneficiary = `${fNumber}, ${loan}, ${propAddr}`;
    } else if (wireReason === 'commission') {
      const propAddr = logEntry?.property_address || propertyAddress;
      const agentTypeLabel = (logEntry?.agent_type || agentType) === 'buyers_agent' ? 'Buyers Agent' : 'Sellers Agent';
      messageToBeneficiary = `${fNumber}, ${propAddr}, ${agentTypeLabel}`;
    } else if (wireReason === 'brokerage_account') {
      const credit = logEntry?.further_credit_to || furtherCreditTo;
      messageToBeneficiary = credit;
    } else if (wireReason === 'returned_wire') {
      const borrower = logEntry?.borrower_name || borrowerName;
      const propAddr = logEntry?.property_address || propertyAddress;
      const loan = logEntry?.loan_number_additional || loanNumber;
      messageToBeneficiary = `${fNumber}, ${borrower}, ${propAddr}, ${loan}`;
    } else if (wireReason === 'returned_deposit') {
      const propAddr = logEntry?.property_address || propertyAddress;
      const buyer = logEntry?.buyer_name || buyerName;
      messageToBeneficiary = `${fNumber}, ${propAddr}, ${buyer}`;
    } else if (wireReason === 'buyer_excess_funds') {
      const propAddr = logEntry?.property_address || propertyAddress;
      const buyer = logEntry?.buyer_name || buyerName;
      messageToBeneficiary = `${fNumber}, ${propAddr}, ${buyer}`;
    }

    const pdfContent = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                    NEW DOMESTIC WIRE TRANSFER - ${createdByName.toUpperCase().padEnd(30)}║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝


TRANSFER INFORMATION
─────────────────────────────────────────────────────────────────────────────────

  * Transfer Description:              ${fNumber}

  * Transfer Start Date:                _____________________

  * Amount:                             _____________________

    Tax Identification Number:          EVIDENT TITLE AGENCY INC [XXX-XX-3569]

                                        * From Account: _____________________


╔═══════════════════════════════════════════════════════════════════════════════╗
║  BENEFICIARY                                                                  ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  * Identification Type:                DDA Account Number

  * Identification Number:              ${result.account_number}

  * Name:                               ${result.bank_name}

    Address:                            _____________________________________

                                        _____________________________________


    Message To Beneficiary:

    ${messageToBeneficiary}


    Beneficiary Reference:              ${wireReasonLabel}


╔═══════════════════════════════════════════════════════════════════════════════╗
║  BENEFICIARY INSTITUTION                                                      ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  * Identification Type:                Fed Routing Number

  * Identification Number:              ${result.routing_number}

  * Name:                               ${result.bank_name}

  * Address:                            _____________________________________

                                        _____________________________________


╔═══════════════════════════════════════════════════════════════════════════════╗
║  RECEIVING INSTITUTION                                                        ║
╚═══════════════════════════════════════════════════════════════════════════════╝

  * Routing/Transit Number:             _____________________________________

    Institution Name:                   _____________________________________


─────────────────────────────────────────────────────────────────────────────────
  (* Indicates Required Fields)
─────────────────────────────────────────────────────────────────────────────────


╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                         WIRE VERIFICATION COMPLETE                            ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝

    Verified By:    ${createdByName}
    Date Verified:  ${verificationDate}


                        EVIDENT TITLE AGENCY INC
                    Wire Verification Department
    `;

    const blob = new Blob([pdfContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wire_Transfer_${fNumber}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleAddWire = async () => {
    if (!newWire.bank_name || !newWire.routing_number || !newWire.account_number || !newWire.approved_by || !newWire.date_approved) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('verified_wires').insert({
        bank_name: newWire.bank_name.trim(),
        routing_number: newWire.routing_number.trim(),
        phone: newWire.phone.trim() || null,
        account_number: newWire.account_number.trim(),
        approved_by: newWire.approved_by.trim(),
        date_approved: newWire.date_approved,
        created_by: user?.id,
      });

      if (error) {
        console.error('Error adding wire:', error);
        alert('Failed to add verified wire');
      } else {
        alert('Verified wire added successfully');
        setNewWire({
          bank_name: '',
          routing_number: '',
          account_number: '',
          phone: '',
          approved_by: '',
          date_approved: '',
        });
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setFileNumber('');
    setRoutingNumber('');
    setAccountNumber('');
    setReasonForWire('');
    setPropertyAddress('');
    setSellerName('');
    setLoanNumber('');
    setAgentType('');
    setFurtherCreditTo('');
    setBorrowerName('');
    setBuyerName('');
    setSearchResult(null);
    setSearchPerformed(false);
  };

  const loadAllWires = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('verified_wires')
        .select('*')
        .order('bank_name', { ascending: true });

      if (data) {
        setAllWires(data);
      }
    } catch (error) {
      console.error('Error loading wires:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditWire = (wire: VerifiedWire) => {
    setEditingWire(wire);
    setEditFormData({ ...wire });
  };

  const handleCancelEdit = () => {
    setEditingWire(null);
    setEditFormData(null);
  };

  const handleSaveEdit = async () => {
    if (!editFormData || !editingWire) return;

    if (!editFormData.bank_name || !editFormData.routing_number || !editFormData.account_number || !editFormData.approved_by || !editFormData.date_approved) {
      alert('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('verified_wires')
        .update({
          bank_name: editFormData.bank_name.trim(),
          routing_number: editFormData.routing_number.trim(),
          account_number: editFormData.account_number.trim(),
          phone: editFormData.phone?.trim() || null,
          approved_by: editFormData.approved_by.trim(),
          date_approved: editFormData.date_approved,
        })
        .eq('id', editingWire.id);

      if (error) {
        console.error('Error updating wire:', error);
        alert('Failed to update verified wire');
      } else {
        alert('Verified wire updated successfully');
        handleCancelEdit();
        loadAllWires();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteWire = async (wireId: string, bankName: string) => {
    if (!confirm(`Are you sure you want to delete the verified wire for ${bankName}? This action cannot be undone.`)) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('verified_wires')
        .delete()
        .eq('id', wireId);

      if (error) {
        console.error('Error deleting wire:', error);
        alert('Failed to delete verified wire');
      } else {
        alert('Verified wire deleted successfully');
        loadAllWires();
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileCheck className="w-6 h-6 text-slate-700" />
          <h2 className="text-2xl font-bold text-slate-900">Verify Wires</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('search')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'search'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Search className="w-4 h-4 inline mr-2" />
            Search
          </button>
          <button
            onClick={() => setViewMode('add')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              viewMode === 'add'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add New
          </button>
          {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
            <button
              onClick={() => setViewMode('logs')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'logs'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <HistoryIcon className="w-4 h-4 inline mr-2" />
              Logs
            </button>
          )}
          {userProfile?.role === 'super_admin' && (
            <button
              onClick={() => setViewMode('manage')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                viewMode === 'manage'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Database className="w-4 h-4 inline mr-2" />
              Manage
            </button>
          )}
        </div>
      </div>

      {viewMode === 'search' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                File Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={fileNumber}
                onChange={(e) => setFileNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter file number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Routing Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter routing number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reason for Wire <span className="text-red-500">*</span>
              </label>
              <select
                value={reasonForWire}
                onChange={(e) => setReasonForWire(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select reason...</option>
                <option value="seller_proceeds">Seller Proceeds</option>
                <option value="payoff">Payoff</option>
                <option value="commission">Commission</option>
                <option value="brokerage_account">Brokerage Account</option>
                <option value="returned_wire">Returned Wire</option>
                <option value="returned_deposit">Returned Deposit</option>
                <option value="buyer_excess_funds">Buyer Excess Funds</option>
              </select>
            </div>
          </div>

          {/* Conditional fields based on reason for wire */}
          {reasonForWire === 'seller_proceeds' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Seller Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter seller name"
                />
              </div>
            </div>
          )}

          {reasonForWire === 'payoff' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Loan Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={loanNumber}
                  onChange={(e) => setLoanNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter loan number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
            </div>
          )}

          {reasonForWire === 'commission' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Agent Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={agentType}
                  onChange={(e) => setAgentType(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select agent type...</option>
                  <option value="buyers_agent">Buyers Agent</option>
                  <option value="sellers_agent">Sellers Agent</option>
                </select>
              </div>
            </div>
          )}

          {reasonForWire === 'brokerage_account' && (
            <div className="grid grid-cols-1 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Further Credit To <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={furtherCreditTo}
                  onChange={(e) => setFurtherCreditTo(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter further credit to"
                />
              </div>
            </div>
          )}

          {reasonForWire === 'returned_wire' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Borrower Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={borrowerName}
                  onChange={(e) => setBorrowerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter borrower name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Loan Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={loanNumber}
                  onChange={(e) => setLoanNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter loan number"
                />
              </div>
            </div>
          )}

          {reasonForWire === 'returned_deposit' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Buyer's Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter buyer's name"
                />
              </div>
            </div>
          )}

          {reasonForWire === 'buyer_excess_funds' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Property Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={propertyAddress}
                  onChange={(e) => setPropertyAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter property address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Buyer's Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter buyer's name"
                />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <Search className="w-4 h-4 inline mr-2" />
              {loading ? 'Searching...' : 'Search'}
            </button>
            <button
              onClick={clearSearch}
              className="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Clear
            </button>
          </div>

          {searchPerformed && (
            <div className={`mt-6 p-6 rounded-lg border-2 ${
              searchResult
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
            }`}>
              {searchResult ? (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-semibold text-green-900">Match Found!</h3>
                  </div>
                  <div className="bg-white p-4 rounded-lg space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-slate-600">Bank Name</p>
                        <p className="font-medium text-slate-900">{searchResult.bank_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Routing Number</p>
                        <p className="font-medium text-slate-900">{searchResult.routing_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Account Number</p>
                        <p className="font-medium text-slate-900">{searchResult.account_number}</p>
                      </div>
                      {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
                        <div>
                          <p className="text-sm text-slate-600">Phone</p>
                          <p className="font-medium text-slate-900">{searchResult.phone || '-'}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-sm text-slate-600">Approved By</p>
                        <p className="font-medium text-slate-900">{searchResult.approved_by}</p>
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">Date Approved</p>
                        <p className="font-medium text-slate-900">
                          {new Date(searchResult.date_approved).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={generatePDF}
                    className="mt-4 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4 inline mr-2" />
                    Download Verification Report
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-6 h-6 text-red-600" />
                    <h3 className="text-lg font-semibold text-red-900">No Match Found</h3>
                  </div>
                  <p className="text-red-700">
                    The entered routing and account numbers do not match any verified wires in our database.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'add' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bank Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWire.bank_name}
                onChange={(e) => setNewWire({ ...newWire, bank_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter bank name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Routing Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWire.routing_number}
                onChange={(e) => setNewWire({ ...newWire, routing_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter routing number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Account Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWire.account_number}
                onChange={(e) => setNewWire({ ...newWire, account_number: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={newWire.phone}
                onChange={(e) => setNewWire({ ...newWire, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter phone number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Approved By <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newWire.approved_by}
                onChange={(e) => setNewWire({ ...newWire, approved_by: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter approver name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Date Approved <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={newWire.date_approved}
                onChange={(e) => setNewWire({ ...newWire, date_approved: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <button
            onClick={handleAddWire}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            {loading ? 'Adding...' : 'Add Verified Wire'}
          </button>
        </div>
      )}

      {viewMode === 'logs' && (userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Search by Date</label>
              <input
                type="date"
                value={logsSearchDate}
                onChange={(e) => setLogsSearchDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Search by File Number</label>
              <input
                type="text"
                value={logsSearchFileNumber}
                onChange={(e) => setLogsSearchFileNumber(e.target.value)}
                placeholder="Enter file number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Records Limit</label>
              <select
                value={logsLimit}
                onChange={(e) => setLogsLimit(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value={50}>Last 50</option>
                <option value={100}>Last 100</option>
                <option value={250}>Last 250</option>
                <option value={500}>Last 500</option>
                <option value={1000}>Last 1000</option>
              </select>
            </div>
          </div>
          {logsSearchDate || logsSearchFileNumber ? (
            <button
              onClick={() => {
                setLogsSearchDate('');
                setLogsSearchFileNumber('');
              }}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-sm"
            >
              Clear Filters
            </button>
          ) : null}
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No verification logs yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Date/Time</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">User</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">File #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Loan #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Routing #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Account #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Result</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-900">{log.creator_name}</td>
                      <td className="py-3 px-4 text-sm text-slate-900">{log.file_number}</td>
                      <td className="py-3 px-4 text-sm text-slate-900">{log.loan_number}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{log.routing_number}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{log.account_number}</td>
                      <td className="py-3 px-4">
                        {log.match_found ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3" />
                            Match
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="w-3 h-3" />
                            No Match
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {log.match_found && log.verified_wire && (
                          <button
                            onClick={() => generatePDF(log)}
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs font-medium"
                            title="Regenerate verification report"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {viewMode === 'manage' && userProfile?.role === 'super_admin' && (
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Loading wires...</div>
          ) : allWires.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No verified wires yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Bank Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Routing #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Account #</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Phone</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Approved By</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Date Approved</th>
                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {allWires.map((wire) => (
                    <tr key={wire.id} className="hover:bg-slate-50">
                      {editingWire?.id === wire.id && editFormData ? (
                        <>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={editFormData.bank_name}
                              onChange={(e) => setEditFormData({ ...editFormData, bank_name: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={editFormData.routing_number}
                              onChange={(e) => setEditFormData({ ...editFormData, routing_number: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={editFormData.account_number}
                              onChange={(e) => setEditFormData({ ...editFormData, account_number: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="tel"
                              value={editFormData.phone || ''}
                              onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              placeholder="Phone"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="text"
                              value={editFormData.approved_by}
                              onChange={(e) => setEditFormData({ ...editFormData, approved_by: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <input
                              type="date"
                              value={editFormData.date_approved}
                              onChange={(e) => setEditFormData({ ...editFormData, date_approved: e.target.value })}
                              className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={handleSaveEdit}
                                disabled={loading}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <Save className="w-3 h-3" />
                                Save
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={loading}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <X className="w-3 h-3" />
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-sm text-slate-900">{wire.bank_name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{wire.routing_number}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{wire.account_number}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{wire.phone || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-900">{wire.approved_by}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            {new Date(wire.date_approved).toLocaleDateString('en-US')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleEditWire(wire)}
                                disabled={loading || editingWire !== null}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <Edit2 className="w-3 h-3" />
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteWire(wire.id, wire.bank_name)}
                                disabled={loading || editingWire !== null}
                                className="inline-flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium disabled:opacity-50"
                              >
                                <Trash2 className="w-3 h-3" />
                                Delete
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
