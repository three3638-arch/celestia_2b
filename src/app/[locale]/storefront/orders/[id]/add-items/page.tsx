"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Search,
  X,
  Check,
  Plus,
  Minus,
  Loader2,
  Package,
} from "lucide-react";
import { getProducts, type ProductListItem, type ProductDetail, getProductDetail } from "@/lib/actions/product";
import { customerUpdateOrder } from "@/lib/actions/order";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SkuSelector } from "@/components/storefront/sku-selector";
import { toast } from "sonner";
import Image from "next/image";
import type { GemType, MetalColor } from "@prisma/client";
import { useTranslations } from "next-intl";

interface AddItemsPageProps {
  params: Promise<{
    locale: string;
    id: string;
  }>;
}

export default function AddItemsPage({ params }: AddItemsPageProps) {
  const router = useRouter();
  const t = useTranslations("orders");
  const tProducts = useTranslations("products");
  const [orderId, setOrderId] = useState<string>("");
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Sheet state
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  
  // SKU selection state
  const [selectedGemType, setSelectedGemType] = useState<GemType | null>(null);
  const [selectedMetalColor, setSelectedMetalColor] = useState<MetalColor | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedChainLength, setSelectedChainLength] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);

  // Get order ID from params
  useEffect(() => {
    params.then((p) => setOrderId(p.id));
  }, [params]);

  const fetchProducts = useCallback(async (cursor?: string, keyword?: string) => {
    try {
      const result = await getProducts({
        cursor,
        pageSize: 20,
        keyword: keyword || undefined,
      });

      if (cursor) {
        setProducts((prev) => [...prev, ...result.items]);
      } else {
        setProducts(result.items);
      }
      setHasMore(result.hasMore);
      setNextCursor(result.nextCursor);
    } catch {
      toast.error(tProducts("fetchFailed"));
    }
  }, []);

  // Initial load
  useEffect(() => {
    setIsLoading(true);
    fetchProducts().finally(() => setIsLoading(false));
  }, [fetchProducts]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(true);
      fetchProducts(undefined, searchQuery).finally(() => setIsLoading(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, fetchProducts]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore || !nextCursor) return;
    
    setIsLoadingMore(true);
    await fetchProducts(nextCursor, searchQuery);
    setIsLoadingMore(false);
  };

  const handleProductClick = async (product: ProductListItem) => {
    setIsLoadingProduct(true);
    setIsSheetOpen(true);
    
    try {
      const detail = await getProductDetail(product.id);
      if (detail) {
        setSelectedProduct(detail);
        // Reset selection
        setSelectedGemType(null);
        setSelectedMetalColor(null);
        setSelectedSize(null);
        setSelectedChainLength(null);
        setQuantity(1);
      } else {
        toast.error(tProducts("loadFailed"));
        setIsSheetOpen(false);
      }
    } catch {
      toast.error(tProducts("loadFailed"));
      setIsSheetOpen(false);
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const getSelectedSkuId = (): string | null => {
    if (!selectedProduct || !selectedGemType || !selectedMetalColor) return null;
    
    const sku = selectedProduct.skus.find(
      (s) =>
        s.gemType === selectedGemType &&
        s.metalColor === selectedMetalColor &&
        (selectedSize === null || s.size === selectedSize) &&
        (selectedChainLength === null || s.chainLength === selectedChainLength)
    );
    
    return sku?.id || null;
  };

  const handleAddToOrder = async () => {
    const skuId = getSelectedSkuId();
    if (!skuId || !orderId) {
      toast.error(tProducts("selectAllOptions"));
      return;
    }

    setIsAdding(true);
    try {
      const result = await customerUpdateOrder(orderId, {
        addItems: [
          {
            skuId,
            quantity,
          },
        ],
      });

      if (result.success) {
        toast.success(t("itemAdded"));
        setIsSheetOpen(false);
      } else {
        toast.error(result.error || t("addItemFailed"));
      }
    } catch {
      toast.error(t("addItemFailed"));
    } finally {
      setIsAdding(false);
    }
  };

  const isSelectionComplete = () => {
    return getSelectedSkuId() !== null;
  };

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 -ms-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-semibold text-foreground truncate">
              {t("addItemsToOrder")}
            </h1>
            <p className="text-xs text-muted-foreground">#{orderId.slice(-8)}</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={tProducts("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="ps-10 pe-10 bg-background border-border"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="px-4 py-4">
        {isLoading ? (
          // Loading skeletons
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-card border-border overflow-hidden">
                <div className="aspect-square bg-muted animate-pulse" />
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                </div>
              </Card>
            ))}
          </div>
        ) : products.length === 0 ? (
          // Empty state
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-4">
              <Package className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium text-foreground mb-1">
              {tProducts("noProducts")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tProducts("tryDifferentSearch")}
            </p>
          </motion.div>
        ) : (
          // Products grid
          <>
            <div className="grid grid-cols-2 gap-3">
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.05 }}
                >
                  <Card
                    className="bg-card border-border overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
                    onClick={() => handleProductClick(product)}
                  >
                    {/* Product Image */}
                    <div className="relative aspect-square overflow-hidden bg-muted">
                      {product.primaryImageThumbnailUrl || product.primaryImageUrl ? (
                        <Image
                          src={product.primaryImageThumbnailUrl || product.primaryImageUrl!}
                          alt={product.nameEn || product.nameZh || tProducts("noName")}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Package className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-3 space-y-1">
                      <h3 className="text-sm font-medium text-foreground line-clamp-1">
                        {product.nameEn || product.nameZh || product.spuCode || tProducts("noName")}
                      </h3>
                      <p className="text-xs text-primary">
                        {product.minPriceSar && product.maxPriceSar
                          ? product.minPriceSar === product.maxPriceSar
                            ? formatPrice(product.minPriceSar)
                            : `${formatPrice(product.minPriceSar)} ~ ${formatPrice(product.maxPriceSar)}`
                          : product.minPriceSar
                            ? formatPrice(product.minPriceSar)
                            : tProducts("priceTbd")}
                      </p>
                      <div className="flex flex-wrap gap-1 pt-1">
                        {product.gemTypes.slice(0, 1).map((gemType) => (
                          <Badge
                            key={gemType}
                            variant="secondary"
                            className="text-[10px] h-5 px-1.5"
                          >
                            {gemType}
                          </Badge>
                        ))}
                        {product.metalColors.slice(0, 1).map((metalColor) => (
                          <Badge
                            key={metalColor}
                            variant="outline"
                            className="text-[10px] h-5 px-1.5 border-primary/30 text-primary"
                          >
                            {metalColor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {/* Load More */}
            {hasMore && (
              <div className="pt-6">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="w-full py-3 text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t("loading")}
                    </>
                  ) : (
                    t("loadMore")
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Bottom Fixed Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-0 start-0 end-0 z-40 bg-card border-t border-border"
      >
        <div className="px-4 py-3">
          <Button
            onClick={() => router.back()}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {t("done")}
          </Button>
        </div>
      </motion.div>

      {/* SKU Selection Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent side="bottom" className="bg-card border-border h-[85vh]">
          <SheetHeader className="pb-4 border-b border-border">
            <SheetTitle className="text-foreground">
              {isLoadingProduct ? tProducts("loading") : selectedProduct?.nameEn || tProducts("selectOptions")}
            </SheetTitle>
          </SheetHeader>

          {isLoadingProduct || !selectedProduct ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <ScrollArea className="h-[calc(85vh-180px)] py-4">
              <div className="space-y-6">
                {/* Product Image */}
                {selectedProduct.images[0] && (
                  <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                    <Image
                      src={selectedProduct.images[0].url}
                      alt={selectedProduct.nameEn || tProducts("noName")}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}

                {/* SKU Selector */}
                <SkuSelector
                  product={selectedProduct}
                  selectedGemType={selectedGemType}
                  selectedMetalColor={selectedMetalColor}
                  selectedSize={selectedSize}
                  selectedChainLength={selectedChainLength}
                  onGemTypeChange={setSelectedGemType}
                  onMetalColorChange={setSelectedMetalColor}
                  onSizeChange={setSelectedSize}
                  onChainLengthChange={setSelectedChainLength}
                />

                {/* Quantity Selector */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    {tProducts("quantity")}
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-12 text-center text-lg font-medium text-foreground">
                      {quantity}
                    </span>
                    <button
                      onClick={() => setQuantity((q) => q + 1)}
                      className="w-10 h-10 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          {/* Add to Order Button */}
          {!isLoadingProduct && selectedProduct && (
            <div className="absolute bottom-0 start-0 end-0 p-4 bg-card border-t border-border">
              <Button
                onClick={handleAddToOrder}
                disabled={!isSelectionComplete() || isAdding}
                className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                {isAdding ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                    {t("adding")}
                  </span>
                ) : (
                  <>
                    <Check className="w-5 h-5 me-2" />
                    {t("addToOrder")}
                  </>
                )}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
