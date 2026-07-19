import { getContactSubmissions } from "@/lib/actions/contact";
import { ContactStatusButton } from "@/components/shop-admin/contact-actions";
import { getCurrentShopUser } from "@/lib/shop-auth";
import { formatAdminDateTime } from "@/lib/format-datetime";

export default async function ShopContactsPage() {
  const [contacts, user] = await Promise.all([getContactSubmissions(), getCurrentShopUser()]);
  const isAdmin = user?.role === "SHOP_ADMIN";

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">官网留言</h1>
      <div className="space-y-4">
        {contacts.length === 0 ? (
          <p className="text-muted-foreground">暂无留言</p>
        ) : (
          contacts.map((c) => (
            <div key={c.id} className="border border-border rounded-lg p-4">
              <div className="flex flex-wrap justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium">
                    {c.name} · {c.email}
                    {c.phone ? ` · ${c.phone}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {c.locale || "—"} · {c.status} · {formatAdminDateTime(c.createdAt)}
                  </p>
                </div>
              </div>
              <p className="text-sm whitespace-pre-wrap mb-3">{c.message}</p>
              {isAdmin && (
                <div className="flex flex-wrap gap-2">
                  {(["READ", "REPLIED"] as const).map((s) => (
                    <ContactStatusButton key={s} id={c.id} status={s} />
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
