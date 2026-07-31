import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Swingometer } from "@/components/charts/lib/civic"
const seats = [
  { name: "Fell Rise", margin: 0.008 }, { name: "Harbour East", margin: 0.021 },
  { name: "Kilnbrook", margin: 0.034 }, { name: "Northgate", margin: 0.048 },
  { name: "Riverside", margin: 0.061 }, { name: "Southmoor", margin: 0.079 },
  { name: "Westbrook", margin: 0.094 }, { name: "Eastfield", margin: 0.112 },
  { name: "Ashvale", margin: 0.138 }, { name: "Bramble Hill", margin: 0.167 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seats that would change</CardTitle>
        <CardDescription>Ordered by the swing they need</CardDescription>
      </CardHeader>
      <CardContent>
        <Swingometer seats={seats} swing={0.04} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A seat needs half its margin <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Testing a 4% swing
        </div>
      </CardFooter>
    </Card>
  )
}
