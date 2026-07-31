import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReserveRunoff } from "@/components/charts/lib/insure"
const periods = [
  { label: "Y1", paid: 2400 }, { label: "Y2", paid: 1900 }, { label: "Y3", paid: 1200 },
  { label: "Y4", paid: 700 }, { label: "Y5", paid: 420 }, { label: "Y6", paid: 260 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Was the reserve enough</CardTitle>
        <CardDescription>What was held against what was paid</CardDescription>
      </CardHeader>
      <CardContent>
        <ReserveRunoff initialReserve={7200} periods={periods} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The dashed line is what was held <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One accident year
        </div>
      </CardFooter>
    </Card>
  )
}
