export type Point = {
  x: number
  y: number
}

export type PartDimensions = {
  width: number
  height: number
}

export type Hotspot = Point & {
  radius: number
  label: string
}

export type ProductPart = {
  id: string
  name: string
  series: string
  image: string
  anchor: Point
  hotspot: Hotspot
  dimensions: PartDimensions
  description: string
  sellingPoints: string[]
  notes: string
}

export type Excavator = ProductPart & {
  tonnage: string
  compatibleBucketIds: string[]
}

export type Bucket = ProductPart & {
  capacity: string
  compatibleExcavatorIds: string[]
  compatibleToothIds: string[]
  mountOffset: Point
}

export type Tooth = ProductPart & {
  material: string
  compatibleBucketIds: string[]
  mountOffset: Point
}

export type CompatibilityRule = {
  id: string
  excavatorId: string
  bucketId: string
  toothIds: string[]
  fitment: string
  remark: string
}

export type ProductCatalog = {
  stage: {
    width: number
    height: number
    defaultScale: number
  }
  defaults: {
    excavatorId: string
    bucketId: string
    toothId: string
  }
  excavators: Excavator[]
  buckets: Bucket[]
  teeth: Tooth[]
  compatibility: CompatibilityRule[]
}
