import { useState, useEffect } from 'react';
import { Cake, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { getESTToday } from '../lib/dateUtils';

interface Birthday {
  id: string;
  name: string;
  type: string;
  birthday: string;
  isUser?: boolean;
  day?: 'today' | 'saturday' | 'sunday';
}

export function BirthdayBanner() {
  const { user } = useAuth();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTodaysBirthdays();
    }
  }, [user]);

  const loadTodaysBirthdays = async () => {
    setLoading(true);
    try {
      const today = getESTToday();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 5 = Friday, 6 = Saturday
      const isFriday = dayOfWeek === 5;

      // Calculate dates to check
      const datesToCheck: Array<{ date: Date; label: 'today' | 'saturday' | 'sunday' }> = [
        { date: today, label: 'today' }
      ];

      // If it's Friday, also check Saturday and Sunday
      if (isFriday) {
        const saturday = new Date(today);
        saturday.setDate(today.getDate() + 1);
        datesToCheck.push({ date: saturday, label: 'saturday' });

        const sunday = new Date(today);
        sunday.setDate(today.getDate() + 2);
        datesToCheck.push({ date: sunday, label: 'sunday' });
      }

      // Fetch contact birthdays
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, name, type, birthday')
        .not('birthday', 'is', null);

      if (contactError) throw contactError;

      // Fetch user birthdays
      const { data: userData, error: userError } = await supabase
        .from('sales_people')
        .select('id, name, role, birthday')
        .not('birthday', 'is', null)
        .eq('is_active', true);

      if (userError) throw userError;

      const allBirthdays: Birthday[] = [];

      // Check each date
      datesToCheck.forEach(({ date, label }) => {
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const dateMMDD = `${month}-${day}`;

        // Filter contact birthdays
        const contactBirthdays = (contactData || []).filter(contact => {
          if (!contact.birthday) return false;
          const [year, month, day] = contact.birthday.split('-').map(Number);
          const birthdayDate = new Date(year, month - 1, day);
          const birthdayMMDD = `${String(birthdayDate.getMonth() + 1).padStart(2, '0')}-${String(birthdayDate.getDate()).padStart(2, '0')}`;
          return birthdayMMDD === dateMMDD;
        }).map(contact => ({ ...contact, isUser: false, day: label }));

        // Filter user birthdays
        const userBirthdays = (userData || []).filter(salesPerson => {
          if (!salesPerson.birthday) return false;
          const [year, month, day] = salesPerson.birthday.split('-').map(Number);
          const birthdayDate = new Date(year, month - 1, day);
          const birthdayMMDD = `${String(birthdayDate.getMonth() + 1).padStart(2, '0')}-${String(birthdayDate.getDate()).padStart(2, '0')}`;
          return birthdayMMDD === dateMMDD;
        }).map(salesPerson => ({
          id: salesPerson.id,
          name: salesPerson.name,
          type: salesPerson.role,
          birthday: salesPerson.birthday,
          isUser: true,
          day: label
        }));

        allBirthdays.push(...contactBirthdays, ...userBirthdays);
      });

      // Sort by day (today first) then by name
      allBirthdays.sort((a, b) => {
        const dayOrder = { today: 0, saturday: 1, sunday: 2 };
        const dayComparison = dayOrder[a.day || 'today'] - dayOrder[b.day || 'today'];
        if (dayComparison !== 0) return dayComparison;
        return a.name.localeCompare(b.name);
      });

      setBirthdays(allBirthdays);
    } catch (error) {
      console.error('Error loading birthdays:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || birthdays.length === 0 || dismissed) {
    return null;
  }

  const typeLabels: Record<string, string> = {
    buyer: 'Buyer',
    realtor: 'Realtor',
    loan_officer: 'Loan Officer',
    attorney: 'Attorney',
    vendor: 'Vendor',
    salesperson: 'Team Member',
    closer: 'Team Member',
    processor: 'Team Member',
    sales_processor: 'Team Member',
    admin: 'Team Member',
    super_admin: 'Team Member',
  };

  const hasWeekendBirthdays = birthdays.some(b => b.day === 'saturday' || b.day === 'sunday');
  const todayBirthdays = birthdays.filter(b => b.day === 'today');
  const weekendBirthdays = birthdays.filter(b => b.day !== 'today');

  const getTitle = () => {
    if (todayBirthdays.length > 0 && weekendBirthdays.length > 0) {
      return 'Birthdays - Today & This Weekend!';
    } else if (weekendBirthdays.length > 0) {
      return 'Birthdays This Weekend!';
    } else {
      return todayBirthdays.length === 1 ? 'Birthday Today!' : 'Birthdays Today!';
    }
  };

  const getDayLabel = (day?: 'today' | 'saturday' | 'sunday') => {
    if (day === 'saturday') return 'Sat';
    if (day === 'sunday') return 'Sun';
    return 'Today';
  };

  return (
    <div className="bg-gradient-to-r from-pink-500 to-purple-500 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Cake className="w-6 h-6 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-1">
                {getTitle()}
              </h3>
              <div className="flex flex-wrap gap-2">
                {birthdays.map((birthday, index) => (
                  <span key={birthday.id} className="inline-flex items-center gap-1">
                    <span className="font-medium">{birthday.name}</span>
                    <span className="text-pink-100">
                      ({typeLabels[birthday.type] || birthday.type}
                      {hasWeekendBirthdays && ` - ${getDayLabel(birthday.day)}`})
                    </span>
                    {index < birthdays.length - 1 && <span className="mx-1">•</span>}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="ml-4 p-1 hover:bg-white/20 rounded transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
