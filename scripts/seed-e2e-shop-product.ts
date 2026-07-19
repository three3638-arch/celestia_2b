import { PrismaClient, Prisma } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const E2E_SLUG = 'e2e-test-ring'
const E2E_CATEGORY_SLUG = 'e2e-category'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ seed-e2e-shop-product: DATABASE_URL 未设置')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const category = await prisma.shopCategory.upsert({
    where: { slug: E2E_CATEGORY_SLUG },
    create: {
      slug: E2E_CATEGORY_SLUG,
      nameZh: 'E2E 测试品类',
      nameEn: 'E2E Test Category',
      nameAr: 'فئة اختبار',
      sortOrder: 9999,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE' },
  })

  const product = await prisma.shopProduct.upsert({
    where: { slug: E2E_SLUG },
    create: {
      slug: E2E_SLUG,
      titleZh: 'E2E 测试戒指',
      titleEn: 'E2E Test Ring',
      titleAr: 'خاتم اختبار',
      descriptionEn: 'Playwright E2E fixture product',
      categoryId: category.id,
      status: 'ACTIVE',
      sortOrder: 9999,
    },
    update: {
      status: 'ACTIVE',
      categoryId: category.id,
    },
  })

  const variantCount = await prisma.shopProductVariant.count({ where: { productId: product.id } })
  if (variantCount === 0) {
    await prisma.shopProductVariant.create({
      data: {
        productId: product.id,
        variantCode: 'DEFAULT',
        nameEn: 'Default',
        nameZh: '默认',
        nameAr: 'افتراضي',
        listPrice: new Prisma.Decimal('199.00'),
        stockStatus: 'IN_STOCK',
      },
    })
  }

  console.log(`✅ E2E 商品已就绪: slug=${E2E_SLUG}`)
}

main()
  .catch((e) => {
    console.error('❌ seed-e2e-shop-product 失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
