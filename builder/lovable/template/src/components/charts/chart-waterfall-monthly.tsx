import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Waterfall } from "./lib/waterfall"

const steps = [
  { label: "May", value: 7780, total: true },
  { label: "Cuts", value: 420 },
  { label: "Colour", value: 310 },
  { label: "Refunds", value: -90 },
  { label: "June", value: 8420, total: true },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall</CardTitle>
        <CardDescription>Month on month.</CardDescription>
      </CardHeader>
      <CardContent>
        <Waterfall steps={steps} format={(n) => "£" + n.toLocaleString()} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Up £640 on May <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
