import { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Building2, MapPin, FileText, Calendar, Plus, Edit2, Trash2, Save, Shield, Cake, Wine, Tag, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Contact {
  id: string;
  name: string;
  type: string;
  email?: string;
  phone?: string;
  company?: string;
  branch?: string;
  address?: string;
  paralegal?: string;
  preferred_surveyor?: string;
  preferred_uw?: string;
  preferred_closer?: string;
  birthday?: string;
  drinks?: boolean;
  client_type?: string;
  grade?: string;
  notes?: string;
  processor_notes?: string;
  created_at: string;
  assignments?: Array<{
    salesperson_id: string;
  }>;
}

interface Meeting {
  id: string;
  meeting_date: string;
  notes: string;
  created_at: string;
  salesperson_id: string;
  sales_people?: {
    name: string;
  };
}

interface ContactViewProps {
  contactId: string;
  onClose: () => void;
}

const typeLabels = {
  buyer: 'Buyer',
  realtor: 'Realtor',
  lender: 'Lender',
  attorney: 'Attorney',
};

export function ContactView({ contactId, onClose }: ContactViewProps) {
  const { user, salesPerson, isAdminOrProcessor } = useAuth();
  const [contact, setContact] = useState<Contact | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMeeting, setShowAddMeeting] = useState(false);
  const [meetingDate, setMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [savingMeeting, setSavingMeeting] = useState(false);
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null);
  const [editMeetingForm, setEditMeetingForm] = useState<{ date: string; notes: string }>({ date: '', notes: '' });
  const [isOwnContact, setIsOwnContact] = useState(false);

  useEffect(() => {
    loadContactData();
  }, [contactId]);

  const loadContactData = async () => {
    setLoading(true);
    try {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('*, assignments(salesperson_id)')
        .eq('id', contactId)
        .single();

      if (contactError) throw contactError;
      setContact(contactData);

      const isOwn = contactData.assignments?.some(
        (assignment: any) => assignment.salesperson_id === salesPerson?.id
      ) || false;
      setIsOwnContact(isOwn);

      const { data: meetingsData, error: meetingsError } = await supabase
        .from('meetings')
        .select('*, sales_people(name)')
        .eq('contact_id', contactId)
        .order('meeting_date', { ascending: false });

      if (meetingsError) throw meetingsError;
      setMeetings(meetingsData || []);
    } catch (error) {
      console.error('Error loading contact data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salesPerson?.id || !meetingNotes.trim()) return;

    setSavingMeeting(true);
    try {
      const { error } = await supabase
        .from('meetings')
        .insert({
          contact_id: contactId,
          salesperson_id: salesPerson.id,
          meeting_date: meetingDate,
          notes: meetingNotes,
          created_by: salesPerson.user_id,
        });

      if (error) throw error;

      setMeetingNotes('');
      setMeetingDate(new Date().toISOString().split('T')[0]);
      setShowAddMeeting(false);
      loadContactData();
    } catch (error: any) {
      console.error('Error adding meeting:', error);
      alert('Failed to add meeting: ' + error.message);
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setEditingMeetingId(meeting.id);
    setEditMeetingForm({
      date: meeting.meeting_date,
      notes: meeting.notes,
    });
  };

  const handleSaveMeeting = async (meetingId: string) => {
    try {
      const { error } = await supabase
        .from('meetings')
        .update({
          meeting_date: editMeetingForm.date,
          notes: editMeetingForm.notes,
        })
        .eq('id', meetingId);

      if (error) throw error;

      setEditingMeetingId(null);
      setEditMeetingForm({ date: '', notes: '' });
      loadContactData();
    } catch (error: any) {
      console.error('Error updating meeting:', error);
      alert('Failed to update meeting: ' + error.message);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('Are you sure you want to delete this meeting?')) return;

    try {
      const { error } = await supabase
        .from('meetings')
        .delete()
        .eq('id', meetingId);

      if (error) throw error;
      loadContactData();
    } catch (error: any) {
      console.error('Error deleting meeting:', error);
      alert('Failed to delete meeting: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <p className="text-center text-slate-600">Loading contact details...</p>
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4">
          <p className="text-center text-red-600">Contact not found</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors mx-auto block"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full mx-4 my-8">
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-xl flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-900">Contact Details</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[calc(100vh-200px)] overflow-y-auto">
          <div className="bg-slate-50 rounded-lg p-6">
            <div className="flex items-start gap-4">
              <div className="bg-blue-100 rounded-full p-3">
                <User className="w-8 h-8 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-slate-900 mb-1">{contact.name}</h3>
                <span className="inline-block px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-full">
                  {typeLabels[contact.type as keyof typeof typeLabels]}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {contact.email && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Mail className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Email</p>
                  <p className="text-slate-900">{contact.email}</p>
                </div>
              </div>
            )}

            {contact.phone && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Phone className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Phone</p>
                  <p className="text-slate-900">{contact.phone}</p>
                </div>
              </div>
            )}

            {contact.company && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Company</p>
                  <p className="text-slate-900">{contact.company}</p>
                </div>
              </div>
            )}

            {contact.branch && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Building2 className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Branch</p>
                  <p className="text-slate-900">{contact.branch}</p>
                </div>
              </div>
            )}

            {contact.address && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg md:col-span-2">
                <MapPin className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Address</p>
                  <p className="text-slate-900">{contact.address}</p>
                </div>
              </div>
            )}

            {contact.paralegal && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <User className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Paralegal</p>
                  <p className="text-slate-900">{contact.paralegal}</p>
                </div>
              </div>
            )}

            {contact.birthday && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Cake className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Birthday</p>
                  <p className="text-slate-900">{new Date(contact.birthday).toLocaleDateString()}</p>
                </div>
              </div>
            )}

            {contact.client_type && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Tag className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Client Type</p>
                  <p className="text-slate-900 capitalize">{contact.client_type}</p>
                </div>
              </div>
            )}

            {contact.grade && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Star className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Grade</p>
                  <p className="text-slate-900">{contact.grade}</p>
                </div>
              </div>
            )}

            {contact.drinks !== null && contact.drinks !== undefined && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <Wine className="w-5 h-5 text-slate-600" />
                <div>
                  <p className="text-xs text-slate-500 font-medium">Drinks</p>
                  <p className="text-slate-900">{contact.drinks ? 'Yes' : 'No'}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_surveyor && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred Surveyor</p>
                  <p className="text-slate-900">{contact.preferred_surveyor}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_uw && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred UW</p>
                  <p className="text-slate-900">{contact.preferred_uw}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.preferred_closer && (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <Shield className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="text-xs text-amber-700 font-medium">Preferred Closer</p>
                  <p className="text-slate-900">{contact.preferred_closer}</p>
                </div>
              </div>
            )}

            {contact.notes && (
              <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg md:col-span-2">
                <FileText className="w-5 h-5 text-slate-600 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 font-medium mb-1">General Notes</p>
                  <p className="text-slate-900 whitespace-pre-wrap">{contact.notes}</p>
                </div>
              </div>
            )}

            {isAdminOrProcessor && contact.processor_notes && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg md:col-span-2">
                <Shield className="w-5 h-5 text-amber-600 mt-1" />
                <div className="flex-1">
                  <p className="text-xs text-amber-700 font-medium mb-1">Processor Notes (Admin/Processor Only)</p>
                  <p className="text-slate-900 whitespace-pre-wrap">{contact.processor_notes}</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Meetings
              </h3>
              {!showAddMeeting && (isOwnContact || isAdminOrProcessor) && (
                <button
                  onClick={() => setShowAddMeeting(true)}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Log Meeting
                </button>
              )}
            </div>

            {showAddMeeting && (isOwnContact || isAdminOrProcessor) && (
              <form onSubmit={handleAddMeeting} className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <h4 className="font-semibold text-slate-900 mb-3">Log New Meeting</h4>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Meeting Date *
                    </label>
                    <input
                      type="date"
                      value={meetingDate}
                      onChange={(e) => setMeetingDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Meeting Notes *
                    </label>
                    <textarea
                      value={meetingNotes}
                      onChange={(e) => setMeetingNotes(e.target.value)}
                      rows={4}
                      placeholder="What was discussed during the meeting?"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={savingMeeting}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {savingMeeting ? 'Saving...' : 'Save Meeting'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMeeting(false);
                        setMeetingNotes('');
                        setMeetingDate(new Date().toISOString().split('T')[0]);
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </form>
            )}

            {meetings.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No meetings logged yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((meeting) => (
                  <div
                    key={meeting.id}
                    className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    {editingMeetingId === meeting.id ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Meeting Date
                          </label>
                          <input
                            type="date"
                            value={editMeetingForm.date}
                            onChange={(e) => setEditMeetingForm({ ...editMeetingForm, date: e.target.value })}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-1">
                            Meeting Notes
                          </label>
                          <textarea
                            value={editMeetingForm.notes}
                            onChange={(e) => setEditMeetingForm({ ...editMeetingForm, notes: e.target.value })}
                            rows={4}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveMeeting(meeting.id)}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Save className="w-4 h-4" />
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setEditingMeetingId(null);
                              setEditMeetingForm({ date: '', notes: '' });
                            }}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-slate-900">
                              {new Date(meeting.meeting_date).toLocaleDateString('en-US', {
                                weekday: 'short',
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditMeeting(meeting)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMeeting(meeting.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap">{meeting.notes}</p>
                        <div className="mt-2 text-xs text-slate-500">
                          Logged by {meeting.sales_people?.name || 'Unknown'} on{' '}
                          {new Date(meeting.created_at).toLocaleDateString()}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
