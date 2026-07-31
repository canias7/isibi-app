import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AnnuityFactor } from "@/components/charts/lib/actuarial"
let alive = 1
const survivorship = Array.from({ length: 35 }, (_, t) => {
  alive *= 1 - (0.008 * Math.exp(0.092 * t))
  return Math.max(0, alive)
})
const discountRates = [0.01, 0.02, 0.03, 0.04, 0.05]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Annuity factor</CardTitle>
        <CardDescription>Longevity and interest, separated</CardDescription>
      </CardHeader>
      <CardContent>
        <AnnuityFactor survivorship={survivorship} discountRates={discountRates} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A quote expires in a fortnight for a reason <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Male, 65
        </div>
      </CardFooter>
    </Card>
  )
}
