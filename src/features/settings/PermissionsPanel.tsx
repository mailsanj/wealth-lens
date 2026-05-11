import { useState, useEffect, useCallback } from 'react'
import { Trash2, Plus, UserCheck, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/AuthContext'
import { GRANTABLE_PAGES, type AccessGrant, type GrantablePage } from '@/lib/permissions'

export default function PermissionsPanel() {
  const { user } = useAuth()
  const [grants, setGrants] = useState<AccessGrant[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [pages, setPages] = useState<Set<GrantablePage>>(new Set())
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchGrants = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('access_grants')
      .select('*')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })
    setGrants((data ?? []) as unknown as AccessGrant[])
    setLoading(false)
  }, [user])

  useEffect(() => { fetchGrants() }, [fetchGrants])

  function togglePage(page: GrantablePage) {
    setPages(prev => {
      const next = new Set(prev)
      next.has(page) ? next.delete(page) : next.add(page)
      return next
    })
  }

  async function handleAdd() {
    if (!email.trim()) { setError('Email is required.'); return }
    if (pages.size === 0) { setError('Select at least one page.'); return }
    setSaving(true); setError(null)
    try {
      const { error: err } = await supabase
        .from('access_grants')
        .insert({
          owner_id: user!.id,
          grantee_email: email.trim().toLowerCase(),
          pages: Array.from(pages),
          label: label.trim() || null,
        })
      if (err) throw new Error(err.message)
      setEmail(''); setPages(new Set()); setLabel(''); setShowForm(false)
      await fetchGrants()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add')
    } finally { setSaving(false) }
  }

  async function handleRevoke(id: string) {
    await supabase.from('access_grants').delete().eq('id', id)
    setGrants(prev => prev.filter(g => g.id !== id))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Shared Access</CardTitle>
        <p className="text-sm text-muted-foreground">
          Grant read-only access to specific pages. The person signs up at this app using the email address you specify.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Current grants */}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : grants.length === 0 && !showForm ? (
          <p className="text-sm text-muted-foreground">No access grants yet.</p>
        ) : (
          <div className="space-y-2">
            {grants.map(g => (
              <div key={g.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {g.grantee_id
                      ? <UserCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      : <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    }
                    <span className="font-medium truncate">{g.grantee_email}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${g.grantee_id ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {g.grantee_id ? 'Active' : 'Pending signup'}
                    </span>
                  </div>
                  {g.label && <p className="mt-0.5 text-xs text-muted-foreground pl-5">{g.label}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground pl-5">
                    Access: {g.pages.map(p => GRANTABLE_PAGES.find(gp => gp.id === p)?.label).filter(Boolean).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => handleRevoke(g.id)}
                  className="ml-3 shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {showForm && (
          <div className="space-y-3 rounded-lg border p-3">
            <p className="text-xs font-medium text-muted-foreground">New Access Grant</p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email address</Label>
              <Input
                type="email"
                placeholder="advisor@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Label (optional)</Label>
              <Input
                placeholder="e.g. Financial Advisor"
                value={label}
                onChange={e => setLabel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Pages to grant access</Label>
              <div className="grid grid-cols-2 gap-2">
                {GRANTABLE_PAGES.map(p => (
                  <label key={p.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={pages.has(p.id)}
                      onChange={() => togglePage(p.id)}
                    />
                    {p.label}
                  </label>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={saving}>
                {saving ? 'Adding…' : 'Add Grant'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowForm(false); setError(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {!showForm && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Access Grant
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
