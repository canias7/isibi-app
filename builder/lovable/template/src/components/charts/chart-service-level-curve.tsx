import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ServiceLevelCurve } from "@/components/charts/lib/contact"

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>One more agent</CardTitle>
        <CardDescription>Service level against headcount</CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceLevelCurve
          calls={186}
          ahtSeconds={310}
          targetSeconds={20}
          targetServiceLevel={0.8}
          agentCostPerHour={19.4}
        />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          It is a cliff, which is why the argument is unwinnable without it <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          186 calls, 310s AHT
        </div>
      </CardFooter>
    </Card>
  )
}
