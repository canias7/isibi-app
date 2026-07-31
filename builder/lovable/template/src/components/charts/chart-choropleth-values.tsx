import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Choropleth, sampleRegions, UK_GRID } from "./lib/choropleth"

const regions = sampleRegions(UK_GRID, 4)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Grid Map</CardTitle>
        <CardDescription>Bookings by region.</CardDescription>
      </CardHeader>
      <CardContent>
        <Choropleth regions={regions} showValues cell={48} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          London leads <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
