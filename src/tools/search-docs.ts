import { DOCS, type Doc } from "../data/mock-docs.js"

export interface SearchResult {
  id: string
  title: string
  excerpt: string
  type: Doc["type"]
  score: number
}

export async function searchDocs(
  query: string,
  limit = 5,
): Promise<SearchResult[]> {
  await new Promise((r) => setTimeout(r, 200))

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const scored = DOCS.map((doc) => {
    const haystack =
      `${doc.title} ${doc.content} ${doc.tags.join(" ")}`.toLowerCase()

    let score = 0
    for (const term of terms) {
      if (haystack.includes(term)) score += 1
      if (doc.title.toLowerCase().includes(term)) score += 2
      if (doc.tags.some((t) => t.includes(term))) score += 1
    }

    return { doc, score }
  })

  return scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ doc, score }) => ({
      id: doc.id,
      title: doc.title,
      excerpt: doc.content.slice(0, 120) + (doc.content.length > 120 ? "…" : ""),
      type: doc.type,
      score,
    }))
}
