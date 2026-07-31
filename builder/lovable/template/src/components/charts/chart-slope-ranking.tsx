import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SlopeChart, SERVICE_SLOPES } from "./lib/slope"

const items = [
  { label: "Cuts", from: 1, to: 1 },
  { label: "Beard", from: 2, to: 3 },
  { label: "Towel", from: 3, to: 4 },
  { label: "Colour", from: 5, to: 2, emphasise: true },
  { label: "Kids", from: 4, to: 5 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Slope</CardTitle>
        <CardDescription>Rank rather than volume — 1 is best.</CardDescription>
      </CardHeader>
      <CardContent>
        <SlopeChart items={items} fromLabel="H1" toLabel="H2" sortBy="none" invert />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Colour climbed three places <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
