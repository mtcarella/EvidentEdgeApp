import { supabase } from './supabase';

export type BudgetType = 'regular' | 'gas';

export const GAS_ACCOUNT_CONTACT_NAME = 'Gas Account';

interface BudgetDeductionResult {
  success: boolean;
  newBalance: number | null;
  exceeded: boolean;
  budgetType: BudgetType;
  error?: string;
}

const columnFor = (budgetType: BudgetType): 'budget' | 'gas_budget' =>
  budgetType === 'gas' ? 'gas_budget' : 'budget';

const labelFor = (budgetType: BudgetType): string =>
  budgetType === 'gas' ? 'Gas Budget' : 'Regular Budget';

export function getBudgetTypeForContact(contactName: string | null | undefined): BudgetType {
  return contactName === GAS_ACCOUNT_CONTACT_NAME ? 'gas' : 'regular';
}

export function getBudgetLabel(budgetType: BudgetType): string {
  return labelFor(budgetType);
}

export async function deductBudget(
  salesPersonId: string,
  amount: number,
  budgetType: BudgetType = 'regular',
  meetingId?: string
): Promise<BudgetDeductionResult> {
  const column = columnFor(budgetType);
  try {
    const { data: user } = await supabase
      .from('sales_people')
      .select(`budget, gas_budget, budget_display_enabled, name, email, user_id`)
      .eq('id', salesPersonId)
      .maybeSingle();

    if (!user || !user.budget_display_enabled) {
      return { success: true, newBalance: null, exceeded: false, budgetType };
    }

    const currentBudget = parseFloat(String((user as any)[column])) || 0;
    const newBudget = Math.round((currentBudget - amount) * 100) / 100;
    const { error } = await supabase
      .from('sales_people')
      .update({ [column]: newBudget })
      .eq('id', salesPersonId);

    if (error) {
      return { success: false, newBalance: null, exceeded: false, budgetType, error: error.message };
    }

    logBudgetTransaction(salesPersonId, user.user_id, amount, 'debit', budgetType, 'Expense deduction', newBudget, meetingId);

    if (newBudget < 0) {
      notifyBudgetExceeded(user.name, user.email, newBudget, budgetType);
    }

    return { success: true, newBalance: newBudget, exceeded: newBudget < 0, budgetType };
  } catch (err: any) {
    return { success: false, newBalance: null, exceeded: false, budgetType, error: err?.message || 'Unknown error' };
  }
}

export async function restoreBudget(
  salesPersonId: string,
  amount: number,
  budgetType: BudgetType = 'regular',
  meetingId?: string
): Promise<BudgetDeductionResult> {
  const column = columnFor(budgetType);
  try {
    const { data: user } = await supabase
      .from('sales_people')
      .select(`budget, gas_budget, budget_display_enabled, user_id`)
      .eq('id', salesPersonId)
      .maybeSingle();

    if (!user || !user.budget_display_enabled) {
      return { success: true, newBalance: null, exceeded: false, budgetType };
    }

    const currentBudget = parseFloat(String((user as any)[column])) || 0;
    const newBudget = Math.round((currentBudget + amount) * 100) / 100;
    const { error } = await supabase
      .from('sales_people')
      .update({ [column]: newBudget })
      .eq('id', salesPersonId);

    if (error) {
      return { success: false, newBalance: null, exceeded: false, budgetType, error: error.message };
    }

    logBudgetTransaction(salesPersonId, user.user_id, amount, 'credit', budgetType, 'Budget restored', newBudget, meetingId);

    return { success: true, newBalance: newBudget, exceeded: newBudget < 0, budgetType };
  } catch (err: any) {
    return { success: false, newBalance: null, exceeded: false, budgetType, error: err?.message || 'Unknown error' };
  }
}

export async function adjustBudget(
  salesPersonId: string,
  oldAmount: number,
  newAmount: number,
  budgetType: BudgetType = 'regular',
  meetingId?: string
): Promise<BudgetDeductionResult> {
  const diff = newAmount - oldAmount;
  if (diff === 0) return { success: true, newBalance: null, exceeded: false, budgetType };

  if (diff > 0) {
    return deductBudget(salesPersonId, diff, budgetType, meetingId);
  } else {
    return restoreBudget(salesPersonId, Math.abs(diff), budgetType, meetingId);
  }
}

async function notifyBudgetExceeded(userName: string, userEmail: string, currentBalance: number, budgetType: BudgetType) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-budget-exceeded`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userName, userEmail, currentBalance, budgetType }),
      }).catch(err => console.error('Budget notification failed:', err));
    }
  } catch (err) {
    console.error('Budget notification failed:', err);
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export async function logBudgetTransaction(
  salesPersonId: string,
  userId: string,
  amount: number,
  type: 'credit' | 'debit',
  budgetType: BudgetType,
  description: string,
  balanceAfter: number,
  meetingId?: string
) {
  try {
    await supabase.from('budget_transactions').insert({
      sales_person_id: salesPersonId,
      user_id: userId,
      amount,
      type,
      budget_type: budgetType,
      category: budgetType === 'gas' ? 'Gas' : 'Budget',
      description,
      balance_after: balanceAfter,
      ...(meetingId ? { meeting_id: meetingId } : {}),
    });
  } catch (err) {
    console.error('Failed to log budget transaction:', err);
  }
}
