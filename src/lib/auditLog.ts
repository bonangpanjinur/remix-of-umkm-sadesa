import { supabase } from '@/integrations/supabase/client';

export async function logAdminAction(
  action: string,
  entityType: string,
  entityId?: string | null,
  oldValue?: Record<string, unknown> | null,
  newValue?: Record<string, unknown> | null
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('admin_audit_logs').insert({
      admin_id: user.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      old_value: oldValue,
      new_value: newValue,
    });
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}
