"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Minus, Plus, X, ShoppingBag, ArrowRight } from "lucide-react";
import { useCartStore } from "@/stores/cart";
import { createOrder } from "@/lib/actions/order";
import { formatPrice } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";

interface CartPageProps {
  params: Promise<{
    locale: string;
  }>;
}

export default function CartPage({ params }: CartPageProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const t = useTranslations("cart");
  const locale = useLocale();
  
  const { items, updateQuantity, removeItem, updateNote, clearCart, totalItems } = useCartStore();

  const handleQuantityChange = (skuId: string, delta: number) => {
    const item = items.find((i) => i.skuId === skuId);
    if (item) {
      const newQuantity = item.quantity + delta;
      if (newQuantity > 0) {
        updateQuantity(skuId, newQuantity);
      }
    }
  };

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast.error(t("empty"));
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await createOrder({
        items: items.map((item) => ({
          skuId: item.skuId,
          quantity: item.quantity,
        })),
      });

      if (result.success && result.data) {
        clearCart();
        toast.success(t("orderSubmitted"));
        router.push(`/${locale}/storefront/orders/${result.data.orderId}`);
      } else {
        toast.error(result.error || t("submitFailed"));
      }
    } catch {
      toast.error(t("submitFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty cart state
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="text-center space-y-6"
        >
          <div className="w-24 h-24 mx-auto rounded-full bg-muted flex items-center justify-center">
            <ShoppingBag className="w-12 h-12 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              {t("empty")}
            </h2>
            <p className="text-muted-foreground text-sm">
              {t("startShopping")}
            </p>
          </div>
          <Link href={`/${locale}/storefront`}>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
              {t("browseProducts")}
              <ArrowRight className="w-4 h-4 ms-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <h1 className="text-lg font-semibold text-foreground">
            {t("title")} ({totalItems()})
          </h1>
        </div>
      </div>

      {/* Cart Items List */}
      <div className="px-4 py-4 space-y-3">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={item.skuId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.2, delay: index * 0.05 }}
            >
              <Card className="p-3 bg-card border-border">
                <div className="flex gap-3">
                  {/* Thumbnail */}
                  <div className="relative w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                    {item.thumbnailUrl || item.imageUrl ? (
                      <Image
                        src={item.thumbnailUrl || item.imageUrl!}
                        alt={item.productName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">
                      {item.productName}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.skuDesc}
                    </p>
                    {item.referencePriceSar && (
                      <p className="text-xs text-primary mt-0.5">
                        {formatPrice(item.referencePriceSar)}
                      </p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={() => removeItem(item.skuId)}
                    className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                    aria-label="Remove item"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Quantity Controls & Note */}
                <div className="mt-3 space-y-2">
                  {/* Quantity */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleQuantityChange(item.skuId, -1)}
                        className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium text-foreground">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.skuId, 1)}
                        className="w-8 h-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Note Input */}
                  <Input
                    placeholder={t("addNote")}
                    value={item.note || ""}
                    onChange={(e) => updateNote(item.skuId, e.target.value)}
                    className="h-8 text-xs bg-background border-border placeholder:text-muted-foreground"
                  />
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Bottom Fixed Bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="fixed bottom-14 start-0 end-0 z-40 bg-card border-t border-border md:bottom-0"
      >
        <div className="px-4 py-3 space-y-3">
          {/* Item Count */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{t("totalItems")}</span>
            <span className="font-medium text-foreground">{totalItems()}</span>
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmitOrder}
            disabled={isSubmitting || items.length === 0}
            className="w-full h-12 bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                {t("submitting")}
              </span>
            ) : (
              t("submitOrder")
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
