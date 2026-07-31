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

const tests = [
  { label: "Jan", value: 4.9 }, { label: "Feb", value: 5.4 }, { label: "Mar", value: 6.8 },
  { label: "Apr", value: 5.9 }, { label: "May", value: 5.2 }, { label: "Jun", value: 4.8 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lab Results</CardTitle>
        <CardDescription>A marker over time in its reference range.</CardDescription>
      </CardHeader>
      <CardContent>
        <LabResults tests={tests} range={{ lo: 3.5, hi: 6.0 }} unit=" mmol/L" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          One flagged result, since recovered <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
