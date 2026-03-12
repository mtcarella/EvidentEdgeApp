import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useModulePermissions(userId: string | undefined, salesPersonId: string | null) {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async () => {
    if (!salesPersonId) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('module_name, has_access')
        .eq('user_id', salesPersonId);

      if (error) throw error;

      const perms = new Set<string>();
      data?.forEach((perm) => {
        if (perm.has_access) {
          perms.add(perm.module_name);
        }
      });

      setPermissions(perms);
    } catch (error) {
      console.error('Error loading module permissions:', error);
    } finally {
      setLoading(false);
    }
  }, [salesPersonId]);

  useEffect(() => {
    loadPermissions();

    // Set up realtime subscription to automatically reload when permissions change
    const channel = supabase
      .channel('module_permissions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_module_permissions',
          filter: `user_id=eq.${salesPersonId}`,
        },
        () => {
          console.log('Permissions changed, reloading...');
          loadPermissions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [salesPersonId, loadPermissions]);

  const hasAccess = useCallback((moduleName: string): boolean => {
    return permissions.has(moduleName);
  }, [permissions]);

  return { hasAccess, loading, permissions, refresh: loadPermissions };
}
