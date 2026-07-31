import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MarkdownCurve } from "@/components/charts/lib/retail2"
const steps = [
  { discount: 0, units: 120 },
  { discount: 0.1, units: 210 },
  { discount: 0.2, units: 360 },
  { discount: 0.3, units: 540 },
  { discount: 0.4, units: 720 },
  { discount: 0.5, units: 880 },
  { discount: 0.6, units: 980 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How deep to discount</CardTitle>
        <CardDescription>Units shifted against margin kept</CardDescription>
      </CardHeader>
      <CardContent>
        <MarkdownCurve fullPrice={48} unitCost={21} steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Most units is rarely most money <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          End of season
        </div>
      </CardFooter>
    </Card>
  )
}
