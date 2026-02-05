import { supabase } from './supabase';
import { expandSearchTermWithNicknames } from './nicknameMapper';

export interface DuplicateContact {
  id: string;
  name: string;
  type: string;
  email: string | null;
  phone: string | null;
  matchType: 'name' | 'email';
}

export interface DuplicateGroup {
  contacts: Array<{
    id: string;
    name: string;
    type: string;
    email: string | null;
    phone: string | null;
    assigned_to: string | null;
    salesperson?: string | null;
  }>;
  matchType: 'name' | 'email';
  matchValue: string;
}

export async function checkForDuplicates(
  name: string,
  email?: string | null
): Promise<DuplicateContact[]> {
  const duplicates: DuplicateContact[] = [];
  const seenIds = new Set<string>();

  if (name.trim()) {
    const nameVariants = expandSearchTermWithNicknames(name.trim());

    for (const variant of nameVariants) {
      const searchPattern = `%${variant.split(' ').join('%')}%`;

      const { data: nameMatches } = await supabase
        .from('contacts')
        .select('id, name, type, email, phone')
        .ilike('name', searchPattern);

      if (nameMatches) {
        for (const match of nameMatches) {
          if (!seenIds.has(match.id)) {
            seenIds.add(match.id);
            duplicates.push({
              ...match,
              matchType: 'name',
            });
          }
        }
      }
    }
  }

  if (email && email.trim()) {
    const { data: emailMatches } = await supabase
      .from('contacts')
      .select('id, name, type, email, phone')
      .ilike('email', email.trim());

    if (emailMatches) {
      for (const match of emailMatches) {
        if (!seenIds.has(match.id)) {
          seenIds.add(match.id);
          duplicates.push({
            ...match,
            matchType: 'email',
          });
        } else {
          const existingDup = duplicates.find(d => d.id === match.id);
          if (existingDup && existingDup.matchType === 'name') {
            existingDup.matchType = 'name';
          }
        }
      }
    }
  }

  return duplicates;
}

export async function findAllDuplicates(): Promise<DuplicateGroup[]> {
  const { data: allContacts } = await supabase
    .from('contacts')
    .select('id, name, type, email, phone, assigned_to')
    .order('name');

  if (!allContacts) return [];

  const duplicateGroups: DuplicateGroup[] = [];
  const processedIds = new Set<string>();

  for (const contact of allContacts) {
    if (processedIds.has(contact.id)) continue;

    const similarContacts: typeof allContacts = [contact];
    processedIds.add(contact.id);

    const nameVariants = expandSearchTermWithNicknames(contact.name);

    for (const otherContact of allContacts) {
      if (processedIds.has(otherContact.id)) continue;

      let isMatch = false;

      for (const variant of nameVariants) {
        const variantPattern = variant.toLowerCase().replace(/\s+/g, ' ');
        const otherName = otherContact.name.toLowerCase().replace(/\s+/g, ' ');

        if (otherName.includes(variantPattern) || variantPattern.includes(otherName)) {
          if (Math.abs(otherName.length - variantPattern.length) <= 3) {
            isMatch = true;
            break;
          }
        }
      }

      if (contact.email && otherContact.email &&
          contact.email.toLowerCase() === otherContact.email.toLowerCase()) {
        isMatch = true;
      }

      if (isMatch) {
        similarContacts.push(otherContact);
        processedIds.add(otherContact.id);
      }
    }

    if (similarContacts.length > 1) {
      const withSalesperson = await Promise.all(
        similarContacts.map(async (c) => {
          if (c.assigned_to) {
            const { data: sp } = await supabase
              .from('sales_people')
              .select('name')
              .eq('id', c.assigned_to)
              .maybeSingle();
            return { ...c, salesperson: sp?.name || null };
          }
          return { ...c, salesperson: null };
        })
      );

      const matchType = similarContacts.some(c =>
        c.email && similarContacts.some(other =>
          other.id !== c.id && other.email?.toLowerCase() === c.email?.toLowerCase()
        )
      ) ? 'email' : 'name';

      duplicateGroups.push({
        contacts: withSalesperson,
        matchType,
        matchValue: contact.email || contact.name,
      });
    }
  }

  return duplicateGroups;
}
