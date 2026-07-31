import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PaywallFunnel } from "@/components/charts/lib/publish"
const steps = [
  { name: "Article views", people: 2_400_000 },
  { name: "Hit the meter", people: 386_000 },
  { name: "Saw the offer", people: 214_000 },
  { name: "Started checkout", people: 31_000 },
  { name: "Subscribed", people: 9_400 },
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Through the wall</CardTitle>
        <CardDescription>Each step and the compound</CardDescription>
      </CardHeader>
      <CardContent>
        <PaywallFunnel steps={steps} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Healthy steps compound to almost nothing <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          One month
        </div>
      </CardFooter>
    </Card>
  )
}
