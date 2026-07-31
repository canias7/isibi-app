import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WaterfallDistribution } from "@/components/charts/lib/finance3"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribution waterfall</CardTitle>
        <CardDescription>Every tier solved from the proceeds</CardDescription>
      </CardHeader>
      <CardContent>
        <WaterfallDistribution contributed={50000000} proceeds={92000000} preferredReturn={0.08} carry={0.2} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Catch-up is reached, carry begins <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          8% pref, 20% carry
        </div>
      </CardFooter>
    </Card>
  )
}
