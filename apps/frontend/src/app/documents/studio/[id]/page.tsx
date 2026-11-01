import { TemplateStudio } from '@/components/template-studio/template-studio'

export const metadata = { title: 'Template Studio' }

export default function EditTemplatePage({ params }: { params: { id: string } }) {
  return <TemplateStudio templateId={params.id} />
}
