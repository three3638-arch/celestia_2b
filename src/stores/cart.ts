import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface CartItem {
  skuId: string
  productId: string
  productName: string        // 商品名称快照
  skuDesc: string            // SKU 描述（如 "莫桑石 / 银 / 7号"）
  quantity: number
  note?: string
  imageUrl?: string          // 商品首图
  thumbnailUrl?: string      // 缩略图
  referencePriceSar?: string // 参考价（仅展示用）
}

interface CartState {
  items: CartItem[]
  
  // 计算属性
  totalItems: () => number       // 总商品数量（所有 item 的 quantity 之和）
  
  // 操作
  addItem: (item: CartItem) => void    // 添加（如果 skuId 已存在则增加数量）
  removeItem: (skuId: string) => void  // 删除
  updateQuantity: (skuId: string, quantity: number) => void  // 更新数量（0则删除）
  updateNote: (skuId: string, note: string) => void          // 更新备注
  clearCart: () => void                // 清空购物车
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      
      totalItems: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
      
      addItem: (newItem) => set((state) => {
        const existing = state.items.find(i => i.skuId === newItem.skuId)
        if (existing) {
          return {
            items: state.items.map(i =>
              i.skuId === newItem.skuId
                ? { ...i, quantity: i.quantity + newItem.quantity }
                : i
            ),
          }
        }
        return { items: [...state.items, newItem] }
      }),
      
      removeItem: (skuId) => set((state) => ({
        items: state.items.filter(i => i.skuId !== skuId),
      })),
      
      updateQuantity: (skuId, quantity) => set((state) => ({
        items: quantity <= 0
          ? state.items.filter(i => i.skuId !== skuId)
          : state.items.map(i =>
              i.skuId === skuId ? { ...i, quantity } : i
            ),
      })),
      
      updateNote: (skuId, note) => set((state) => ({
        items: state.items.map(i =>
          i.skuId === skuId ? { ...i, note } : i
        ),
      })),
      
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'celestia-cart',  // localStorage key
    }
  )
)
