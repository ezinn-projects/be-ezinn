export interface ICreateFnBMenuRequestBody {
  name: string
  price: number
  description: string
  image: string
  category: string
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
  inventory?: {
    quantity?: number
    unit?: string
    minStock?: number
    maxStock?: number
  }
  updatedBy?: string
}
