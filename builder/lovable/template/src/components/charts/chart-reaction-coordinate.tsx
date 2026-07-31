import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ReactionCoordinate } from "@/components/charts/lib/chem"
const states = [
  { label: "reactants", energy: 0 },
  { label: "TS1", energy: 96, transition: true },
  { label: "intermediate", energy: 42 },
  { label: "TS2", energy: 78, transition: true },
  { label: "products", energy: -34 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Reaction profile</CardTitle>
        <CardDescription>Energy along the path</CardDescription>
      </CardHeader>
      <CardContent>
        <ReactionCoordinate states={states} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Activation and ΔE both read off the curve <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Two-step mechanism
        </div>
      </CardFooter>
    </Card>
  )
}
