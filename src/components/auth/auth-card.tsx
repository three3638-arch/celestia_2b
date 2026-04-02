import Image from 'next/image'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

interface AuthCardProps {
  title: string
  subtitle?: string
  children: React.ReactNode
}

export function AuthCard({ title, subtitle, children }: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border-border">
      <CardHeader className="text-center space-y-4">
        <div className="flex justify-center">
          <Image src="/logo.png" alt="Celestia" width={48} height={48} />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
