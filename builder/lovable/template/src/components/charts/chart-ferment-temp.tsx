import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FermentTemp } from "@/components/charts/lib/winery"
const readings = Array.from({ length: 61 }, (_, i) => {
  const hour = i * 4
  const peak = Math.exp(-Math.pow((hour - 96) / 52, 2))
  const diurnal = Math.sin((hour / 24) * Math.PI * 2 - 1.2) * 2.4
  return { hour, c: Math.round((22 + peak * 9.4 + diurnal) * 10) / 10 }
})
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ferment temperature</CardTitle>
        <CardDescription>Excursions measured in hours, not readings</CardDescription>
      </CardHeader>
      <CardContent>
        <FermentTemp readings={readings} band={[24, 30]} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A log taken twice a day misses the whole night <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Tank 7, band 24-30°C
        </div>
      </CardFooter>
    </Card>
  )
}
