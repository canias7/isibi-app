import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PollutionRose } from "@/components/charts/lib/airquality"
const sectors = Array.from({ length: 16 }, (_, i) => {
  const bearing = i * 22.5
  const towardMotorway = Math.exp(-Math.pow(((bearing - 225 + 540) % 360 - 180) / 45, 2))
  const towardTown = Math.exp(-Math.pow(((bearing - 90 + 540) % 360 - 180) / 60, 2))
  return {
    bearing,
    meanConcentration: 18 + towardMotorway * 46 + towardTown * 21,
    hours: Math.round(300 + towardTown * 620 + towardMotorway * 180),
  }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pollution rose</CardTitle>
        <CardDescription>Concentration by wind sector, weighted by hours</CardDescription>
      </CardHeader>
      <CardContent>
        <PollutionRose sectors={sectors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The dirtiest wind is not the worst exposure <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          NO₂, one year
        </div>
      </CardFooter>
    </Card>
  )
}
