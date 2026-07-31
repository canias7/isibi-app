import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FrameMargin } from "@/components/charts/lib/optical"
const bands = [
  { name: "Budget, under £60", framesOnBoard: 32, cost: 14, retail: 49, soldPerYear: 186 },
  { name: "Mid, £60–£120", framesOnBoard: 46, cost: 34, retail: 94, soldPerYear: 214 },
  { name: "Premium, £120–£220", framesOnBoard: 38, cost: 62, retail: 168, soldPerYear: 96 },
  { name: "Designer, £220–£400", framesOnBoard: 22, cost: 118, retail: 298, soldPerYear: 31 },
  { name: "Luxury, over £400", framesOnBoard: 10, cost: 194, retail: 540, soldPerYear: 7 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>The frame board</CardTitle>
        <CardDescription>What a slot earns in a year</CardDescription>
      </CardHeader>
      <CardContent>
        <FrameMargin bands={bands} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Bought on margin, paid for by turn <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          148 slots
        </div>
      </CardFooter>
    </Card>
  )
}
