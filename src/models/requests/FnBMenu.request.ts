export interface ICreateFnBMenuRequestBody {
  name: string
  price: number
  description: string
  image: string
  category: string
  createdBy?: string
}

export interface IUpdateFnBMenuRequestBody {
  name?: string
  price?: number
  description?: string
  image?: string
  category?: string
  updatedBy?: string
}
