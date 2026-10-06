export interface ParsedRow {
  [key: string]: string;
}

export interface FieldMapping {
  sourceColumn: string;
  targetField: string;
  preview: string[];
}

export interface ImportRow {
  _selected: boolean;
  _rowIndex: number;
  _warnings: string[];
  [key: string]: any;
}

export const CONTACT_FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: 'name', label: 'Name', required: true },
  { key: 'type', label: 'Type (buyer, realtor, attorney, loan_officer, vendor)', required: true },
  { key: 'email', label: 'Email', required: false },
  { key: 'phone', label: 'Phone', required: false },
  { key: 'cell_phone', label: 'Cell Phone', required: false },
  { key: 'company', label: 'Company', required: false },
  { key: 'branch', label: 'Branch', required: false },
  { key: 'address', label: 'Address', required: false },
  { key: 'notes', label: 'Notes', required: false },
  { key: 'birthday', label: 'Birthday', required: false },
  { key: 'client_type', label: 'Client Type (client or prospect)', required: false },
  { key: 'grade', label: 'Grade (A, B, or C)', required: false },
  { key: 'drinks', label: 'Drinks (yes/no)', required: false },
  { key: 'preferred_surveyor', label: 'Preferred Surveyor', required: false },
  { key: 'preferred_uw', label: 'Preferred Underwriter', required: false },
  { key: 'preferred_closer', label: 'Preferred Closer', required: false },
  { key: 'client_identifier_no', label: 'Client Identifier No.', required: false },
  { key: 'processor_notes', label: 'Processor Notes', required: false },
];

export const FUZZY_MAP: Record<string, string[]> = {
  name: ['name', 'full name', 'fullname', 'contact name', 'contactname', 'client name', 'clientname', 'first name', 'firstname', 'fname'],
  type: ['type', 'contact type', 'contacttype', 'category', 'client category'],
  email: ['email', 'e-mail', 'email address', 'emailaddress', 'e mail'],
  phone: ['phone', 'telephone', 'phone number', 'phonenumber', 'office phone', 'work phone'],
  cell_phone: ['cell', 'cell phone', 'cellphone', 'mobile', 'mobile phone', 'mobilephone', 'cell number'],
  company: ['company', 'company name', 'companyname', 'organization', 'business', 'firm', 'employer'],
  branch: ['branch', 'location', 'office', 'office location'],
  address: ['address', 'street', 'street address', 'mailing address', 'full address'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
  birthday: ['birthday', 'birth date', 'birthdate', 'dob', 'date of birth'],
  client_type: ['client type', 'clienttype', 'status', 'prospect', 'client status'],
  grade: ['grade', 'rating', 'tier', 'rank'],
  drinks: ['drinks', 'drink', 'alcohol', 'alcoholic', 'beverages'],
  preferred_surveyor: ['surveyor', 'preferred surveyor'],
  preferred_uw: ['underwriter', 'preferred underwriter', 'uw', 'preferred uw'],
  preferred_closer: ['closer', 'preferred closer'],
  client_identifier_no: ['client id', 'identifier', 'client identifier', 'id number', 'client no', 'client number'],
  processor_notes: ['processor notes', 'processing notes'],
};

export function autoDetectMapping(sourceColumns: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const used = new Set<string>();

  for (const col of sourceColumns) {
    const lower = col.toLowerCase().trim();
    for (const [field, variations] of Object.entries(FUZZY_MAP)) {
      if (used.has(field)) continue;
      if (variations.some(v => v === lower || lower.includes(v) || v.includes(lower))) {
        mapping[col] = field;
        used.add(field);
        break;
      }
    }
  }
  return mapping;
}

export function normalizeType(val: string): string {
  const n = val.toLowerCase().trim();
  if (n.includes('buy')) return 'buyer';
  if (n.includes('real')) return 'realtor';
  if (n.includes('attor') || n.includes('law')) return 'attorney';
  if (n.includes('lend') || n.includes('bank') || n.includes('loan')) return 'loan_officer';
  if (n.includes('vend')) return 'vendor';
  return val;
}

export type DuplicateAction = 'replace' | 'duplicate' | 'skip';

export interface ExistingContact {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  cell_phone: string | null;
  company: string | null;
  branch: string | null;
  address: string | null;
  notes: string | null;
  birthday: string | null;
  client_type: string | null;
  grade: string | null;
  drinks: boolean | null;
  preferred_surveyor: string | null;
  preferred_uw: string | null;
  preferred_closer: string | null;
  client_identifier_no: string | null;
  processor_notes: string | null;
  assigned_to: string | null;
  [key: string]: any;
}

export interface DuplicateMatch {
  importRow: ImportRow;
  existing: ExistingContact;
  action: DuplicateAction;
  fieldsToReplace: Set<string>;
}

export const COMPARABLE_FIELDS = CONTACT_FIELDS.filter(f => f.key !== 'name').map(f => f.key);

export function normalizeBoolean(val: string): boolean | undefined {
  const n = val.toLowerCase().trim();
  if (['yes', 'true', '1', 'y'].includes(n)) return true;
  if (['no', 'false', '0', 'n'].includes(n)) return false;
  return undefined;
}
