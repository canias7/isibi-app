import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DaylightFactor } from "@/components/charts/lib/building"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daylight factor</CardTitle>
        <CardDescription>Falloff with depth, against the rule of thumb</CardDescription>
      </CardHeader>
      <CardContent>
        <DaylightFactor roomDepthM={9} windowHeadM={2.4} glazingRatio={0.42} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The back of the room needs the lights on <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          9 m deep
        </div>
      </CardFooter>
    </Card>
  )
}
