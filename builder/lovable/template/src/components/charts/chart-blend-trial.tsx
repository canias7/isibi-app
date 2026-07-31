import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { BlendTrial } from "@/components/charts/lib/winery"
const components = ["Cabernet", "Merlot", "Cab Franc", "Petit Verdot"]
const trials = [
  { name: "Trial A", shares: [0.7, 0.2, 0.06, 0.04], score: 92.1 },
  { name: "Trial B", shares: [0.55, 0.35, 0.06, 0.04], score: 90.4 },
  { name: "Trial C", shares: [0.6, 0.2, 0.16, 0.04], score: 91.2 },
  { name: "Trial D", shares: [0.45, 0.45, 0.06, 0.04], score: 88.9 },
  { name: "Trial E", shares: [0.65, 0.15, 0.08, 0.12], score: 92.8 },
  { name: "Trial F", shares: [0.8, 0.1, 0.06, 0.04], score: 92.3 },
  { name: "Trial G", shares: [0.5, 0.25, 0.2, 0.05], score: 89.6 },
  { name: "Trial H", shares: [0.6, 0.24, 0.06, 0.1], score: 92.5 },
]
export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Blending trial</CardTitle>
        <CardDescription>Each variety's contribution, fitted</CardDescription>
      </CardHeader>
      <CardContent>
        <BlendTrial components={components} trials={trials} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          A panel ranks blends, arithmetic ranks varieties <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Eight trials
        </div>
      </CardFooter>
    </Card>
  )
}
