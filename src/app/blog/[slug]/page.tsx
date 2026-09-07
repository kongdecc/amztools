import { PUBLIC_SETTINGS, PUBLIC_NAV, PUBLIC_MODULES, PUBLIC_CATEGORIES, PUBLIC_POSTS, SITE_URL, pageMetadata, jsonLd } from '@/lib/published-content'
import { notFound } from 'next/navigation'
import { SettingsProvider } from '@/components/SettingsProvider'
import { marked } from 'marked'
import BlogDetailClient from '../BlogDetailClient'
export const dynamicParams = false
export function generateStaticParams() { return PUBLIC_POSTS.map(post => ({ slug: post.slug })) }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = PUBLIC_POSTS.find(post => post.slug === slug)
  if (!post) notFound()
  const description = String(marked.parse(post.content)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160)
  return pageMetadata(post.title, description, '/blog/' + slug)
}
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = PUBLIC_POSTS.find(post => post.slug === slug)
  if (!post) notFound()
  return <SettingsProvider initial={PUBLIC_SETTINGS}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd({ '@context': 'https://schema.org', '@type': 'Article', headline: post.title, url: SITE_URL + '/blog/' + post.slug, datePublished: post.createdAt }) }} />
    <BlogDetailClient item={post} initialNavItems={PUBLIC_NAV} initialHtml={String(marked.parse(post.content))} />
  </SettingsProvider>
}
