import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { IndexUsage } from "@/components/charts/lib/dbperf"
const indexes = [
  { name: "orders_pkey", scans: 1_840_000, sizeMb: 210, writesPerMin: 420 },
  { name: "orders_customer_idx", scans: 620_000, sizeMb: 180, writesPerMin: 420 },
  { name: "orders_created_idx", scans: 94_000, sizeMb: 165, writesPerMin: 420 },
  { name: "orders_status_idx", scans: 1_200, sizeMb: 88, writesPerMin: 420 },
  { name: "orders_legacy_ref_idx", scans: 0, sizeMb: 142, writesPerMin: 420 },
  { name: "orders_promo_idx", scans: 0, sizeMb: 61, writesPerMin: 420 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Are these indexes earning it</CardTitle>
        <CardDescription>Reads against the space they hold</CardDescription>
      </CardHeader>
      <CardContent>
        <IndexUsage indexes={indexes} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          An unused index still slows writes <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One table
        </div>
      </CardFooter>
    </Card>
  )
}
