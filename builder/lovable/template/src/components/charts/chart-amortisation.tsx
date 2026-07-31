import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Amortisation } from "@/components/charts/lib/finance2"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mortgage split</CardTitle>
        <CardDescription>Interest against principal, month by month</CardDescription>
      </CardHeader>
      <CardContent>
        <Amortisation principal={320000} annualRate={0.045} years={25} currency="GBP" />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Principal takes years to overtake interest <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          25 years at 4.5%
        </div>
      </CardFooter>
    </Card>
  )
}
