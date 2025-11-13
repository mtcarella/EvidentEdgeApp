import { useState } from 'react';
import { Upload, CheckCircle, XCircle, Eye, FileDown } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

interface ParsedContact {
  name: string;
  type: string;
  email?: string;
  phone?: string;
  company?: string;
  branch?: string;
  address?: string;
  salesperson?: string;
  drinks?: boolean;
  rowNumber: number;
}

export function ImportData() {
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<ParsedContact[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [processing, setProcessing] = useState(false);
  const { user } = useAuth();

  const detectNameColumns = (headers: string[]): { firstName?: string; lastName?: string; fullName?: string } => {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    const firstNameVariations = ['first name', 'firstname', 'first', 'fname', 'given name', 'givenname'];
    const lastNameVariations = ['last name', 'lastname', 'last', 'lname', 'surname', 'family name', 'familyname'];
    const fullNameVariations = ['name', 'full name', 'fullname', 'contact name', 'contactname', 'client name', 'clientname'];

    let firstNameCol = headers.find((h, i) => firstNameVariations.includes(lowerHeaders[i]));
    let lastNameCol = headers.find((h, i) => lastNameVariations.includes(lowerHeaders[i]));
    let fullNameCol = headers.find((h, i) => fullNameVariations.includes(lowerHeaders[i]));

    return {
      firstName: firstNameCol,
      lastName: lastNameCol,
      fullName: fullNameCol,
    };
  };

  const detectAddressColumns = (headers: string[]): string[] => {
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());

    const addressVariations = [
      'address', 'street', 'street address', 'address line 1', 'address1', 'addr',
      'city', 'town',
      'state', 'province', 'region',
      'zip', 'zipcode', 'zip code', 'postal', 'postal code', 'postalcode'
    ];

    return headers.filter((h, i) => addressVariations.includes(lowerHeaders[i]));
  };

  const parseCSV = (text: string): { headers: string[]; rows: any[] } => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
    const rows: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
      const row: any = {};

      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });

      rows.push(row);
    }

    return { headers, rows };
  };

  const convertCSVData = (headers: string[], rows: any[]): ParsedContact[] => {
    const nameColumns = detectNameColumns(headers);
    const addressColumns = detectAddressColumns(headers);

    return rows.map((row, index) => {
      let name = '';
      if (nameColumns.firstName || nameColumns.lastName) {
        const firstName = row[nameColumns.firstName || ''] || '';
        const lastName = row[nameColumns.lastName || ''] || '';
        name = `${firstName} ${lastName}`.trim();
      } else if (nameColumns.fullName) {
        name = row[nameColumns.fullName] || '';
      }

      let address = '';
      if (addressColumns.length > 0) {
        const addressParts = addressColumns
          .map(col => row[col])
          .filter(part => part && part.trim())
          .join(', ');
        address = addressParts;
      }

      const typeVariations = ['type', 'contact type', 'contacttype', 'category', 'client type'];
      const emailVariations = ['email', 'e-mail', 'email address', 'emailaddress'];
      const phoneVariations = ['phone', 'telephone', 'phone number', 'phonenumber', 'cell', 'mobile'];
      const companyVariations = ['company', 'company name', 'companyname', 'organization', 'business', 'firm', 'employer'];
      const branchVariations = ['branch', 'location', 'office'];
      const salespersonVariations = ['salesperson', 'sales person', 'assigned', 'assigned to', 'assignedto', 'rep', 'agent'];
      const drinksVariations = ['drinks', 'drink', 'alcohol', 'alcoholic', 'beverages'];

      const findColumn = (variations: string[]): string => {
        const lowerHeaders = headers.map(h => h.toLowerCase().trim());
        const header = headers.find((h, i) => variations.includes(lowerHeaders[i]));
        return header ? row[header] || '' : '';
      };

      const drinksValue = findColumn(drinksVariations);
      let drinks: boolean | undefined;
      if (drinksValue) {
        const normalized = drinksValue.toLowerCase().trim();
        if (['yes', 'true', '1', 'y'].includes(normalized)) {
          drinks = true;
        } else if (['no', 'false', '0', 'n'].includes(normalized)) {
          drinks = false;
        }
      }

      return {
        name,
        type: findColumn(typeVariations),
        email: findColumn(emailVariations) || undefined,
        phone: findColumn(phoneVariations) || undefined,
        company: findColumn(companyVariations) || undefined,
        branch: findColumn(branchVariations) || undefined,
        address: address || undefined,
        salesperson: findColumn(salespersonVariations) || undefined,
        drinks,
        rowNumber: index + 2,
      };
    });
  };

  const normalizeType = (type: string): 'buyer' | 'realtor' | 'attorney' | 'lender' | null => {
    const normalized = type.toLowerCase().trim();
    if (normalized.includes('buy')) return 'buyer';
    if (normalized.includes('real')) return 'realtor';
    if (normalized.includes('attor') || normalized.includes('law')) return 'attorney';
    if (normalized.includes('lend') || normalized.includes('bank')) return 'lender';
    return null;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setProcessing(true);
    setResult(null);
    setPreviewData([]);
    setShowPreview(false);

    try {
      const text = await file.text();
      const { headers, rows } = parseCSV(text);

      if (rows.length === 0) {
        alert('CSV file is empty or could not be parsed');
        return;
      }

      const convertedData = convertCSVData(headers, rows);
      setPreviewData(convertedData);
      setShowPreview(true);
    } catch (error: any) {
      alert('Error processing file: ' + error.message);
    } finally {
      setProcessing(false);
      if (event.target) event.target.value = '';
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) return;

    setImporting(true);
    setShowPreview(false);

    try {
      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      const { data: salespeople } = await supabase
        .from('sales_people')
        .select('id, name')
        .eq('is_active', true);

      const salespersonMap = new Map(
        salespeople?.map(sp => [sp.name.toLowerCase().trim(), sp.id]) || []
      );

      for (const contact of previewData) {
        try {
          const type = normalizeType(contact.type);

          if (!contact.name || !type) {
            failed++;
            const missing = [];
            if (!contact.name) missing.push('name');
            if (!type) missing.push('type (or invalid type value)');
            errors.push(`Row ${contact.rowNumber}: Missing ${missing.join(', ')}`);
            continue;
          }

          const salespersonId = contact.salesperson
            ? salespersonMap.get(contact.salesperson.toLowerCase().trim())
            : null;

          if (contact.salesperson && !salespersonId) {
            failed++;
            errors.push(`Row ${contact.rowNumber} "${contact.name}": Salesperson "${contact.salesperson}" not found`);
            continue;
          }

          const { data: existing } = await supabase
            .from('contacts')
            .select('id')
            .ilike('name', contact.name)
            .maybeSingle();

          if (existing) {
            const updateData: any = {
              type,
              email: contact.email || null,
              phone: contact.phone || null,
              company: contact.company || null,
              branch: contact.branch || null,
              address: contact.address || null,
              updated_by: user?.id,
            };

            if (contact.drinks !== undefined) {
              updateData.drinks = contact.drinks;
            }

            const { error: updateError } = await supabase
              .from('contacts')
              .update(updateData)
              .eq('id', existing.id);

            if (updateError) throw updateError;

            if (salespersonId) {
              const { data: existingAssignment } = await supabase
                .from('assignments')
                .select('id')
                .eq('contact_id', existing.id)
                .maybeSingle();

              if (existingAssignment) {
                await supabase
                  .from('assignments')
                  .update({ salesperson_id: salespersonId, assigned_by: user?.id })
                  .eq('id', existingAssignment.id);
              } else {
                await supabase.from('assignments').insert({
                  contact_id: existing.id,
                  salesperson_id: salespersonId,
                  assigned_by: user?.id,
                });
              }
            }

            success++;
            continue;
          }

          const insertData: any = {
            name: contact.name,
            type,
            email: contact.email || null,
            phone: contact.phone || null,
            company: contact.company || null,
            branch: contact.branch || null,
            address: contact.address || null,
            drinks: contact.drinks !== undefined ? contact.drinks : true,
            created_by: user?.id,
            updated_by: user?.id,
          };

          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert(insertData)
            .select()
            .single();

          if (contactError) throw contactError;

          if (newContact && salespersonId) {
            await supabase.from('assignments').insert({
              contact_id: newContact.id,
              salesperson_id: salespersonId,
              assigned_by: user?.id,
            });
          }

          success++;
        } catch (err: any) {
          failed++;
          errors.push(`Row ${contact.rowNumber} "${contact.name}": ${err.message}`);
        }
      }

      setResult({ success, failed, errors });
      setPreviewData([]);
    } catch (error: any) {
      setResult({ success: 0, failed: 0, errors: [error.message] });
    } finally {
      setImporting(false);
    }
  };

  const handleCancelPreview = () => {
    setShowPreview(false);
    setPreviewData([]);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-2xl font-bold text-slate-900 mb-6">Import Data from CSV</h2>

      {!showPreview && !result && (
        <>
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900 mb-2 font-medium">Smart CSV Converter:</p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>Automatically detects and combines first/last name columns</li>
              <li>Combines separate address fields (street, city, state, zip) into one</li>
              <li>Must include a type column (buyer, realtor, attorney, or lender)</li>
              <li>Preview and confirm before importing</li>
              <li>Existing contacts will be updated with new information</li>
            </ul>
          </div>

          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors">
            <Upload className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <label className="cursor-pointer">
              <span className="text-blue-600 hover:text-blue-700 font-semibold">
                Choose CSV file
              </span>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                disabled={processing || importing}
                className="hidden"
              />
            </label>
            <p className="text-sm text-slate-500 mt-2">or drag and drop</p>
          </div>
        </>
      )}

      {processing && (
        <div className="mt-6 text-center py-8">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Processing CSV file...</p>
        </div>
      )}

      {showPreview && previewData.length > 0 && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-semibold text-green-900 mb-1">Preview Converted Data</p>
                <p className="text-sm text-green-800">
                  Found {previewData.length} contacts. Review the data below and confirm if it looks correct.
                </p>
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Row</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Name</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Type</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Phone</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Company</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {previewData.map((contact, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-600">{contact.rowNumber}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{contact.name || <span className="text-red-500">Missing</span>}</td>
                    <td className="px-4 py-3 text-slate-900">{contact.type || <span className="text-red-500">Missing</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{contact.email || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{contact.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{contact.company || '-'}</td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{contact.address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              onClick={handleCancelPreview}
              className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              Confirm & Import
            </button>
          </div>
        </div>
      )}

      {importing && (
        <div className="mt-6 text-center py-8">
          <div className="w-16 h-16 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">Importing data into database...</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg flex-1">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-green-900 font-semibold">{result.success} imported</span>
            </div>
            {result.failed > 0 && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex-1">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-900 font-semibold">{result.failed} failed</span>
              </div>
            )}
          </div>

          {result.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-h-96 overflow-y-auto">
              <p className="text-sm font-semibold text-amber-900 mb-3">
                Issues encountered ({result.errors.length} {result.errors.length === 1 ? 'row' : 'rows'}):
              </p>
              <ul className="text-sm text-amber-800 space-y-1.5 font-mono">
                {result.errors.map((error, index) => (
                  <li key={index} className="border-l-2 border-amber-300 pl-3 py-1">{error}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={() => {
              setResult(null);
              setPreviewData([]);
              setShowPreview(false);
            }}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
          >
            Import Another File
          </button>
        </div>
      )}
    </div>
  );
}
