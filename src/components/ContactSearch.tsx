import { useState } from 'react';
import { Search, User, Users, Briefcase, Scale, Edit2, X, Save, Eye } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ContactView } from './ContactView';

interface SearchResult {
  id: string;
  name: string;
  type: string;
  salesPerson: string;
  salesPersonId?: string;
  branch?: string;
  email?: string;
  phone?: string;
  company?: string;
  address?: string;
  paralegal?: string;
  preferred_surveyor?: string;
  preferred_uw?: string;
  preferred_closer?: string;
  birthday?: string;
  drinks?: boolean;
  notes?: string;
  processor_notes?: string;
}

interface SearchFilters {
  buyer: string;
  realtor: string;
  attorney: string;
  lender: string;
}

const typeIcons = {
  buyer: User,
  realtor: Users,
  lender: Briefcase,
  attorney: Scale,
};

const typeLabels = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  lender: 'Lender',
  attorney: 'Attorney',
};

const typePriority = {
  buyer: 1,
  realtor: 2,
  attorney: 3,
  lender: 4,
};

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  if (s1 === s2) return 1;
  if (s1.includes(s2) || s2.includes(s1)) return 0.8;

  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(s1, s2);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

export function ContactSearch() {
  const { salesPerson, isAdminOrProcessor } = useAuth();
  const [filters, setFilters] = useState<SearchFilters>({
    buyer: '',
    realtor: '',
    attorney: '',
    lender: '',
  });
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [crossoverPerson, setCrossoverPerson] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<SearchResult>>({});
  const [viewingContactId, setViewingContactId] = useState<string | null>(null);

  const handleFilterChange = (type: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [type]: value }));
  };

  const hasAnyFilter = () => {
    return Object.values(filters).some(val => val.trim().length > 0);
  };

  const getFilledFilterCount = () => {
    return Object.values(filters).filter(val => val.trim().length > 0).length;
  };

  const handleSearch = async () => {
    if (!hasAnyFilter()) return;

    setLoading(true);
    setCrossoverPerson(null);

    try {
      const { data: allContacts, error } = await supabase
        .from('contacts')
        .select(`
          id,
          name,
          type,
          email,
          phone,
          company,
          branch,
          address,
          paralegal,
          preferred_surveyor,
          preferred_uw,
          preferred_closer,
          birthday,
          drinks,
          notes,
          processor_notes,
          assigned_to,
          assignments (
            sales_people (
              id,
              name
            )
          )
        `);

      if (error) throw error;

      const matchedContacts: Map<string, any> = new Map();
      const SIMILARITY_THRESHOLD = 0.6;

      if (allContacts) {
        Object.entries(filters).forEach(([type, searchTerm]) => {
          if (!searchTerm.trim()) return;

          const contactsOfType = allContacts.filter(c => c.type === type);

          contactsOfType.forEach(contact => {
            const similarity = calculateSimilarity(contact.name, searchTerm.trim());

            if (similarity >= SIMILARITY_THRESHOLD) {
              const existingMatch = matchedContacts.get(contact.id);
              if (!existingMatch || similarity > existingMatch.similarity) {
                matchedContacts.set(contact.id, {
                  ...contact,
                  similarity,
                  matchedType: type,
                });
              }
            }
          });
        });

        const formattedResults: SearchResult[] = Array.from(matchedContacts.values())
          .map((contact: any) => ({
            id: contact.id,
            name: contact.name,
            type: contact.type,
            salesPerson: contact.assignments?.[0]?.sales_people?.name || 'Unassigned',
            salesPersonId: contact.assignments?.[0]?.sales_people?.id,
            branch: contact.branch,
            email: contact.email,
            phone: contact.phone,
            company: contact.company,
            address: contact.address,
            paralegal: contact.paralegal,
            preferred_surveyor: contact.preferred_surveyor,
            preferred_uw: contact.preferred_uw,
            preferred_closer: contact.preferred_closer,
            birthday: contact.birthday,
            drinks: contact.drinks,
            notes: contact.notes,
            processor_notes: contact.processor_notes,
          }));

        formattedResults.sort((a, b) => {
          return (typePriority[a.type as keyof typeof typePriority] || 999) -
                 (typePriority[b.type as keyof typeof typePriority] || 999);
        });

        setResults(formattedResults);

        const salesPeople = formattedResults
          .map(r => r.salesPerson)
          .filter(sp => sp !== 'Unassigned');

        const uniqueSalesPeople = [...new Set(salesPeople)];

        if (uniqueSalesPeople.length > 1) {
          const salesPersonCounts = salesPeople.reduce((acc: Record<string, number>, sp) => {
            acc[sp] = (acc[sp] || 0) + 1;
            return acc;
          }, {});

          const maxCount = Math.max(...Object.values(salesPersonCounts));
          const crossovers = Object.entries(salesPersonCounts)
            .filter(([_, count]) => count === maxCount)
            .map(([name]) => name);

          if (crossovers.length === 1) {
            setCrossoverPerson(crossovers[0]);
          } else {
            setCrossoverPerson(crossovers.join(' & '));
          }
        }
      } else {
        setResults([]);
      }
    } catch (error: any) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setFilters({
      buyer: '',
      realtor: '',
      attorney: '',
      lender: '',
    });
    setResults([]);
    setCrossoverPerson(null);
  };


  const handleEdit = (result: SearchResult) => {
    setEditingId(result.id);
    setEditForm({
      name: result.name,
      email: result.email || '',
      phone: result.phone || '',
      company: result.company || '',
      branch: result.branch || '',
      address: result.address || '',
      paralegal: result.paralegal || '',
      preferred_surveyor: result.preferred_surveyor || '',
      preferred_uw: result.preferred_uw || '',
      preferred_closer: result.preferred_closer || '',
      birthday: result.birthday || '',
      drinks: result.drinks ?? false,
      notes: result.notes || '',
      processor_notes: result.processor_notes || '',
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const handleSaveEdit = async (contactId: string) => {
    try {
      const { error } = await supabase
        .from('contacts')
        .update({
          name: editForm.name,
          email: editForm.email,
          phone: editForm.phone,
          company: editForm.company,
          branch: editForm.branch,
          address: editForm.address,
          paralegal: editForm.paralegal || null,
          preferred_surveyor: editForm.preferred_surveyor || null,
          preferred_uw: editForm.preferred_uw || null,
          preferred_closer: editForm.preferred_closer || null,
          birthday: editForm.birthday || null,
          drinks: editForm.drinks ?? null,
          notes: editForm.notes,
          processor_notes: editForm.processor_notes,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', contactId);

      if (error) throw error;

      setResults(prevResults =>
        prevResults.map(r =>
          r.id === contactId
            ? { ...r, ...editForm }
            : r
        )
      );

      setEditingId(null);
      setEditForm({});
    } catch (error: any) {
      console.error('Error updating contact:', error);
      alert('Failed to update contact: ' + error.message);
    }
  };

  const canEdit = (result: SearchResult) => {
    return result.salesPersonId === salesPerson?.id;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Search Contacts</h2>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-900">
          Enter names in any or all fields below. Fuzzy search will match similar names even with misspellings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label htmlFor="buyer" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-slate-600" />
            Buyer Name
          </label>
          <input
            id="buyer"
            type="text"
            value={filters.buyer}
            onChange={(e) => handleFilterChange('buyer', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter buyer name..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="realtor" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-600" />
            Realtor Name
          </label>
          <input
            id="realtor"
            type="text"
            value={filters.realtor}
            onChange={(e) => handleFilterChange('realtor', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter realtor name..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="attorney" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Scale className="w-4 h-4 text-slate-600" />
            Attorney Name
          </label>
          <input
            id="attorney"
            type="text"
            value={filters.attorney}
            onChange={(e) => handleFilterChange('attorney', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter attorney name..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div>
          <label htmlFor="lender" className="block text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-600" />
            Lender Name
          </label>
          <input
            id="lender"
            type="text"
            value={filters.lender}
            onChange={(e) => handleFilterChange('lender', e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter lender name..."
            className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleSearch}
          disabled={loading || !hasAnyFilter()}
          className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Search className="w-5 h-5" />
          {loading ? 'Searching...' : 'Search'}
        </button>
        <button
          onClick={handleClear}
          disabled={loading}
          className="px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors disabled:bg-slate-100"
        >
          Clear
        </button>
      </div>

      {results.length > 0 && getFilledFilterCount() > 1 && (
        <div className="mb-6 p-5 bg-gradient-to-r from-blue-50 to-slate-50 border-2 border-blue-300 rounded-lg shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
            <p className="text-sm font-semibold text-slate-700">Primary Salesperson (by hierarchy):</p>
          </div>
          <p className="text-2xl font-bold text-blue-700 mb-3">
            {results[0].salesPerson}
          </p>
          {results.length > 1 && (() => {
            const salesPeople = results.map(r => r.salesPerson).filter(sp => sp !== 'Unassigned');
            const uniqueSalesPeople = [...new Set(salesPeople)];
            const crossovers = uniqueSalesPeople.filter(sp => sp !== results[0].salesPerson);

            if (crossovers.length > 0) {
              return (
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-sm font-medium text-slate-600 mb-1">Additional Salespeople (crossovers):</p>
                  <p className="text-base font-semibold text-amber-700">{crossovers.join(', ')}</p>
                </div>
              );
            }
            return null;
          })()}
        </div>
      )}

      {results.length > 0 ? (
        <div className="space-y-3">
          {results.map((result, index) => {
            const Icon = typeIcons[result.type as keyof typeof typeIcons];
            const isEditing = editingId === result.id;
            const userCanEdit = canEdit(result);

            return (
              <div
                key={index}
                className="p-4 border border-slate-200 rounded-lg hover:shadow-md transition-shadow"
              >
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-slate-100 rounded-lg p-2">
                          <Icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-900">Editing Contact</h3>
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {typeLabels[result.type as keyof typeof typeLabels]}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveEdit(result.id)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm"
                        >
                          <Save className="w-4 h-4" />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
                        >
                          <X className="w-4 h-4" />
                          Cancel
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Name</label>
                        <input
                          type="text"
                          value={editForm.name || ''}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Email</label>
                        <input
                          type="email"
                          value={editForm.email || ''}
                          onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Phone</label>
                        <input
                          type="tel"
                          value={editForm.phone || ''}
                          onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Company</label>
                        <input
                          type="text"
                          value={editForm.company || ''}
                          onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Branch</label>
                        <input
                          type="text"
                          value={editForm.branch || ''}
                          onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-slate-700 mb-1">Address</label>
                        <input
                          type="text"
                          value={editForm.address || ''}
                          onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Paralegal</label>
                        <select
                          value={editForm.paralegal || ''}
                          onChange={(e) => setEditForm({ ...editForm, paralegal: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="">None</option>
                          <option value="Kristen">Kristen</option>
                          <option value="Lisa">Lisa</option>
                          <option value="Raphael">Raphael</option>
                          <option value="Danielle">Danielle</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Birthday</label>
                        <input
                          type="date"
                          value={editForm.birthday || ''}
                          onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Drinks?</label>
                        <select
                          value={editForm.drinks ? 'yes' : 'no'}
                          onChange={(e) => setEditForm({ ...editForm, drinks: e.target.value === 'yes' })}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </div>
                    </div>

                    {isAdminOrProcessor && (
                      <div className="border-t border-slate-200 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-slate-700 mb-3">Admin/Processor Only Fields</h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Surveyor</label>
                            <input
                              type="text"
                              value={editForm.preferred_surveyor || ''}
                              onChange={(e) => setEditForm({ ...editForm, preferred_surveyor: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Preferred UW</label>
                            <input
                              type="text"
                              value={editForm.preferred_uw || ''}
                              onChange={(e) => setEditForm({ ...editForm, preferred_uw: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Preferred Closer</label>
                            <input
                              type="text"
                              value={editForm.preferred_closer || ''}
                              onChange={(e) => setEditForm({ ...editForm, preferred_closer: e.target.value })}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                          <div className="md:col-span-3">
                            <label className="block text-xs font-medium text-slate-700 mb-1">Processor Notes</label>
                            <textarea
                              value={editForm.processor_notes || ''}
                              onChange={(e) => setEditForm({ ...editForm, processor_notes: e.target.value })}
                              rows={2}
                              placeholder="Internal notes for processors and admins only..."
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={editForm.notes || ''}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        rows={3}
                        placeholder="General notes visible to all users..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="bg-slate-100 rounded-lg p-2 mt-1">
                        <Icon className="w-5 h-5 text-slate-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-900">{result.name}</h3>
                          <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                            {typeLabels[result.type as keyof typeof typeLabels]}
                          </span>
                        </div>
                        <div className="text-sm text-slate-600 space-y-1">
                          {result.branch && <p>Branch: {result.branch}</p>}
                          {result.email && <p>Email: {result.email}</p>}
                          {result.phone && <p>Phone: {result.phone}</p>}
                          {result.company && <p>Company: {result.company}</p>}
                          {result.address && <p>Address: {result.address}</p>}
                          {result.paralegal && <p>Paralegal: {result.paralegal}</p>}
                          {result.birthday && <p>Birthday: {new Date(result.birthday).toLocaleDateString()}</p>}
                          {result.drinks !== null && result.drinks !== undefined && <p>Drinks: {result.drinks ? 'Yes' : 'No'}</p>}
                          {isAdminOrProcessor && result.preferred_surveyor && (
                            <p className="text-amber-700 font-medium">Preferred Surveyor: {result.preferred_surveyor}</p>
                          )}
                          {isAdminOrProcessor && result.preferred_uw && (
                            <p className="text-amber-700 font-medium">Preferred UW: {result.preferred_uw}</p>
                          )}
                          {isAdminOrProcessor && result.preferred_closer && (
                            <p className="text-amber-700 font-medium">Preferred Closer: {result.preferred_closer}</p>
                          )}
                          {result.notes && <p>Notes: {result.notes}</p>}
                          {isAdminOrProcessor && result.processor_notes && (
                            <p className="text-amber-700 font-medium">Processor Notes: {result.processor_notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-500 mb-1">Assigned to</p>
                        <p className="font-semibold text-blue-600">{result.salesPerson}</p>
                      </div>
                      <div className="flex gap-2">
                        {isAdminOrProcessor && (
                          <button
                            onClick={() => setViewingContactId(result.id)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                        )}
                        {userCanEdit && (
                          <button
                            onClick={() => handleEdit(result)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : hasAnyFilter() && !loading ? (
        <div className="text-center py-12 text-slate-500">
          <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No contacts found matching your search criteria</p>
        </div>
      ) : null}

      {viewingContactId && (
        <ContactView
          contactId={viewingContactId}
          onClose={() => setViewingContactId(null)}
        />
      )}
    </div>
  );
}
