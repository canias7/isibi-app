import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GrowthChart, Audiogram, EcgStrip, DoseResponse, BloodPressure, LabResults } from "./lib/health"

const right = [10, 10, 15, 15, 20, 25, 30]
const left = [15, 15, 20, 25, 40, 60, 55]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Audiogram</CardTitle>
        <CardDescription>Thresholds by frequency, 0 dB at the top.</CardDescription>
      </CardHeader>
      <CardContent>
        <Audiogram right={right} left={left} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A high-frequency dip in the left ear <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
