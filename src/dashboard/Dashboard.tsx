import { useState, useEffect, useCallback } from 'react'
import { SearchBar } from './components/SearchBar'
import { ProjectFilter } from './components/ProjectFilter'
import { ItemList } from './components/ItemList'
import { ItemDetail } from './components/ItemDetail'
import { RecentCarousel } from './components/RecentCarousel'
import { ProjectGrid } from './components/ProjectGrid'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage, onItemsChanged } from '@/shared/messaging'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { Brain, Settings, LayoutGrid, LayoutList, Grid3X3, Sparkles, Sun, Moon, Monitor, FolderKanban } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getStoredTheme, setTheme } from '@/shared/theme'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Keys for storing view preferences in localStorage
const VIEW_COLUMNS_KEY = 'segundo-cerebro-view-columns'
const VIEW_MODE_KEY = 'segundo-cerebro-view-mode'

// View mode type
type ViewMode = 'items' | 'projects'

// Get saved columns preference or default to 2
function getSavedColumns(): 1 | 2 | 3 {
  try {
    const saved = localStorage.getItem(VIEW_COLUMNS_KEY)
    if (saved === '1' || saved === '2' || saved === '3') {
      return parseInt(saved) as 1 | 2 | 3
    }
  } catch {
    // localStorage not available
  }
  return 2 // Default to 2 columns (grid view)
}

// Get saved view mode preference or default to 'items'
function getSavedViewMode(): ViewMode {
  try {
    const saved = localStorage.getItem(VIEW_MODE_KEY)
    if (saved === 'items' || saved === 'projects') {
      return saved
    }
  } catch {
    // localStorage not available
  }
  return 'items' // Default to items view
}

