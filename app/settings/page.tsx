import { auth } from '@/lib/auth';
import { isSaasMode as getIsSaasMode } from '@/lib/features';
import { redirect } from 'next/navigation';
import SettingsOverview from '@/components/settings/SettingsOverview';

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <SettingsOverview isSaasMode={getIsSaasMode()} />;
}
