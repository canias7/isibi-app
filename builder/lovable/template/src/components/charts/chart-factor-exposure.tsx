import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { FactorExposure } from "@/components/charts/lib/finance3"
const factors = [
  { name: "Value", portfolio: 0.42, benchmark: 0.18, volatility: 0.9 },
  { name: "Momentum", portfolio: 0.61, benchmark: 0.12, volatility: 1.4 },
  { name: "Quality", portfolio: 0.24, benchmark: 0.3, volatility: 0.7 },
  { name: "Size", portfolio: -0.18, benchmark: 0.05, volatility: 1.1 },
  { name: "Low vol", portfolio: 0.08, benchmark: 0.22, volatility: 0.8 },
  { name: "Growth", portfolio: 0.31, benchmark: 0.34, volatility: 1 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Factor tilts</CardTitle>
        <CardDescription>Active weight against the benchmark</CardDescription>
      </CardHeader>
      <CardContent>
        <FactorExposure factors={factors} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Momentum carries most of the active risk <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Equity sleeve
        </div>
      </CardFooter>
    </Card>
  )
}
