import { Navigate, useLocation } from 'react-router-dom'
import { useGrant } from './GrantContext'
import { GRANTABLE_PAGES, type GrantablePage } from '@/lib/permissions'

interface Props {
  page: GrantablePage
  children: React.ReactNode
}

// Blocks access to a page if the viewer doesn't have the required grant.
// Owners (isViewer = false) always pass through.
export default function GrantGuard({ page, children }: Props) {
  const { isViewer, grantedPages, selectedGrant, grants, loading } = useGrant()
  const location = useLocation()

  if (loading) return null

  // Owner — unrestricted
  if (!isViewer) return <>{children}</>

  // Viewer with multiple owners but none selected — shouldn't reach here
  // (OwnerPicker handles this before AppLayout renders)
  if (grants.length > 1 && !selectedGrant) return <Navigate to="/" replace />

  if (!grantedPages.includes(page)) {
    // Redirect to the first granted page, or root if none
    const firstGranted = GRANTABLE_PAGES.find(p => grantedPages.includes(p.id))
    return <Navigate to={firstGranted?.path ?? '/'} replace state={{ from: location }} />
  }

  return <>{children}</>
}
