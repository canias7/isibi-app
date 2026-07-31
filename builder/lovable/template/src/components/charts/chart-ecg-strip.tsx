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

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ECG Strip</CardTitle>
        <CardDescription>Four beats on the calibration grid.</CardDescription>
      </CardHeader>
      <CardContent>
        <EcgStrip />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Regular rhythm, ordinary intervals <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
