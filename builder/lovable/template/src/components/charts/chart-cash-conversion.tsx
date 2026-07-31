import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CashConversion } from "@/components/charts/lib/finance3"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash conversion cycle</CardTitle>
        <CardDescription>Inventory, receivables and payables on one axis</CardDescription>
      </CardHeader>
      <CardContent>
        <CashConversion dso={46} dio={52} dpo={64} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Cash is out of the door for 34 days <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Trailing twelve months
        </div>
      </CardFooter>
    </Card>
  )
}
