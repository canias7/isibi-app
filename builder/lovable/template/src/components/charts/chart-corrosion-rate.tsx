import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { CorrosionRate } from "@/components/charts/lib/materials"
const readings = [
  { year: 2010, thicknessMm: 12.7 }, { year: 2014, thicknessMm: 12.1 },
  { year: 2018, thicknessMm: 11.4 }, { year: 2021, thicknessMm: 10.9 },
  { year: 2024, thicknessMm: 10.3 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wall thickness over time</CardTitle>
        <CardDescription>And when it hits retirement</CardDescription>
      </CardHeader>
      <CardContent>
        <CorrosionRate readings={readings} nominalMm={12.7} retireMm={8.0} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The date is what the inspection is for <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Pipeline segment
        </div>
      </CardFooter>
    </Card>
  )
}
