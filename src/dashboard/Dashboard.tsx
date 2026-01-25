import { useState, useEffect, useCallback } from 'react'
import { SearchBar } from './components/SearchBar'
import { ProjectFilter } from './components/ProjectFilter'
import { ItemList } from './components/ItemList'
import { Toaster } from '@/components/ui/toaster'
import { useToast } from '@/components/ui/use-toast'
import { sendMessage, onItemsChanged } from '@/shared/messaging'
import type { VoiceItem, SearchResult, Project } from '@/shared/types'
import { Brain, Settings, LayoutGrid, LayoutList, Grid3X3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Dashboard() {
  const [items, setItems] = useState<(VoiceItem | SearchResult)[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [columns, setColumns] = useState<1 | 2 | 3>(1) // Grid columns: 1, 2, or 3
  const { toast } = useToast()

  // Load items and projects
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [itemsResponse, projectsResponse] = await Promise.all([
        sendMessage({ type: 'GET_ITEMS', projectId: selectedProject || undefined }),
        sendMessage({ type: 'GET_PROJECTS' }),
      ])

      setItems(itemsResponse.items)
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

  // Open options
  const openOptions = () => {
    chrome.runtime.openOptionsPage()
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-semibold">Segundo Cérebro</h1>
            </div>
            <div className="flex items-center gap-4">
              <SearchBar
                value={searchQuery}
                onChange={handleSearch}
                isSearching={isSearching}
              />
              {/* View toggle buttons */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={columns === 1 ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-r-none"
                  onClick={() => setColumns(1)}
                  title="Lista (1 coluna)"
                >
                  <LayoutList className="h-4 w-4" />
                </Button>
                <Button
                  variant={columns === 2 ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-none border-x"
                  onClick={() => setColumns(2)}
                  title="Grid (2 colunas)"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={columns === 3 ? 'secondary' : 'ghost'}
                  size="icon"
                  className="h-9 w-9 rounded-l-none"
                  onClick={() => setColumns(3)}
                  title="Grid (3 colunas)"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="ghost" size="icon" onClick={openOptions}>
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar - Projects */}
          <aside className="w-64 shrink-0">
            <ProjectFilter
              projects={projects}
              selectedProject={selectedProject}
              onProjectChange={handleProjectChange}
              onProjectsUpdated={loadData}
            />
          </aside>

          {/* Main content - Items */}
          <main className="flex-1">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-pulse text-muted-foreground">Carregando...</div>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h2 className="text-lg font-medium mb-2">Nenhum item encontrado</h2>
                <p className="text-sm text-muted-foreground">
                  {searchQuery
                    ? 'Tente buscar por outros termos.'
                    : 'Use a extensão para salvar tabs com voz.'}
                </p>
              </div>
            ) : (
              <ItemList
                items={items}
                projects={projects}
                columns={columns}
                onDelete={handleDelete}
                onOpen={handleOpen}
                onUpdateProject={handleUpdateProject}
              />
            )}
          </main>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
