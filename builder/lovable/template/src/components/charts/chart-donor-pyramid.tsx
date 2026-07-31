import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DonorPyramid } from "@/components/charts/lib/fundraising"
const bands = [
  { name: "Major gifts, £25k+", donors: 14, totalGiven: 1240000 },
  { name: "£5k–£25k", donors: 61, totalGiven: 620000 },
  { name: "£1k–£5k", donors: 284, totalGiven: 512000 },
  { name: "£250–£1k", donors: 1420, totalGiven: 604000 },
  { name: "Regular givers", donors: 9840, totalGiven: 1180000 },
  { name: "Cash under £250", donors: 21400, totalGiven: 486000 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Donor pyramid</CardTitle>
        <CardDescription>Share of donors against share of income</CardDescription>
      </CardHeader>
      <CardContent>
        <DonorPyramid bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The two shapes always point opposite ways <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Last financial year
        </div>
      </CardFooter>
    </Card>
  )
}
