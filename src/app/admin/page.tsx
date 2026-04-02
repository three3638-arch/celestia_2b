import { Suspense } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import {
  StatsSection,
  TodoSection,
  RevenueChart,
  RecentOrdersTable,
} from '@/components/admin/dashboard-client'
import {
  getDashboardStats,
  getRecentOrders,
  getMonthlyRevenue,
} from '@/lib/actions/dashboard'

// Loading 骨架组件
function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="p-6">
            <div className="space-y-2">
              <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              <div className="h-7 w-24 bg-muted rounded animate-pulse" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function TodoSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-card border-border">
          <CardContent className="p-6">
            <div className="h-10 w-full bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function ChartSkeleton() {
  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-6">
        <div className="h-64 w-full bg-muted rounded animate-pulse" />
      </CardContent>
    </Card>
  )
}

function TableSkeleton() {
  return (
    <Card className="bg-card border-border h-full">
      <CardContent className="p-6">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-10 w-full bg-muted rounded animate-pulse" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// 数据获取组件
async function StatsData() {
  const stats = await getDashboardStats()
  return <StatsSection stats={stats} />
}

async function TodoData() {
  const stats = await getDashboardStats()
  return <TodoSection stats={stats} />
}

async function RevenueChartData() {
  const data = await getMonthlyRevenue(6)
  return <RevenueChart data={data} />
}

async function RecentOrdersData() {
  const orders = await getRecentOrders(10)
  return <RecentOrdersTable orders={orders} />
}

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-xl font-medium text-foreground">仪表盘</h2>
        <p className="text-sm text-muted-foreground mt-1">
          欢迎回来，管理员
        </p>
      </div>

      {/* 统计卡片区 */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsData />
      </Suspense>

      {/* 待办事项区 */}
      <Suspense fallback={<TodoSkeleton />}>
        <TodoData />
      </Suspense>

      {/* 图表和表格区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
          <RevenueChartData />
        </Suspense>
        <Suspense fallback={<TableSkeleton />}>
          <RecentOrdersData />
        </Suspense>
      </div>
    </div>
  )
}
