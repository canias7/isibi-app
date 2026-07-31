import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { WindTriangle } from "@/components/charts/lib/aero"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wind correction</CardTitle>
        <CardDescription>Heading, track and the wind between them</CardDescription>
      </CardHeader>
      <CardContent>
        <WindTriangle course={75} trueAirspeed={110} windFrom={340} windSpeed={25} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Drift solved from the vectors <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Cross-country leg
        </div>
      </CardFooter>
    </Card>
  )
}
