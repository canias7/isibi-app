import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WaterBalance } from "@/components/charts/lib/water"
const periods = [
  { label: "Winter", rainfall: 310, runoff: 148, recharge: 118, evaporation: 32 },
  { label: "Spring", rainfall: 190, runoff: 62, recharge: 54, evaporation: 78 },
  { label: "Summer", rainfall: 148, runoff: 24, recharge: 12, evaporation: 141 },
  { label: "Autumn", rainfall: 244, runoff: 88, recharge: 76, evaporation: 62 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where the rain went</CardTitle>
        <CardDescription>Runoff, recharge and evaporation</CardDescription>
      </CardHeader>
      <CardContent>
        <WaterBalance periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The residual is storage or a wrong term <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          By season
        </div>
      </CardFooter>
    </Card>
  )
}
