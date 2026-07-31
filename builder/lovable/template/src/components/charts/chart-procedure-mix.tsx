import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ProcedureMix } from "@/components/charts/lib/dentistry"
const procedures = [
  { name: "Examination", count: 340, feeEach: 38, minutesEach: 15 },
  { name: "Hygiene", count: 262, feeEach: 62, minutesEach: 30 },
  { name: "Composite restoration", count: 118, feeEach: 145, minutesEach: 40 },
  { name: "Crown", count: 34, feeEach: 720, minutesEach: 90, labEach: 165 },
  { name: "Root canal, molar", count: 16, feeEach: 690, minutesEach: 120 },
  { name: "Extraction", count: 41, feeEach: 180, minutesEach: 30 },
  { name: "Denture, full", count: 9, feeEach: 890, minutesEach: 150, labEach: 340 },
  { name: "Whitening", count: 22, feeEach: 340, minutesEach: 40, labEach: 62 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Procedure mix</CardTitle>
        <CardDescription>Revenue per chair hour, after lab</CardDescription>
      </CardHeader>
      <CardContent>
        <ProcedureMix procedures={procedures} chairCostPerHour={190} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most money and most per hour are different items <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
