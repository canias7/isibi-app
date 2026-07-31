import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { InkCoverage } from "@/components/charts/lib/printing"
const separations = [
  { name: "Cyan", percent: 72 }, { name: "Magenta", percent: 84 },
  { name: "Yellow", percent: 68 }, { name: "Black", percent: 94 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Ink coverage</CardTitle>
        <CardDescription>The sum is what has to dry, not any one channel</CardDescription>
      </CardHeader>
      <CardContent>
        <InkCoverage separations={separations} maxTotalArea={300} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Eighteen points over the limit <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Coated stock, 300% TAC
        </div>
      </CardFooter>
    </Card>
  )
}
