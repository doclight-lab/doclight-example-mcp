import { DOCS, type Doc } from "../data/mock-docs.js"

export interface ResourceItem {
  id: string
  title: string
  type: Doc["type"]
  tags: string[]
}

export async function listResources(
  type?: "guide" | "api" | "example",
): Promise<ResourceItem[]> {
  const docs = type ? DOCS.filter((d) => d.type === type) : DOCS
  return docs.map((d) => ({ id: d.id, title: d.title, type: d.type, tags: d.tags }))
}
