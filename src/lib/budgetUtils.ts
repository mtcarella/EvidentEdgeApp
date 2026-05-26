import { supabase } from './supabase';

interface BudgetDeductionResult {
  success: boolean;
  newBalance: number | null;
  exceeded: boolean;
  error?: string;
}

export async function deductBudget(
  salesPersonId: string,
  amount: number
): Promise<BudgetDeductionResult> {
  try {
    const { data: user } = await supabase
      .from('sales_people')
      .select('budget, budget_display_enabled, name, email')
      .eq('id', salesPersonId)
      .maybeSingle();

    if (!user || !user.budget_display_enabled) {
      return { success: true, newBalance: null, exceeded: false };
    }

    const currentBudget = parseFloat(String(user.budget)) || 0;
    const newBudget = currentBudget - amount;
    const { error } = await supabase
      .from('sales_people')
      .update({ budget: newBudget })
      .eq('id', salesPersonId);

    if (error) {
      return { success: false, newBalance: null, exceeded: false, error: error.message };
    }

    if (newBudget < 0) {
      notifyBudgetExceeded(user.name, user.email, newBudget);
    }

    return { success: true, newBalance: newBudget, exceeded: newBudget < 0 };
  } catch (err: any) {
    return { success: false, newBalance: null, exceeded: false, error: err?.message || 'Unknown error' };
  }
}

export async function restoreBudget(
  salesPersonId: string,
  amount: number
): Promise<BudgetDeductionResult> {
  try {
    const { data: user } = await supabase
      .from('sales_people')
      .select('budget, budget_display_enabled')
      .eq('id', salesPersonId)
      .maybeSingle();

    if (!user || !user.budget_display_enabled) {
      return { success: true, newBalance: null, exceeded: false };
    }

    const currentBudget = parseFloat(String(user.budget)) || 0;
    const newBudget = currentBudget + amount;
    const { error } = await supabase
      .from('sales_people')
      .update({ budget: newBudget })
      .eq('id', salesPersonId);

    if (error) {
      return { success: false, newBalance: null, exceeded: false, error: error.message };
    }

    return { success: true, newBalance: newBudget, exceeded: newBudget < 0 };
  } catch (err: any) {
    return { success: false, newBalance: null, exceeded: false, error: err?.message || 'Unknown error' };
  }
}

export async function adjustBudget(
  salesPersonId: string,
  oldAmount: number,
  newAmount: number
): Promise<BudgetDeductionResult> {
  const diff = newAmount - oldAmount;
  if (diff === 0) return { success: true, newBalance: null, exceeded: false };

  if (diff > 0) {
    return deductBudget(salesPersonId, diff);
  } else {
    return restoreBudget(salesPersonId, Math.abs(diff));
  }
}

async function notifyBudgetExceeded(userName: string, userEmail: string, currentBalance: number) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-budget-exceeded`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ userName, userEmail, currentBalance }),
      }).catch(err => console.error('Budget notification failed:', err));
    }
  } catch (err) {
    console.error('Budget notification failed:', err);
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
