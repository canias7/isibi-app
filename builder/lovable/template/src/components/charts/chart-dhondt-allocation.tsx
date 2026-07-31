import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DHondtAllocation } from "@/components/charts/lib/elections"
const parties = [
  { name: "Blue", votes: 340000 }, { name: "Red", votes: 280000 },
  { name: "Green", votes: 160000 }, { name: "Amber", votes: 96000 },
  { name: "Regional", votes: 74000 }, { name: "Independent", votes: 38000 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>D'Hondt allocation</CardTitle>
        <CardDescription>Every round computed, with the winning quotient</CardDescription>
      </CardHeader>
      <CardContent>
        <DHondtAllocation parties={parties} seats={11} threshold={5} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Highest averages always favours the large <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          11 seats, 5% threshold
        </div>
      </CardFooter>
    </Card>
  )
}
