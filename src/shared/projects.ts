/**
 * Default projects for initial setup
 * These projects are seeded on first use
 */

export interface DefaultProject {
  name: string
  color: string
}

// Default projects to seed on first use
export const DEFAULT_PROJECTS: DefaultProject[] = [
  { name: 'Old Jobs (Recrutamento)', color: '#3B82F6' },
  { name: 'NetCartas (Jogos)', color: '#10B981' },
  { name: 'Pessoal', color: '#8B5CF6' },
  { name: 'Rei Eu (E-commerce)', color: '#F59E0B' },
  { name: 'Estudos', color: '#EF4444' },
  { name: 'Outros', color: '#6B7280' },
]

// Project colors for new projects
export const PROJECT_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Violet
  '#F59E0B', // Amber
  '#EF4444', // Red
  '#6B7280', // Gray
  '#EC4899', // Pink
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#8B5CF6', // Purple
]

// Get a random project color
export function getRandomProjectColor(): string {
  return PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]
}
