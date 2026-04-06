/**
 * 固定品类的中英阿对照（与数据库约定一致，避免翻译 API 失败时出现 [EN]/[AR] 占位）
 */
export const CANONICAL_CATEGORY_I18N: Record<
  string,
  { nameEn: string; nameAr: string }
> = {
  耳钉: { nameEn: 'Earrings', nameAr: 'أقراط' },
  项链: { nameEn: 'Necklace', nameAr: 'عقد' },
  手链: { nameEn: 'Bracelet', nameAr: 'سوار' },
  戒指: { nameEn: 'Ring', nameAr: 'خاتم' },
}

export function getCanonicalCategoryI18n(nameZh: string) {
  return CANONICAL_CATEGORY_I18N[nameZh.trim()] ?? null
}
