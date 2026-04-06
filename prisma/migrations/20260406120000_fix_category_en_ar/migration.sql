-- 订正品类英文、阿拉伯文（原翻译失败时曾写入 [EN]/[AR] 占位）
-- 仅针对：耳钉、项链、手链、戒指

UPDATE "categories"
SET "name_en" = 'Earrings', "name_ar" = 'أقراط'
WHERE "name_zh" = '耳钉';

UPDATE "categories"
SET "name_en" = 'Necklace', "name_ar" = 'عقد'
WHERE "name_zh" = '项链';

UPDATE "categories"
SET "name_en" = 'Bracelet', "name_ar" = 'سوار'
WHERE "name_zh" = '手链';

UPDATE "categories"
SET "name_en" = 'Ring', "name_ar" = 'خاتم'
WHERE "name_zh" = '戒指';
