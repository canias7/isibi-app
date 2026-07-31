import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ModularGrid } from "@/components/charts/lib/design"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layout grid</CardTitle>
        <CardDescription>Columns, gutters and margins to scale</CardDescription>
      </CardHeader>
      <CardContent>
        <ModularGrid columns={12} gutter={24} margin={64} width={1200} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Column width is derived, not chosen <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          1200px container
        </div>
      </CardFooter>
    </Card>
  )
}
