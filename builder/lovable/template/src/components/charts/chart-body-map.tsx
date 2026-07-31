import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BodyMap } from "@/components/charts/lib/med2"
const marks = [
  { region: "Lower back", x: 30, y: 48, intensity: 0.9 },
  { region: "Right knee", x: 34, y: 86, intensity: 0.6 },
  { region: "Left shoulder", x: 19, y: 26, intensity: 0.45 },
  { region: "Neck", x: 30, y: 19, intensity: 0.3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Where it hurts</CardTitle>
        <CardDescription>Sites and intensity</CardDescription>
      </CardHeader>
      <CardContent>
        <BodyMap marks={marks} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Circle size is the score given <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Reported today
        </div>
      </CardFooter>
    </Card>
  )
}
