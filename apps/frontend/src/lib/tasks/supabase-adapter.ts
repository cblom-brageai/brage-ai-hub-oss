import { supabase } from '@/lib/supabase'
import type { Task, TaskCreate, TaskUpdate, TaskProvider, TaskStatus } from './types'

export const supabaseTaskProvider: TaskProvider = {
  async list(filters) {
    let q = supabase.from('tasks').select('*').order('created_at', { ascending: false })
    if (filters?.status) q = q.eq('status', filters.status)
    if (filters?.assigned_to) q = q.eq('assigned_to', filters.assigned_to)
    const { data, error } = await q
    if (error) throw error
    return data as Task[]
  },

  async get(id) {
    const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single()
    if (error) return null
    return data as Task
  },

  async create(task) {
    const { data, error } = await supabase.from('tasks').insert(task).select().single()
    if (error) throw error
    return data as Task
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Task
  },

  async remove(id) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) throw error
  },
}
