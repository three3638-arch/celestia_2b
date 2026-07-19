import { PrismaClient, ShopUserRole } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ 错误: DATABASE_URL 环境变量未设置')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

function generatePassword(): string {
  return randomBytes(18).toString('base64url')
}

async function main() {
  const isProd = process.env.NODE_ENV === 'production'
  const phone = process.env.SHOP_ADMIN_PHONE
  const password = process.env.SHOP_ADMIN_PASSWORD

  if (isProd && (!phone || !password)) {
    console.error('❌ 生产环境须设置 SHOP_ADMIN_PHONE 与 SHOP_ADMIN_PASSWORD')
    process.exit(1)
  }

  const resolvedPhone = phone || '13900000001'
  const resolvedPassword = password || generatePassword()
  const passwordHash = await bcrypt.hash(resolvedPassword, 10)

  const existing = await prisma.shopUser.findUnique({ where: { phone: resolvedPhone } })
  if (existing) {
    console.log('✅ 2C 管理员账号已存在，跳过创建')
    console.log(`   手机号: ${resolvedPhone}`)
    return
  }

  await prisma.shopUser.create({
    data: {
      phone: resolvedPhone,
      passwordHash,
      name: 'Shop Admin',
      role: ShopUserRole.SHOP_ADMIN,
    },
  })

  console.log('✅ 2C 管理员账号创建成功')
  console.log(`   手机号: ${resolvedPhone}`)
  if (!password) {
    console.log('   密码（首次生成，请写入密码管理器）: ' + resolvedPassword)
  } else {
    console.log('   密码: 已使用环境变量 SHOP_ADMIN_PASSWORD（不在日志中显示）')
  }
}

main()
  .catch((e) => {
    console.error('❌ 创建 2C 管理员失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
