import { TemplateStudio } from '@/components/template-studio/template-studio'

export const metadata = { title: 'Template Studio' }

export default async function EditTemplatePage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  return <TemplateStudio templateId={params.id} />
}
