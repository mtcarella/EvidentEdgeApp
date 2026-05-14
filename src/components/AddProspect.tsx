import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle, Copy, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatContactData } from '../lib/formatters';
import { checkForDuplicates, DuplicateContact } from '../lib/duplicateChecker';

export function AddProspect() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [type, setType] = useState<'buyer' | 'realtor' | 'attorney' | 'loan_officer' | 'vendor'>('buyer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [cellPhone, setCellPhone] = useState('');
  const [company, setCompany] = useState('');
  const [branch, setBranch] = useState('');
  const [address, setAddress] = useState('');
  const [clientIdentifierNo, setClientIdentifierNo] = useState('');
  const [evidentParalegal, setEvidentParalegal] = useState('');
  const [clientParalegalProcessor, setClientParalegalProcessor] = useState('');
  const [preferredSurveyor, setPreferredSurveyor] = useState('');
  const [preferredUw, setPreferredUw] = useState('');
  const [preferredCloser, setPreferredCloser] = useState('');
  const [birthday, setBirthday] = useState('');
  const [drinks, setDrinks] = useState(true);
  const [clientType, setClientType] = useState('prospect');
  const [grade, setGrade] = useState('C');
  const [marketingPoints, setMarketingPoints] = useState(0);
  const [notes, setNotes] = useState('');
  const [processorNotes, setProcessorNotes] = useState('');
  const [checking, setChecking] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
  const [showCloneSearch, setShowCloneSearch] = useState(false);
  const [cloneSearchTerm, setCloneSearchTerm] = useState('');
  const [cloneSearchResults, setCloneSearchResults] = useState<any[]>([]);
  const [searchingClone, setSearchingClone] = useState(false);
  const { user, salesPerson, isAdmin, isAdminOrProcessor } = useAuth();

  useEffect(() => {
    if (isAdmin) {
      loadSalespeople();
    } else if (salesPerson?.id) {
      setSelectedSalesperson(salesPerson.id);
    }
  }, [isAdmin, salesPerson]);

  const loadSalespeople = async () => {
    const { data } = await supabase
      .from('sales_people')
      .select('id, name')
      .eq('is_active', true)
      .order('name');

    if (data) {
      setSalespeople(data);
      if (data.length > 0 && !selectedSalesperson) {
        setSelectedSalesperson(data[0].id);
      }
    }
  };

  const searchContactsForClone = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setCloneSearchResults([]);
      return;
    }

    setSearchingClone(true);
    try {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, first_name, last_name, type, email, phone, cell_phone, company, branch, address, client_identifier_no, evident_paralegal, client_paralegal_processor, preferred_surveyor, preferred_uw, preferred_closer, birthday, drinks, marketing_points, notes, processor_notes')
        .or(`name.ilike.%${searchTerm}%,first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%,company.ilike.%${searchTerm}%`)
        .order('name')
        .limit(10);

      if (error) throw error;
      setCloneSearchResults(data || []);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setCloneSearchResults([]);
    } finally {
      setSearchingClone(false);
    }
  };

  const cloneContact = (contact: any) => {
    setFirstName('');
    setLastName('');
    setEmail('');
    setType(contact.type);
    setPhone(contact.phone || '');
    setCellPhone(contact.cell_phone || '');
    setCompany(contact.company || '');
    setBranch(contact.branch || '');
    setAddress(contact.address || '');
    setClientIdentifierNo(contact.client_identifier_no || '');
    setEvidentParalegal(contact.evident_paralegal || '');
    setClientParalegalProcessor(contact.client_paralegal_processor || '');
    setPreferredSurveyor(contact.preferred_surveyor || '');
    setPreferredUw(contact.preferred_uw || '');
    setPreferredCloser(contact.preferred_closer || '');
    setBirthday(contact.birthday || '');
    setDrinks(contact.drinks ?? true);
    setMarketingPoints(contact.marketing_points || 0);
    setNotes(contact.notes || '');
    setProcessorNotes(contact.processor_notes || '');

    setShowCloneSearch(false);
    setCloneSearchTerm('');
    setCloneSearchResults([]);
  };

  useEffect(() => {
    if (cloneSearchTerm.length >= 2) {
      const timer = setTimeout(() => {
        searchContactsForClone(cloneSearchTerm);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setCloneSearchResults([]);
    }
  }, [cloneSearchTerm]);

  const checkExisting = async () => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (!fullName && !email.trim()) {
      setDuplicates([]);
      return;
    }

    setChecking(true);

    try {
      const found = await checkForDuplicates(fullName, email);
      setDuplicates(found);
    } catch (error) {
      console.error('Error checking duplicates:', error);
      setDuplicates([]);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    if (fullName.length >= 3 || email.length > 0) {
      const timer = setTimeout(() => {
        checkExisting();
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDuplicates([]);
    }
  }, [firstName, lastName, email]);

  const handleTypeChange = (newType: 'buyer' | 'realtor' | 'attorney' | 'loan_officer' | 'vendor') => {
    setType(newType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesperson) return;

    setLoading(true);
    setSuccess(false);

    try {
      // Check if a contact with the exact same email already exists (only if email is provided)
      let existingContact = null;
      if (email && email.trim()) {
        const { data } = await supabase
          .from('contacts')
          .select('id')
          .ilike('email', email.trim())
          .maybeSingle();
        existingContact = data;
      }

      const formattedData = formatContactData({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
        phone: phone || null,
        cell_phone: cellPhone || null,
        company: company || null,
        branch: branch || null,
        address: address || null,
        notes: notes || null,
      });

      const contactData = {
        ...formattedData,
        type,
        assigned_to: selectedSalesperson,
        updated_by: user?.id,
        client_identifier_no: clientIdentifierNo || null,
        evident_paralegal: evidentParalegal || null,
        client_paralegal_processor: clientParalegalProcessor || null,
        preferred_surveyor: preferredSurveyor || null,
        preferred_uw: preferredUw || null,
        preferred_closer: preferredCloser || null,
        birthday: birthday || null,
        drinks,
        client_type: clientType || null,
        grade: grade || null,
        marketing_points: marketingPoints,
        processor_notes: processorNotes || null,
      };

      let contact;
      let isNewContact = false;

      if (existingContact) {
        // Update existing contact
        const { data: updatedContact, error: updateError } = await supabase
          .from('contacts')
          .update(contactData)
          .eq('id', existingContact.id)
          .select()
          .single();

        if (updateError) throw updateError;
        contact = updatedContact;
      } else {
        // Create new contact
        const { data: newContact, error: insertError } = await supabase
          .from('contacts')
          .insert({
            ...contactData,
            created_by: user?.id,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        contact = newContact;
        isNewContact = true;
      }

      if (contact) {
        // Check if assignment already exists
        const { data: existingAssignment } = await supabase
          .from('assignments')
          .select('id')
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (existingAssignment) {
          // Update existing assignment
          const { error: updateAssignError } = await supabase
            .from('assignments')
            .update({
              salesperson_id: selectedSalesperson,
              assigned_by: user?.id,
            })
            .eq('id', existingAssignment.id);

          if (updateAssignError) throw updateAssignError;
        } else {
          // Create new assignment
          const { error: assignError } = await supabase
            .from('assignments')
            .insert({
              contact_id: contact.id,
              salesperson_id: selectedSalesperson,
              assigned_by: user?.id,
            });

          if (assignError) throw assignError;
        }

        if (isNewContact) {
          const assignedSalesperson = isAdmin
            ? salespeople.find(s => s.id === selectedSalesperson)?.name ?? 'Unknown'
            : salesPerson?.name ?? 'Unknown';

          const prospectName = [firstName, lastName].filter(Boolean).join(' ') || company || 'Unknown';

          const typeLabels: Record<string, string> = {
            buyer: 'Buyer',
            realtor: 'Realtor',
            attorney: 'Attorney',
            loan_officer: 'Loan Officer',
            vendor: 'Vendor',
          };

          supabase.functions.invoke('send-communication', {
            body: {
              type: 'email',
              notifySuperAdmins: true,
              subject: `New Prospect Added: ${prospectName}`,
              message: `A new prospect has been added to the system.\n\nName: ${prospectName}\nType: ${typeLabels[type] ?? type}\nAssigned To: ${assignedSalesperson}\nAdded By: ${salesPerson?.name ?? user?.email ?? 'Unknown'}`,
              sendCopyToSender: false,
            },
          }).catch((err: any) => console.error('Failed to send prospect notification:', err));
        }
      }

      setSuccess(true);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPhone('');
      setCellPhone('');
      setCompany('');
      setBranch('');
      setAddress('');
      setClientIdentifierNo('');
      setEvidentParalegal('');
      setClientParalegalProcessor('');
      setPreferredSurveyor('');
      setPreferredUw('');
      setPreferredCloser('');
      setBirthday('');
      setDrinks(true);
      setClientType('prospect');
      setGrade('C');
      setMarketingPoints(0);
      setNotes('');
      setProcessorNotes('');
      setType('buyer');
      setDuplicates([]);

      setTimeout(() => setSuccess(false), 3000);
    } catch (error: any) {
      console.error('Error adding prospect:', error);
      alert('Failed to add prospect: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900 p-3 bg-slate-50 border border-slate-200 rounded-lg md:p-0 md:bg-transparent md:border-0 md:rounded-none">Add New Prospect</h2>
        <button
          type="button"
          onClick={() => setShowCloneSearch(!showCloneSearch)}
          className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Copy className="w-4 h-4" />
          Clone from Existing
        </button>
      </div>

      {showCloneSearch && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <Search className="w-5 h-5 text-slate-500" />
            <input
              type="text"
              value={cloneSearchTerm}
              onChange={(e) => setCloneSearchTerm(e.target.value)}
              placeholder="Search by name, email, or company to clone..."
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {searchingClone && (
            <p className="text-sm text-slate-500">Searching...</p>
          )}

          {cloneSearchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {cloneSearchResults.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  onClick={() => cloneContact(contact)}
                  className="w-full text-left p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{contact.name}</p>
                      <p className="text-sm text-slate-600">
                        {contact.type} {contact.company && `• ${contact.company}`}
                      </p>
                    </div>
                    <Copy className="w-4 h-4 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {cloneSearchTerm.length >= 2 && !searchingClone && cloneSearchResults.length === 0 && (
            <p className="text-sm text-slate-500">No contacts found</p>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-2">
              First Name *
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            />
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-2">
              Last Name *
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              required
            />
          </div>
        </div>

        {checking && (
          <p className="text-sm text-slate-500">Checking for duplicates...</p>
        )}
        {duplicates.length > 0 && (
          <div className="space-y-2">
            {duplicates.map((dup, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p>
                    <strong>{dup.name}</strong> ({dup.type}) - This contact will be updated with new information
                  </p>
                  {dup.email && <p className="text-xs">{dup.email}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <label htmlFor="type" className="block text-sm font-medium text-slate-700 mb-2">
            Type *
          </label>
          <select
            id="type"
            value={type}
            onChange={(e) => handleTypeChange(e.target.value as any)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="buyer">Buyer</option>
            <option value="realtor">Realtor</option>
            <option value="attorney">Attorney</option>
            <option value="loan_officer">Loan Officer</option>
            <option value="vendor">Vendor</option>
          </select>
        </div>

        <div>
          <label htmlFor="assignedTo" className="block text-sm font-medium text-slate-700 mb-2">
            Assign to Salesperson *
          </label>
          {isAdmin ? (
            <>
              <select
                id="assignedTo"
                value={selectedSalesperson}
                onChange={(e) => setSelectedSalesperson(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                required
              >
                {salespeople.map((sp) => (
                  <option key={sp.id} value={sp.id}>
                    {sp.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">As an admin, you can assign to any salesperson</p>
            </>
          ) : (
            <>
              <input
                id="assignedTo"
                type="text"
                value={salesPerson?.name || 'Loading...'}
                disabled
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
              />
              <p className="text-xs text-slate-500 mt-1">New contacts are automatically assigned to you</p>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-2">
              Phone
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="cellPhone" className="block text-sm font-medium text-slate-700 mb-2">
              Cell Phone
            </label>
            <input
              id="cellPhone"
              type="tel"
              value={cellPhone}
              onChange={(e) => setCellPhone(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
              Company
            </label>
            <input
              id="company"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="clientIdentifierNo" className="block text-sm font-medium text-slate-700 mb-2">
              Client Identifier No.
            </label>
            <input
              id="clientIdentifierNo"
              type="text"
              value={clientIdentifierNo}
              onChange={(e) => setClientIdentifierNo(e.target.value)}
              placeholder="Enter client identifier..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div>
            <label htmlFor="branch" className="block text-sm font-medium text-slate-700 mb-2">
              Branch
            </label>
            <select
              id="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">None</option>
              <option value="ETA 1">ETA 1</option>
              <option value="ETA 2">ETA 2</option>
              <option value="ETA 3">ETA 3</option>
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-slate-700 mb-2">
            Address
          </label>
          <input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="evidentParalegal" className="block text-sm font-medium text-slate-700 mb-2">
              Evident Paralegal
            </label>
            <select
              id="evidentParalegal"
              value={evidentParalegal}
              onChange={(e) => setEvidentParalegal(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="">None</option>
              <option value="Danielle">Danielle</option>
              <option value="Jahaira">Jahaira</option>
              <option value="Kristen">Kristen</option>
              <option value="Lisa">Lisa</option>
              <option value="Raphael">Raphael</option>
            </select>
          </div>
          <div>
            <label htmlFor="clientParalegalProcessor" className="block text-sm font-medium text-slate-700 mb-2">
              Client Paralegal/Processor
            </label>
            <input
              id="clientParalegalProcessor"
              type="text"
              value={clientParalegalProcessor}
              onChange={(e) => setClientParalegalProcessor(e.target.value)}
              placeholder="Enter client paralegal or processor name..."
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="birthday" className="block text-sm font-medium text-slate-700 mb-2">
              Birthday
            </label>
            <input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              placeholder="YYYY-MM-DD"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <p className="text-xs text-slate-500 mt-1">You can type the date (YYYY-MM-DD) or use the calendar</p>
          </div>

          <div>
            <label htmlFor="drinks" className="block text-sm font-medium text-slate-700 mb-2">
              Drinks?
            </label>
            <select
              id="drinks"
              value={drinks ? 'yes' : 'no'}
              onChange={(e) => setDrinks(e.target.value === 'yes')}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label htmlFor="clientType" className="block text-sm font-medium text-slate-700 mb-2">
              Client Type
            </label>
            <select
              id="clientType"
              value={clientType}
              onChange={(e) => setClientType(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="prospect">Prospect</option>
              <option value="client">Client</option>
            </select>
          </div>

          <div>
            <label htmlFor="grade" className="block text-sm font-medium text-slate-700 mb-2">
              Grade
            </label>
            <select
              id="grade"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </div>

          <div>
            <label htmlFor="marketingPoints" className="block text-sm font-medium text-slate-700 mb-2">
              Marketing Points
            </label>
            <input
              id="marketingPoints"
              type="number"
              value={marketingPoints || ''}
              onChange={(e) => setMarketingPoints(e.target.value === '' ? 0 : parseInt(e.target.value))}
              min="0"
              placeholder="0"
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {isAdminOrProcessor && (
          <div className="border-t border-amber-200 pt-5 mt-5">
            <h3 className="text-lg font-semibold text-amber-900 mb-4">Admin/Processor Only Fields</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label htmlFor="preferredSurveyor" className="block text-sm font-medium text-amber-700 mb-2">
                  Preferred Surveyor
                </label>
                <input
                  id="preferredSurveyor"
                  type="text"
                  value={preferredSurveyor}
                  onChange={(e) => setPreferredSurveyor(e.target.value)}
                  className="w-full px-4 py-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-amber-50"
                />
              </div>

              <div>
                <label htmlFor="preferredUw" className="block text-sm font-medium text-amber-700 mb-2">
                  Preferred UW
                </label>
                <input
                  id="preferredUw"
                  type="text"
                  value={preferredUw}
                  onChange={(e) => setPreferredUw(e.target.value)}
                  className="w-full px-4 py-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-amber-50"
                />
              </div>

              <div>
                <label htmlFor="preferredCloser" className="block text-sm font-medium text-amber-700 mb-2">
                  Preferred Closer
                </label>
                <input
                  id="preferredCloser"
                  type="text"
                  value={preferredCloser}
                  onChange={(e) => setPreferredCloser(e.target.value)}
                  className="w-full px-4 py-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all bg-amber-50"
                />
              </div>
            </div>

            <div className="mt-5">
              <label htmlFor="processorNotes" className="block text-sm font-medium text-amber-700 mb-2">
                Processor Notes
              </label>
              <textarea
                id="processorNotes"
                value={processorNotes}
                onChange={(e) => setProcessorNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes for processors and admins only..."
                className="w-full px-4 py-2.5 border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all resize-none bg-amber-50"
              />
            </div>
          </div>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-slate-700 mb-2">
            General Notes
          </label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="General notes visible to all users..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
          />
        </div>

        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
            Contact saved successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !selectedSalesperson}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          {loading ? 'Saving...' : duplicates.length > 0 ? 'Update Contact' : 'Add Prospect'}
        </button>
      </form>
    </div>
  );
}
