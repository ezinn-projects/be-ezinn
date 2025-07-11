export interface IVariantRequest {
  name: string
  price: number
  isAvailable: boolean
  image?: string
  inventory: {
    quantity: number
    unit: string
    minStock: number
    maxStock: number
  }
}

export interface ICreateFnBMenuRequestBody {
  name: string
  price: number
  description: string
  image: string
  category: string
  hasVariants?: boolean
  variants?: IVariantRequest[]
  inventory: {
    quantity: number
    unit: string
    minStock: number
    maxStock: number
  }
  createdBy?: string
}

export interface IUpdateFnBMenuRequestBody {
  name?: string
  price?: number
  description?: string
  image?: string
  category?: string
  hasVariants?: boolean
  variants?: IVariantRequest[]
  inventory?: {
    quantity?: number
    unit?: string
    minStock?: number
    maxStock?: number
  }
  updatedBy?: string
}
