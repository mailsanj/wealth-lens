import { useGrant } from './GrantContext'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import WealthLensLogo from '@/components/layout/WealthLensLogo'
import type { AccessGrant } from '@/lib/permissions'

// Shown when a grantee has grants from multiple owners — they must pick one workspace.
export default function OwnerPicker() {
  const { grants, selectGrant } = useGrant()

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex justify-center">
          <WealthLensLogo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Select a workspace to view</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {grants.map((g: AccessGrant) => (
              <Button
                key={g.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => selectGrant(g)}
              >
                <div className="text-left">
                  <div className="font-medium">{g.label ?? g.grantee_email}</div>
                  <div className="text-xs text-muted-foreground">
                    {g.pages.join(', ')}
                  </div>
                </div>
              </Button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
