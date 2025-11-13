import { useState } from 'react';
import { Search, User, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { expandSearchTermWithNicknames } from '../lib/nicknameMapper';

interface Contact {
  id: string;
  name: string;
  type: 'buyer' | 'realtor' | 'attorney' | 'lender';
  email: string | null;
  phone: string | null;
  company: string | null;
  client_type: string | null;
  assigned_to: string | null;
  salesperson?: {
    name: string;
  } | null;
}

export function ConflictCheck() {
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Contact[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchTerm.trim()) return;

    setSearching(true);
    setHasSearched(true);

    try {
      const normalizedSearch = searchTerm.trim().replace(/\s+/g, ' ');
      const searchVariants = expandSearchTermWithNicknames(normalizedSearch);

      console.log('Original search:', normalizedSearch);
      console.log('Search variants:', searchVariants);

      const allContacts: Contact[] = [];
      const seenIds = new Set<string>();

      for (const variant of searchVariants) {
        const searchPattern = `%${variant.split(' ').join('%')}%`;

        const { data: contacts, error: contactsError } = await supabase
          .from('contacts')
          .select('id, name, type, email, phone, company, client_type, assigned_to')
          .ilike('name', searchPattern)
          .order('name');

        if (contactsError) {
          console.error('Supabase error fetching contacts:', contactsError);
          continue;
        }

        if (contacts) {
          for (const contact of contacts) {
            if (!seenIds.has(contact.id)) {
              seenIds.add(contact.id);
              allContacts.push(contact);
            }
          }
        }
      }

      console.log('Found contacts:', allContacts);

      if (allContacts.length === 0) {
        setResults([]);
        return;
      }

      const contactsWithSalespeople = await Promise.all(
        allContacts.map(async (contact) => {
          if (contact.assigned_to) {
            const { data: salesperson } = await supabase
              .from('sales_people')
              .select('name')
              .eq('id', contact.assigned_to)
              .maybeSingle();

            return { ...contact, salesperson };
          }
          return { ...contact, salesperson: null };
        })
      );

      console.log('Contacts with salespeople:', contactsWithSalespeople);
      setResults(contactsWithSalespeople);
    } catch (error) {
      console.error('Error searching contacts:', error);
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'buyer':
        return 'bg-blue-100 text-blue-800';
      case 'realtor':
        return 'bg-green-100 text-green-800';
      case 'attorney':
        return 'bg-amber-100 text-amber-800';
      case 'lender':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Search className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Conflict Check</h2>
            <p className="text-slate-600 text-sm mt-1">
              Check if a prospect is already in the system
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="mb-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Enter prospect name..."
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-slate-500 text-sm mt-1.5">
                * Please enter full name for the most accurate results
              </p>
            </div>
            <button
              type="submit"
              disabled={searching || !searchTerm.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
            >
              <Search className="w-5 h-5" />
              {searching ? 'Searching...' : 'Check'}
            </button>
          </div>
        </form>

        {hasSearched && (
          <div className="mt-6">
            {results.length === 0 ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-lg p-8 text-center">
                <div className="flex justify-center mb-4">
                  <div className="p-3 bg-green-100 rounded-full">
                    <CheckCircle className="w-12 h-12 text-green-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-green-900 mb-2">
                  Great! You've Found a New Prospect!
                </h3>
                <p className="text-green-800 text-lg leading-relaxed">
                  This contact is not in our system yet. Please contact <span className="font-semibold">Michele</span> to have them added to the system.
                </p>
                <p className="text-green-700 mt-3 font-medium">
                  Great job on finding a new future client!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">
                      Potential conflict detected! Found {results.length} matching contact{results.length > 1 ? 's' : ''} in the system:
                    </p>
                    <p className="mt-1 text-sm">
                      Please contact <span className="font-semibold">Michele Rivelli</span> to discuss further steps.
                    </p>
                  </div>
                </div>

                {results.map((contact) => (
                  <div
                    key={contact.id}
                    className="bg-slate-50 border border-slate-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                          <User className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-900">{contact.name}</h3>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(contact.type)}`}>
                            {contact.type.charAt(0).toUpperCase() + contact.type.slice(1)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      {contact.company && (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Company:</span> {contact.company}
                        </p>
                      )}
                      {contact.client_type && (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Client Type:</span> <span className="capitalize">{contact.client_type}</span>
                        </p>
                      )}
                      {contact.email && (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Email:</span> {contact.email}
                        </p>
                      )}
                      {contact.phone && (
                        <p className="text-sm text-slate-600">
                          <span className="font-medium">Phone:</span> {contact.phone}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                        <User className="w-4 h-4 text-blue-600" />
                        <p className="text-sm font-medium text-blue-900">
                          Assigned to: <span className="font-bold">{contact.salesperson?.name || 'Unassigned'}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
