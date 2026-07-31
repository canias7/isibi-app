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

const readings = [
  { label: "Jan", sys: 152, dia: 96 }, { label: "Feb", sys: 148, dia: 94 },
  { label: "Mar", sys: 142, dia: 90 }, { label: "Apr", sys: 138, dia: 88 },
  { label: "May", sys: 134, dia: 86 }, { label: "Jun", sys: 128, dia: 82 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blood Pressure</CardTitle>
        <CardDescription>Paired readings against the guideline lines.</CardDescription>
      </CardHeader>
      <CardContent>
        <BloodPressure readings={readings} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Back under the lines by the last visit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
