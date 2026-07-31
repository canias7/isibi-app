import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BayPlan } from "@/components/charts/lib/logistics"
const rows = ["06", "04", "02", "01", "03", "05"]
const tiers = [86, 84, 82, 80]
const W = [[18, 22, 12, 9, 24, 20], [14, 26, 16, 11, 8, 18], [28, 30, 24, 26, 22, 25], [30, 32, 28, 30, 29, 31]]
const slots = W.map((tier, ti) =>
  tier.map((t, ri) => (ti === 0 && ri === 3 ? null : { id: `CN${ti}${ri}`, tonnes: t, reefer: ti === 1 && ri < 2 })),
)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Container bay</CardTitle>
        <CardDescription>Rows and tiers by weight</CardDescription>
      </CardHeader>
      <CardContent>
        <BayPlan rows={rows} tiers={tiers} slots={slots} maxStackTonnes={100} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Heavy boxes high is what capsizes ships <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Bay 22
        </div>
      </CardFooter>
    </Card>
  )
}
