import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Makeready } from "@/components/charts/lib/printing"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Makeready</CardTitle>
        <CardDescription>The fixed cost divided by a number the customer picks</CardDescription>
      </CardHeader>
      <CardContent>
        <Makeready setupCost={420} runCostPerCopy={0.11} digitalCostPerCopy={0.38} maxRun={4000} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          Litho only wins past the break-even run <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Against digital
        </div>
      </CardFooter>
    </Card>
  )
}
