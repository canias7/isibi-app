import { TrendingUp } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { MorbidityIncidence } from "@/components/charts/lib/actuarial"
const bands = [
  { name: "30–39", lives: 84000 },
  { name: "40–49", lives: 96000 },
  { name: "50–59", lives: 61000 },
  { name: "60–69", lives: 22000 },
]
const causes = ["Cancer", "Heart attack", "Stroke", "MS", "Other"]
const claims = [
  [52, 9, 4, 11, 14],
  [186, 41, 18, 14, 32],
  [412, 128, 61, 8, 54],
  [318, 142, 78, 2, 41],
]

export default function Component() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Claims incidence</CardTitle>
        <CardDescription>Per thousand lives exposed, not counts</CardDescription>
      </CardHeader>
      <CardContent>
        <MorbidityIncidence bands={bands} causes={causes} claims={claims} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="flex gap-2 leading-none font-medium">
          The most claims and the highest rate are different bands <TrendingUp className="h-4 w-4" />
        </div>
        <div className="text-muted-foreground leading-none">
          Critical illness
        </div>
      </CardFooter>
    </Card>
  )
}