export function Dashboard() {
  const [items, setItems] = useState<(VoiceItem | SearchResult)[]>([])
  const [allItems, setAllItems] = useState<VoiceItem[]>([]) // All items for sidebar counts
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [columns, setColumns] = useState<1 | 2 | 3>(getSavedColumns)
  const [viewMode, setViewMode] = useState<ViewMode>(getSavedViewMode)
  const [theme, setThemeState] = useState<'light' | 'dark' | 'system'>(getStoredTheme)
  // Item detail drawer state
  const [selectedItem, setSelectedItem] = useState<VoiceItem | SearchResult | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const { toast } = useToast()

  // Save columns preference when it changes
  const handleColumnsChange = (newColumns: 1 | 2 | 3) => {
    setColumns(newColumns)
    try {
      localStorage.setItem(VIEW_COLUMNS_KEY, String(newColumns))
    } catch {
      // localStorage not available
    }
  }

  // Save view mode preference when it changes
  const handleViewModeChange = (newMode: ViewMode) => {
    setViewMode(newMode)
    try {
      localStorage.setItem(VIEW_MODE_KEY, newMode)
    } catch {
      // localStorage not available
    }
  }

  // Handle theme change
  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setThemeState(newTheme)
    setTheme(newTheme)
  }

  // Get current theme icon
  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor

  // Load items and projects
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [itemsResponse, allItemsResponse, projectsResponse] = await Promise.all([
        sendMessage({ type: 'GET_ITEMS', projectId: selectedProject || undefined }),
        sendMessage({ type: 'GET_ITEMS' }), // All items for sidebar counts
        sendMessage({ type: 'GET_PROJECTS' }),
      ])

      setItems(itemsResponse.items)
      setAllItems(allItemsResponse.items)
      setProjects(projectsResponse.projects)
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error)
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao carregar dados.',
      })
    } finally {
      setIsLoading(false)
    }
  }, [selectedProject, toast])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Listen for items changed events
  useEffect(() => {
    const cleanup = onItemsChanged(() => {
      loadData()
    })
    return cleanup
  }, [loadData])

  // Refresh on visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [loadData])

  // Handle semantic search
  const handleSearch = async (query: string) => {
    setSearchQuery(query)

    if (!query.trim()) {
      // Load regular items when search is cleared
      const response = await sendMessage({
        type: 'GET_ITEMS',
        projectId: selectedProject || undefined,
      })
      setItems(response.items)
      return
    }

    setIsSearching(true)
    try {
      const response = await sendMessage({
        type: 'SEMANTIC_SEARCH',
        query: query.trim(),
        limit: 20,
      })
      setItems(response.results)
    } catch (error) {
      console.error('[Dashboard] Search error:', error)
      toast({
        variant: 'destructive',
        title: 'Erro na busca',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
      })
    } finally {
      setIsSearching(false)
    }
  }

  // Handle project filter change
  const handleProjectChange = (projectId: string) => {
    setSelectedProject(projectId)
    setSearchQuery('') // Clear search when changing project
  }

  // Handle item deletion
  const handleDelete = async (itemId: string) => {
    try {
      await sendMessage({ type: 'DELETE_ITEM', id: itemId })
      toast({
        variant: 'success',
        title: 'Deletado',
        description: 'Item removido com sucesso.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao deletar item.',
      })
    }
  }

  // Handle item project update (inline, without full refresh)
  const handleUpdateProject = async (itemId: string, projectId: string | null) => {
    try {
      await sendMessage({ type: 'UPDATE_ITEM_PROJECT', id: itemId, projectId })
      // Update item locally without reloading all data
      setItems((prevItems) =>
        prevItems.map((item) =>
          item.id === itemId ? { ...item, projectId } : item
        )
      )
      toast({
        variant: 'success',
        title: 'Atualizado',
        description: 'Projeto do item alterado.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao atualizar projeto.',
      })
    }
  }

  // Open item URL
  const handleOpen = (url: string) => {
    chrome.tabs.create({ url })
  }

  // Handle item click - open detail drawer
  const handleItemClick = (item: VoiceItem | SearchResult) => {
    setSelectedItem(item)
    setIsDetailOpen(true)
  }

  // Navigate to another item in the drawer
  const handleNavigateItem = (item: VoiceItem | SearchResult) => {
    setSelectedItem(item)
  }

  // Handle item update (title, transcription, aiSummary)
  const handleUpdateItem = async (
    itemId: string,
    updates: { title?: string; transcription?: string; aiSummary?: string }
  ) => {
    try {
      const response = await sendMessage({ type: 'UPDATE_ITEM', id: itemId, updates })
      if (response.success && response.item) {
        // Update item locally
        setItems((prevItems) =>
          prevItems.map((item) =>
            item.id === itemId ? { ...item, ...updates } : item
          )
        )
        // Update selected item if it's the one being edited
        if (selectedItem?.id === itemId) {
          setSelectedItem({ ...selectedItem, ...updates })
        }
        toast({
          variant: 'success',
          title: 'Atualizado',
          description: 'Item atualizado com sucesso.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: 'Erro ao atualizar item.',
      })
      throw error // Re-throw so ItemDetail can handle it
    }
  }

  // Open options
  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="min-h-screen gradient-mesh">
      {/* Header - Glass effect with subtle border */}
      <header className="sticky top-0 z-40 glass-surface border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and title */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full" />
                <Brain className="h-7 w-7 text-primary relative" />
              </div>
              <div>
                <h1 className="text-lg font-semibold tracking-tight">Segundo Cérebro</h1>
                <p className="text-xs text-muted-foreground">Suas ideias, organizadas</p>
              </div>
            </div>

            {/* Controls only - search moved below */}
            <div className="flex items-center gap-3">
              {/* View mode toggle - Items vs Projects */}
              <div className="flex items-center bg-secondary/50 rounded-full p-1">
                <button
                  onClick={() => handleViewModeChange('items')}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    viewMode === 'items'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Itens"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleViewModeChange('projects')}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    viewMode === 'projects'
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Projetos"
                >
                  <FolderKanban className="h-4 w-4" />
                </button>
              </div>

              {/* Columns toggle - Pill style (only shown in items view) */}
              <div className={cn(
                "flex items-center bg-secondary/50 rounded-full p-1 transition-opacity",
                viewMode === 'projects' && "opacity-50 pointer-events-none"
              )}>
                <button
                  onClick={() => handleColumnsChange(1)}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    columns === 1
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="Lista"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleColumnsChange(2)}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    columns === 2
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="2 colunas"
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleColumnsChange(3)}
                  className={cn(
                    'p-2 rounded-full transition-all duration-200',
                    columns === 3
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                  title="3 colunas"
                >
                  <Grid3X3 className="h-4 w-4" />
                </button>
              </div>

              {/* Theme toggle dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="rounded-full hover:bg-secondary/70"
                  >
                    <ThemeIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  <DropdownMenuItem
                    onClick={() => handleThemeChange('light')}
                    className={cn('rounded-lg gap-2', theme === 'light' && 'bg-primary/10')}
                  >
                    <Sun className="h-4 w-4" />
                    <span>Claro</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleThemeChange('dark')}
                    className={cn('rounded-lg gap-2', theme === 'dark' && 'bg-primary/10')}
                  >
                    <Moon className="h-4 w-4" />
                    <span>Escuro</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleThemeChange('system')}
                    className={cn('rounded-lg gap-2', theme === 'system' && 'bg-primary/10')}
                  >
                    <Monitor className="h-4 w-4" />
                    <span>Sistema</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Settings button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={openOptions}
                className="rounded-full hover:bg-secondary/70"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-8">
          {/* Sidebar - Projects */}
          <aside className="w-56 shrink-0">
            <div className="sticky top-24">
              <ProjectFilter
                projects={projects}
                items={allItems}
                selectedProject={selectedProject}
                onProjectChange={handleProjectChange}
                onProjectsUpdated={loadData}
              />
            </div>
          </aside>

          {/* Main content - Items */}
          <main className="flex-1 min-w-0">
            {/* Hero Search Bar - Above everything for natural results flow */}
            <div className="mb-8">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                isSearching={isSearching}
                large
              />
            </div>

            {/* Recent Carousel - Hidden during search and in projects view */}
            {!searchQuery && !isLoading && items.length > 0 && viewMode === 'items' && (
              <RecentCarousel
                items={items}
                projects={projects}
                onItemClick={handleItemClick}
                className="mb-8"
              />
            )}

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full animate-pulse" />
                  <Sparkles className="h-8 w-8 text-primary animate-pulse relative" />
                </div>
                <p className="mt-4 text-sm text-muted-foreground">Carregando memórias...</p>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary/5 blur-3xl rounded-full" />
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center relative">
                    <Brain className="h-10 w-10 text-primary/60" />
                  </div>
                </div>
                <h2 className="text-xl font-medium mb-2">
                  {searchQuery ? 'Nenhum resultado' : 'Comece a memorizar'}
                </h2>
                <p className="text-sm text-muted-foreground max-w-xs">
                  {searchQuery
                    ? 'Tente buscar por outros termos ou conceitos relacionados.'
                    : 'Use a extensão para salvar tabs e notas com sua voz.'}
                </p>
              </div>
            ) : viewMode === 'projects' && !searchQuery ? (
              // Project grid view
              <ProjectGrid
                projects={projects}
                items={items}
                onProjectClick={(projectId) => {
                  // Filter to the selected project and switch to items view
                  handleProjectChange(projectId)
                  handleViewModeChange('items')
                }}
              />
            ) : (
              <>
                {/* Results header */}
                {searchQuery && (
                  <div className="mb-6 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      {items.length} resultado{items.length !== 1 ? 's' : ''} para "{searchQuery}"
                    </span>
                  </div>
                )}
                <ItemList
                  items={items}
                  projects={projects}
                  columns={columns}
                  onDelete={handleDelete}
                  onOpen={handleOpen}
                  onUpdateProject={handleUpdateProject}
                  onItemClick={handleItemClick}
                />
              </>
            )}
          </main>
        </div>
      </div>

      {/* Item detail drawer */}
      <ItemDetail
        item={selectedItem}
        items={items}
        projects={projects}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onDelete={handleDelete}
        onOpen={handleOpen}
        onUpdateProject={handleUpdateProject}
        onNavigate={handleNavigateItem}
        onUpdate={handleUpdateItem}
      />

      <Toaster />
    </div>
  )
}
