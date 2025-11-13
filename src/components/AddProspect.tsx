import { useState, useEffect } from 'react';
import { UserPlus, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { formatContactData } from '../lib/formatters';

export function AddProspect() {
  const [name, setName] = useState('');
  const [type, setType] = useState<'buyer' | 'realtor' | 'attorney' | 'lender'>('buyer');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [branch, setBranch] = useState('');
  const [address, setAddress] = useState('');
  const [paralegal, setParalegal] = useState('');
  const [preferredSurveyor, setPreferredSurveyor] = useState('');
  const [preferredUw, setPreferredUw] = useState('');
  const [preferredCloser, setPreferredCloser] = useState('');
  const [birthday, setBirthday] = useState('');
  const [drinks, setDrinks] = useState(true);
  const [clientType, setClientType] = useState('');
  const [grade, setGrade] = useState('');
  const [notes, setNotes] = useState('');
  const [processorNotes, setProcessorNotes] = useState('');
  const [checking, setChecking] = useState(false);
  const [existingContact, setExistingContact] = useState<{ name: string; type: string } | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [salespeople, setSalespeople] = useState<{ id: string; name: string }[]>([]);
  const [selectedSalesperson, setSelectedSalesperson] = useState('');
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



  const checkExisting = async (searchName: string) => {
    if (!searchName.trim()) {
      setExistingContact(null);
      setShowDuplicateWarning(false);
      return;
    }

    setChecking(true);

    const normalizedSearch = searchName.trim().toLowerCase().replace(/\s+/g, ' ');

    const { data: allContacts } = await supabase
      .from('contacts')
      .select('name, type');

    const duplicate = allContacts?.find(contact => {
      const normalizedContact = contact.name.toLowerCase().replace(/\s+/g, ' ');
      return normalizedContact === normalizedSearch;
    });

    setExistingContact(duplicate || null);
    setShowDuplicateWarning(false);
    setChecking(false);
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (value.length >= 3) {
      checkExisting(value);
    } else {
      setExistingContact(null);
    }
  };

  const handleTypeChange = (newType: 'buyer' | 'realtor' | 'attorney' | 'lender') => {
    setType(newType);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSalesperson) return;

    if (existingContact && !showDuplicateWarning) {
      setShowDuplicateWarning(true);
      return;
    }

    setLoading(true);
    setSuccess(false);

    try {
      const formattedData = formatContactData({
        name,
        email: email || null,
        phone: phone || null,
        company: company || null,
        branch: branch || null,
        address: address || null,
        paralegal: paralegal || null,
        notes: notes || null,
      });

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert({
          ...formattedData,
          type,
          assigned_to: selectedSalesperson,
          created_by: user?.id,
          updated_by: user?.id,
          preferred_surveyor: preferredSurveyor || null,
          preferred_uw: preferredUw || null,
          preferred_closer: preferredCloser || null,
          birthday: birthday || null,
          drinks,
          client_type: clientType || null,
          grade: grade || null,
          processor_notes: processorNotes || null,
        })
        .select()
        .single();

      if (contactError) throw contactError;

      if (contact) {
        const { error: assignError } = await supabase
          .from('assignments')
          .insert({
            contact_id: contact.id,
            salesperson_id: selectedSalesperson,
            assigned_by: user?.id,
          });

        if (assignError) throw assignError;
      }

      setSuccess(true);
      setName('');
      setEmail('');
      setPhone('');
      setCompany('');
      setBranch('');
      setAddress('');
      setParalegal('');
      setPreferredSurveyor('');
      setPreferredUw('');
      setPreferredCloser('');
      setBirthday('');
      setDrinks(true);
      setClientType('');
      setGrade('');
      setNotes('');
      setProcessorNotes('');
      setType('buyer');
      setExistingContact(null);
      setShowDuplicateWarning(false);

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
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Add New Prospect</h2>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
            Name *
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            required
          />
          {checking && (
            <p className="text-sm text-slate-500 mt-1">Checking database...</p>
          )}
          {existingContact && !showDuplicateWarning && (
            <div className="mt-2 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4" />
              <span>A contact with this name already exists as a {existingContact.type}</span>
            </div>
          )}
        </div>

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
            <option value="lender">Lender</option>
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
            <label htmlFor="branch" className="block text-sm font-medium text-slate-700 mb-2">
              Branch
            </label>
            <input
              id="branch"
              type="text"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
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

        <div>
          <label htmlFor="paralegal" className="block text-sm font-medium text-slate-700 mb-2">
            Paralegal
          </label>
          <select
            id="paralegal"
            value={paralegal}
            onChange={(e) => setParalegal(e.target.value)}
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">None</option>
            <option value="Kristen">Kristen</option>
            <option value="Lisa">Lisa</option>
            <option value="Raphael">Raphael</option>
            <option value="Danielle">Danielle</option>
          </select>
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
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
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
              <option value="">None</option>
              <option value="retail">Retail</option>
              <option value="commercial">Commercial</option>
              <option value="refinance">Refinance</option>
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
              <option value="">None</option>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="F">F</option>
            </select>
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
            Prospect added successfully!
          </div>
        )}

        {showDuplicateWarning && existingContact && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-900 mb-1">Duplicate Contact Warning</p>
                <p className="text-sm text-red-800">
                  A contact with the name <strong>"{existingContact.name}"</strong> already exists in the database as a <strong>{existingContact.type}</strong>.
                </p>
                <p className="text-sm text-red-800 mt-2">
                  Are you sure you want to add this duplicate contact?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDuplicateWarning(false)}
                className="flex-1 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-lg border border-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Adding...' : 'Yes, Add Anyway'}
              </button>
            </div>
          </div>
        )}

        {!showDuplicateWarning && (
          <button
            type="submit"
            disabled={loading || !selectedSalesperson}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            {loading ? 'Adding Prospect...' : 'Add Prospect'}
          </button>
        )}
      </form>
    </div>
  );
}
