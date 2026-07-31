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
  { label: "Revenue", value: 8420, total: true },
  { label: "Staff", value: -3200 },
  { label: "Rent", value: -1800 },
  { label: "Stock", value: -940 },
  { label: "Grants", value: 320 },
  { label: "Profit", value: 0, total: true },
]
steps[steps.length - 1].value = steps
  .slice(0, -1)
  .reduce((s, x) => (x.total ? x.value : s + x.value), 0)

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Waterfall</CardTitle>
        <CardDescription>How revenue became profit.</CardDescription>
      </CardHeader>
      <CardContent>
        <Waterfall steps={steps} format={(n) => "£" + n.toLocaleString()} showConnectors={false} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          £2,800 retained <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          January - June 2024
        </div>
      </CardFooter>
    </Card>
  )
}
