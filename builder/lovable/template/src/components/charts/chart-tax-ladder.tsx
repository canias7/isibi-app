import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { TaxLadder } from "@/components/charts/lib/finance2"
const bands = [
  { upTo: 12570, rate: 0 },
  { upTo: 50270, rate: 0.2 },
  { upTo: 125140, rate: 0.4 },
  { upTo: null, rate: 0.45 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Marginal against effective</CardTitle>
        <CardDescription>Being in a band is not paying that rate</CardDescription>
      </CardHeader>
      <CardContent>
        <TaxLadder bands={bands} income={78000} currency="GBP" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The two numbers are far apart <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Income tax bands
        </div>
      </CardFooter>
    </Card>
  )
}
