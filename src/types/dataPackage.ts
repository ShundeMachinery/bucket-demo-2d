import type { CombinationLayout } from '../stores/configurator'
import type { ProductCatalog } from './product'

export type DataPackage = {
  schemaVersion: 1
  name: string
  updatedAt: string
  catalog: ProductCatalog
  layouts: Record<string, CombinationLayout>
}
