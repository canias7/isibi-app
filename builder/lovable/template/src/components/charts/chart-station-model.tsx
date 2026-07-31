import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { StationModel } from "@/components/charts/lib/weather2"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Station plot</CardTitle>
        <CardDescription>One observation, synoptic notation</CardDescription>
      </CardHeader>
      <CardContent>
        <StationModel
          tempC={14}
          dewC={11}
          pressureHpa={1013.4}
          cloudEighths={6}
          windFrom={225}
          windKt={35}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A pennant is 50 kt, a feather 10 <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          12:00 UTC
        </div>
      </CardFooter>
    </Card>
  )
}
