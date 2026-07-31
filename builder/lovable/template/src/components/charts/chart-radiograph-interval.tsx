import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { RadiographInterval } from "@/components/charts/lib/dentistry"
const groups = [
  { name: "High caries risk", intervalMonths: 6, usvPerSet: 26, patients: 210 },
  { name: "Moderate risk", intervalMonths: 12, usvPerSet: 26, patients: 640 },
  { name: "Low risk adult", intervalMonths: 24, usvPerSet: 26, patients: 1180 },
  { name: "Low risk, panoramic", intervalMonths: 60, usvPerSet: 14, patients: 320 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Radiograph schedule</CardTitle>
        <CardDescription>The sum nobody adds up</CardDescription>
      </CardHeader>
      <CardContent>
        <RadiographInterval groups={groups} years={20} backgroundUsvPerYear={2700} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Days of natural background is the comparison that means something <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Over twenty years
        </div>
      </CardFooter>
    </Card>
  )
}
