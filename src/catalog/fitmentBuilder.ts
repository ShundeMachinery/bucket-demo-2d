import type { FitmentCandidate, FitmentGroup, FitmentGroupItem } from '../types/product'

export function commonFitmentGroups(
  groups: FitmentGroup[],
  selectedProductIds: string[],
): FitmentGroup[] {
  if (selectedProductIds.length === 0) {
    return []
  }

  return groups.filter((group) => (
    selectedProductIds.every((productId) => (
      group.items.some((item) => item.product.id === productId)
    ))
  ))
}

export function buildFitmentCandidates(
  groups: FitmentGroup[],
  selectedProductIds: string[],
  search: string,
  categoryId: string | null = null,
): FitmentCandidate[] {
  const selectedIds = new Set(selectedProductIds)
  const candidates = new Map<string, FitmentCandidate>()

  for (const group of groups) {
    for (const item of group.items) {
      if (
        selectedIds.has(item.product.id)
        || !matchesFitmentItemSearch(item, search, group, categoryId)
      ) {
        continue
      }

      const existing = candidates.get(item.product.id)
      if (existing) {
        addUnique(existing.categoryLabels, item.categoryLabel)
        addUnique(existing.groupIds, group.id)
        addUnique(existing.groupCodes, group.code)
        addUnique(existing.groupNames, group.name)
        continue
      }

      candidates.set(item.product.id, {
        product: item.product,
        categoryLabels: [item.categoryLabel],
        groupIds: [group.id],
        groupCodes: [group.code],
        groupNames: [group.name],
      })
    }
  }

  return [...candidates.values()].sort((left, right) => (
    left.product.sku.localeCompare(right.product.sku)
  ))
}

function matchesFitmentItemSearch(
  item: FitmentGroupItem,
  search: string,
  group?: FitmentGroup,
  categoryId: string | null = null,
): boolean {
  if (categoryId && item.product.categoryId !== categoryId) {
    return false
  }

  const normalizedSearch = normalize(search)
  if (!normalizedSearch) {
    return true
  }

  const values = [
    item.categoryLabel,
    item.product.sku,
    item.product.name,
    item.product.oemNumber,
    item.product.categoryLabel,
    item.product.categoryCode,
    group?.code,
    group?.name,
  ]

  return values.some((value) => normalize(value).includes(normalizedSearch))
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? ''
}

function addUnique(values: string[], value: string): void {
  if (!values.includes(value)) {
    values.push(value)
  }
}
