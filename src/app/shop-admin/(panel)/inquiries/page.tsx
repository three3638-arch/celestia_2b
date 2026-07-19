import { getShopInquiries } from "@/lib/actions/shop-inquiry";
import { InquiryAdminPanel, inquiryStatusLabel } from "@/components/shop-admin/inquiry-admin-panel";
import { getCurrentShopUser } from "@/lib/shop-auth";
import { formatAdminDateTime } from "@/lib/format-datetime";

export default async function ShopInquiriesPage() {
  const [inquiries, user] = await Promise.all([getShopInquiries(), getCurrentShopUser()]);
  const isAdmin = user?.role === "SHOP_ADMIN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">询价管理</h1>
      <div className="space-y-4">
        {inquiries.length === 0 ? (
          <p className="text-muted-foreground">暂无询价</p>
        ) : (
          inquiries.map((inq) => (
            <div key={inq.id} className="border border-border rounded-lg p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium">{inq.name} · {inq.phone}</p>
                  <p className="text-sm text-muted-foreground">
                    {inq.product.titleZh} ({inq.variant?.variantCode}) · {inquiryStatusLabel(inq.status)} ·{" "}
                    {formatAdminDateTime(inq.createdAt)}
                  </p>
                </div>
                <p className="text-sm">
                  {inq.currentPriceSnapshot.toString()} SAR
                  <span className="text-muted-foreground line-through ml-2">
                    {inq.listPriceSnapshot.toString()}
                  </span>
                </p>
              </div>
              {inq.message && <p className="text-sm mb-3">{inq.message}</p>}
              {inq.adminNote && !isAdmin && (
                <p className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                  备注：{inq.adminNote}
                </p>
              )}
              {isAdmin && (
                <InquiryAdminPanel id={inq.id} currentStatus={inq.status} adminNote={inq.adminNote} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
