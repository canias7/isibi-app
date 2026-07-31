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

const doses = [0.1, 0.3, 1, 3, 10, 30, 100, 300]
const responses = doses.map((d) => +(100 / (1 + Math.pow(8 / d, 1.2))).toFixed(1))

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dose-Response</CardTitle>
        <CardDescription>Effect against log dose.</CardDescription>
      </CardHeader>
      <CardContent>
        <DoseResponse doses={doses} responses={responses} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The useful window is narrow <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
