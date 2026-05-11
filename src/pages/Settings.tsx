import ProfileForm from '@/features/settings/ProfileForm'
import PreferencesForm from '@/features/settings/PreferencesForm'
import PermissionsPanel from '@/features/settings/PermissionsPanel'
import { useGrant } from '@/features/auth/GrantContext'

export default function Settings() {
  const { isViewer } = useGrant()
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Manage your profile and app preferences.</p>
      </div>
      <ProfileForm />
      <PreferencesForm />
      {!isViewer && <PermissionsPanel />}
    </div>
  )
}
