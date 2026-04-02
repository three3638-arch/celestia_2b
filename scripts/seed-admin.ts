import { PrismaClient, UserRole, UserStatus } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import * as bcrypt from 'bcryptjs'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('❌ 错误: DATABASE_URL 环境变量未设置')
  console.error('   请确保 .env 文件存在且 DATABASE_URL 已配置')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const phone = '18758067734'
  const password = 'admin123'
  const passwordHash = await bcrypt.hash(password, 10)

  // 检查是否已存在
  const existingAdmin = await prisma.user.findUnique({
    where: { phone },
  })

  if (existingAdmin) {
    console.log('✅ 管理员账号已存在，跳过创建')
    console.log(`   手机号: ${phone}`)
    return
  }

  // 创建管理员
  const admin = await prisma.user.create({
    data: {
      phone,
      passwordHash,
      name: '管理员',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      markupRatio: 1.15,
      preferredLang: 'zh',
    },
  })

  console.log('✅ 管理员账号创建成功')
  console.log(`   手机号: ${phone}`)
  console.log(`   密码: ${password}`)
  console.log(`   ID: ${admin.id}`)
}

main()
  .catch((e) => {
    console.error('❌ 创建管理员失败:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
