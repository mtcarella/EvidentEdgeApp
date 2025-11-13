import { useState } from 'react';
import { Save, X, User, Users, Briefcase, Scale } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatContactData } from '../lib/formatters';

interface ContactEditModalProps {
  contact: any;
  salesPeople: any[];
  isAdminOrProcessor: boolean;
  isAdmin: boolean;
  onSave: () => void;
  onCancel: () => void;
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

export function ContactEditModal({ contact, salesPeople, isAdminOrProcessor, isAdmin, onSave, onCancel }: ContactEditModalProps) {
  const [editForm, setEditForm] = useState({
    name: contact.name || '',
    email: contact.email || '',
    phone: contact.phone || '',
    company: contact.company || '',
    branch: contact.branch || '',
    address: contact.address || '',
    paralegal: contact.paralegal || '',
    preferred_surveyor: contact.preferred_surveyor || '',
    preferred_uw: contact.preferred_uw || '',
    preferred_closer: contact.preferred_closer || '',
    birthday: contact.birthday || '',
    drinks: contact.drinks ?? false,
    notes: contact.notes || '',
    processor_notes: contact.processor_notes || '',
    client_type: contact.client_type || 'prospect',
    grade: contact.grade || 'C',
    newSalespersonId: contact.assignments?.[0]?.salesperson_id || contact.assigned_to || '',
  });
  const [saving, setSaving] = useState(false);

  const Icon = typeIcons[contact.type as keyof typeof typeIcons];

  const handleSave = async () => {
    setSaving(true);
    try {
      const formattedData = formatContactData({
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
        drinks: editForm.drinks,
        notes: editForm.notes,
        processor_notes: editForm.processor_notes,
        client_type: editForm.client_type,
        grade: editForm.grade,
      });

      const { error: contactError } = await supabase
        .from('contacts')
        .update({
          ...formattedData,
          assigned_to: editForm.newSalespersonId || null,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .eq('id', contact.id);

      if (contactError) {
        console.error('Error updating contact:', contactError);
        throw new Error(`Failed to update contact: ${contactError.message}`);
      }

      // Handle assignment changes
      const { data: existingAssignment } = await supabase
        .from('assignments')
        .select('id')
        .eq('contact_id', contact.id)
        .maybeSingle();

      const currentUserId = (await supabase.auth.getUser()).data.user?.id;

      if (editForm.newSalespersonId) {
        // Assigning to someone
        if (existingAssignment) {
          // Update existing assignment
          const { error: updateError } = await supabase
            .from('assignments')
            .update({
              salesperson_id: editForm.newSalespersonId,
              assigned_by: currentUserId
            })
            .eq('contact_id', contact.id);

          if (updateError) {
            console.error('Error updating assignment:', updateError);
            throw new Error(`Failed to update assignment: ${updateError.message}`);
          }
        } else {
          // Create new assignment
          const { error: insertError } = await supabase
            .from('assignments')
            .insert({
              contact_id: contact.id,
              salesperson_id: editForm.newSalespersonId,
              assigned_by: currentUserId,
            });

          if (insertError) {
            console.error('Error creating assignment:', insertError);
            throw new Error(`Failed to create assignment: ${insertError.message}`);
          }
        }
      } else if (existingAssignment) {
        // Unassigning (newSalespersonId is null/empty) - delete assignment
        const { error: deleteError } = await supabase
          .from('assignments')
          .delete()
          .eq('contact_id', contact.id);

        if (deleteError) {
          console.error('Error deleting assignment:', deleteError);
          throw new Error(`Failed to delete assignment: ${deleteError.message}`);
        }
      }

      console.log('Contact and assignment updated successfully');
      onSave();
    } catch (error: any) {
      console.error('Error updating contact:', error);
      alert('Failed to update contact: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-slate-100 rounded-lg p-2">
              <Icon className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-slate-900">Edit Contact</h3>
              <span className="text-sm font-medium px-2 py-1 bg-slate-100 text-slate-700 rounded">
                {typeLabels[contact.type as keyof typeof typeLabels]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg transition-colors text-sm"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
              <input
                type="text"
                value={editForm.company}
                onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
              <input
                type="text"
                value={editForm.branch}
                onChange={(e) => setEditForm({ ...editForm, branch: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Paralegal</label>
              {isAdmin ? (
                <select
                  value={editForm.paralegal}
                  onChange={(e) => setEditForm({ ...editForm, paralegal: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">None</option>
                  <option value="Kristen">Kristen</option>
                  <option value="Lisa">Lisa</option>
                  <option value="Raphael">Raphael</option>
                  <option value="Danielle">Danielle</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={editForm.paralegal || 'None'}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Assigned To</label>
              {isAdmin ? (
                <select
                  value={editForm.newSalespersonId}
                  onChange={(e) => setEditForm({ ...editForm, newSalespersonId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Unassigned</option>
                  {salesPeople.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={salesPeople.find(sp => sp.id === editForm.newSalespersonId)?.name || 'Unassigned'}
                  disabled
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 text-slate-600 cursor-not-allowed"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Birthday</label>
              <input
                type="date"
                value={editForm.birthday}
                onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Drinks?</label>
              <select
                value={editForm.drinks ? 'yes' : 'no'}
                onChange={(e) => setEditForm({ ...editForm, drinks: e.target.value === 'yes' })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Client Type</label>
              <select
                value={editForm.client_type}
                onChange={(e) => setEditForm({ ...editForm, client_type: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="prospect">Prospect</option>
                <option value="client">Client</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Grade</label>
              <select
                value={editForm.grade}
                onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
              <input
                type="text"
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {isAdminOrProcessor && (
            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">Admin/Processor Only Fields</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Surveyor</label>
                  <input
                    type="text"
                    value={editForm.preferred_surveyor}
                    onChange={(e) => setEditForm({ ...editForm, preferred_surveyor: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred UW</label>
                  <input
                    type="text"
                    value={editForm.preferred_uw}
                    onChange={(e) => setEditForm({ ...editForm, preferred_uw: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Preferred Closer</label>
                  <input
                    type="text"
                    value={editForm.preferred_closer}
                    onChange={(e) => setEditForm({ ...editForm, preferred_closer: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium text-slate-700 mb-1">Processor Notes</label>
                <textarea
                  value={editForm.processor_notes}
                  onChange={(e) => setEditForm({ ...editForm, processor_notes: e.target.value })}
                  rows={3}
                  placeholder="Internal notes for processors and admins only..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
            <textarea
              value={editForm.notes}
              onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
              rows={4}
              placeholder="General notes visible to all users..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
