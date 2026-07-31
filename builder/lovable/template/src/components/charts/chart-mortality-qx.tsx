import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MortalityTable } from "@/components/charts/lib/actuarial"
const rates = Array.from({ length: 71 }, (_, i) => {
  const age = 30 + i
  return { age, qx: 0.00022 * Math.exp(0.0875 * (age - 30)) + 0.0004 }
})

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Mortality</CardTitle>
        <CardDescription>Life expectancy chained from the table</CardDescription>
      </CardHeader>
      <CardContent>
        <MortalityTable rates={rates} fromAge={65} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A linear plot shows nothing until eighty <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Log qx
        </div>
      </CardFooter>
    </Card>
  )
}
